/**
 * Generic OAuth2 Authorization Code + PKCE flow for Electron.
 *
 * Opens a BrowserWindow to the provider's auth URL, captures the redirect
 * via a custom protocol handler (compass://oauth/callback), exchanges the
 * code for tokens, and stores the credential in the vault.
 *
 * Token refresh is handled automatically when tokens are near expiration.
 */

import { BrowserWindow, ipcMain } from "electron";
import crypto from "crypto";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface OAuthProviderConfig {
  id: string;
  name: string;
  auth_url: string;
  token_url: string;
  client_id: string;
  scopes: string[];
  icon?: string;
  /** Some providers require additional params (e.g. Atlassian needs audience) */
  extra_auth_params?: Record<string, string>;
  /** For providers that use API keys instead of OAuth */
  api_key_only?: boolean;
}

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
  scope?: string;
}

interface PendingAuth {
  provider: OAuthProviderConfig;
  codeVerifier: string;
  state: string;
  resolve: (result: OAuthResult) => void;
  reject: (err: Error) => void;
}

export interface OAuthResult {
  provider: string;
  access_token: string;
  refresh_token?: string;
  expires_at?: number;
  scopes: string[];
}

// ---------------------------------------------------------------------------
// PKCE Helpers
// ---------------------------------------------------------------------------

function generateCodeVerifier(): string {
  return crypto.randomBytes(32).toString("base64url");
}

function generateCodeChallenge(verifier: string): string {
  return crypto.createHash("sha256").update(verifier).digest("base64url");
}

function generateState(): string {
  return crypto.randomBytes(16).toString("hex");
}

// ---------------------------------------------------------------------------
// OAuth Manager
// ---------------------------------------------------------------------------

let pendingAuth: PendingAuth | null = null;
let authWindow: BrowserWindow | null = null;

/**
 * Start an OAuth2 Authorization Code + PKCE flow.
 *
 * Opens a BrowserWindow to the provider's auth URL. The user authenticates
 * in that window. On redirect, the code is exchanged for tokens.
 *
 * Returns the tokens on success, throws on failure or cancellation.
 */
export function startOAuthFlow(
  provider: OAuthProviderConfig
): Promise<OAuthResult> {
  return new Promise((resolve, reject) => {
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = generateCodeChallenge(codeVerifier);
    const state = generateState();

    pendingAuth = { provider, codeVerifier, state, resolve, reject };

    // Build authorization URL
    const params = new URLSearchParams({
      response_type: "code",
      client_id: provider.client_id,
      redirect_uri: "compass://oauth/callback",
      scope: provider.scopes.join(" "),
      state,
      code_challenge: codeChallenge,
      code_challenge_method: "S256",
      ...provider.extra_auth_params,
    });

    const authUrl = `${provider.auth_url}?${params.toString()}`;

    // Open auth window
    authWindow = new BrowserWindow({
      width: 600,
      height: 700,
      show: true,
      title: `Sign in to ${provider.name}`,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
      },
    });

    authWindow.loadURL(authUrl);

    authWindow.on("closed", () => {
      authWindow = null;
      if (pendingAuth) {
        const p = pendingAuth;
        pendingAuth = null;
        p.reject(new Error("OAuth flow cancelled by user"));
      }
    });
  });
}

/**
 * Handle the OAuth callback from the custom protocol.
 * Called when the app receives a compass://oauth/callback?code=...&state=... URL.
 */
export async function handleOAuthCallback(
  callbackUrl: string
): Promise<void> {
  if (!pendingAuth) {
    console.warn("[oauth] Received callback but no pending auth flow");
    return;
  }

  const url = new URL(callbackUrl);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  const { provider, codeVerifier, state: expectedState, resolve, reject } =
    pendingAuth;
  pendingAuth = null;

  // Close the auth window
  if (authWindow) {
    authWindow.close();
    authWindow = null;
  }

  // Validate
  if (error) {
    reject(new Error(`OAuth error: ${error}`));
    return;
  }

  if (!code) {
    reject(new Error("No authorization code received"));
    return;
  }

  if (state !== expectedState) {
    reject(new Error("OAuth state mismatch — possible CSRF attack"));
    return;
  }

  // Exchange code for tokens
  try {
    const tokens = await exchangeCodeForTokens(provider, code, codeVerifier);
    const result: OAuthResult = {
      provider: provider.id,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: tokens.expires_in
        ? Date.now() + tokens.expires_in * 1000
        : undefined,
      scopes: tokens.scope
        ? tokens.scope.split(" ")
        : provider.scopes,
    };
    resolve(result);
  } catch (err) {
    reject(err instanceof Error ? err : new Error(String(err)));
  }
}

/**
 * Exchange an authorization code for access/refresh tokens.
 */
async function exchangeCodeForTokens(
  provider: OAuthProviderConfig,
  code: string,
  codeVerifier: string
): Promise<TokenResponse> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: provider.client_id,
    code,
    redirect_uri: "compass://oauth/callback",
    code_verifier: codeVerifier,
  });

  const res = await fetch(provider.token_url, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      `Token exchange failed (${res.status}): ${text}`
    );
  }

  return (await res.json()) as TokenResponse;
}

/**
 * Refresh an expired access token using a refresh token.
 */
export async function refreshAccessToken(
  provider: OAuthProviderConfig,
  refreshToken: string
): Promise<TokenResponse> {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: provider.client_id,
    refresh_token: refreshToken,
  });

  const res = await fetch(provider.token_url, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      `Token refresh failed (${res.status}): ${text}`
    );
  }

  return (await res.json()) as TokenResponse;
}

// ---------------------------------------------------------------------------
// IPC Registration — call this from main.ts
// ---------------------------------------------------------------------------

export function registerOAuthIPC(): void {
  ipcMain.handle(
    "oauth-start",
    async (
      _event,
      providerConfig: OAuthProviderConfig
    ): Promise<OAuthResult> => {
      return startOAuthFlow(providerConfig);
    }
  );

  ipcMain.handle(
    "oauth-refresh",
    async (
      _event,
      providerConfig: OAuthProviderConfig,
      refreshToken: string
    ) => {
      const tokens = await refreshAccessToken(providerConfig, refreshToken);
      return {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token || refreshToken,
        expires_at: tokens.expires_in
          ? Date.now() + tokens.expires_in * 1000
          : undefined,
      };
    }
  );
}
