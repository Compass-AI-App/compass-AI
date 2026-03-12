/**
 * OAuth provider configurations for Compass connectors.
 *
 * Each provider defines auth/token URLs, scopes, and a client_id placeholder.
 * For open-source distribution, users register their own OAuth apps and
 * set client_id via environment variables or the Settings page.
 * Compass Cloud can optionally provide hosted client IDs.
 *
 * Client ID resolution order:
 *   1. Environment variable: COMPASS_{PROVIDER}_CLIENT_ID
 *   2. Settings store (user-configured)
 *   3. Fallback placeholder (requires user to configure)
 */

import type { OAuthProviderConfig } from "./oauth";

// Helper to read client ID from env or fallback
function clientId(provider: string, fallback = ""): string {
  const envKey = `COMPASS_${provider.toUpperCase()}_CLIENT_ID`;
  return process.env[envKey] || fallback;
}

export const OAUTH_PROVIDERS: Record<string, OAuthProviderConfig> = {
  github: {
    id: "github",
    name: "GitHub",
    auth_url: "https://github.com/login/oauth/authorize",
    token_url: "https://github.com/login/oauth/access_token",
    client_id: clientId("github"),
    scopes: ["repo", "read:org", "read:user"],
  },

  google: {
    id: "google",
    name: "Google",
    auth_url: "https://accounts.google.com/o/oauth2/v2/auth",
    token_url: "https://oauth2.googleapis.com/token",
    client_id: clientId("google"),
    scopes: [
      "https://www.googleapis.com/auth/drive.readonly",
      "https://www.googleapis.com/auth/documents.readonly",
      "https://www.googleapis.com/auth/userinfo.profile",
      "https://www.googleapis.com/auth/userinfo.email",
    ],
    extra_auth_params: {
      access_type: "offline",
      prompt: "consent",
    },
  },

  slack: {
    id: "slack",
    name: "Slack",
    auth_url: "https://slack.com/oauth/v2/authorize",
    token_url: "https://slack.com/api/oauth.v2.access",
    client_id: clientId("slack"),
    scopes: [
      "channels:history",
      "channels:read",
      "search:read",
      "users:read",
    ],
  },

  atlassian: {
    id: "atlassian",
    name: "Atlassian",
    auth_url: "https://auth.atlassian.com/authorize",
    token_url: "https://auth.atlassian.com/oauth/token",
    client_id: clientId("atlassian"),
    scopes: [
      "read:jira-work",
      "read:jira-user",
      "read:confluence-content.all",
      "read:confluence-space.summary",
      "offline_access",
    ],
    extra_auth_params: {
      audience: "api.atlassian.com",
      prompt: "consent",
    },
  },

  linear: {
    id: "linear",
    name: "Linear",
    auth_url: "https://linear.app/oauth/authorize",
    token_url: "https://api.linear.app/oauth/token",
    client_id: clientId("linear"),
    scopes: ["read"],
    // Linear also supports API keys — many users prefer this
    api_key_only: false,
  },

  notion: {
    id: "notion",
    name: "Notion",
    auth_url: "https://api.notion.com/v1/oauth/authorize",
    token_url: "https://api.notion.com/v1/oauth/token",
    client_id: clientId("notion"),
    scopes: [],
    // Notion's OAuth doesn't use scopes in the auth URL;
    // permissions are set when creating the integration
  },

  zendesk: {
    id: "zendesk",
    name: "Zendesk",
    // Zendesk OAuth requires the subdomain in the URL
    // This will be replaced at runtime with the user's subdomain
    auth_url: "https://{subdomain}.zendesk.com/oauth/authorizations/new",
    token_url: "https://{subdomain}.zendesk.com/oauth/tokens",
    client_id: clientId("zendesk"),
    scopes: ["read", "tickets:read"],
    // Most Zendesk users prefer API token auth
    api_key_only: true,
  },
};

/**
 * Get a provider config by ID.
 * Returns a copy so callers can modify (e.g. to set subdomain in URLs).
 */
export function getProvider(id: string): OAuthProviderConfig | null {
  const provider = OAUTH_PROVIDERS[id];
  if (!provider) return null;
  return { ...provider };
}

/**
 * Get all provider configs.
 */
export function getAllProviders(): OAuthProviderConfig[] {
  return Object.values(OAUTH_PROVIDERS).map((p) => ({ ...p }));
}

/**
 * Provider IDs that support full OAuth flow (not just API keys).
 */
export const OAUTH_CAPABLE_PROVIDERS = Object.entries(OAUTH_PROVIDERS)
  .filter(([, p]) => !p.api_key_only)
  .map(([id]) => id);

/**
 * Provider IDs that prefer or require API key auth.
 */
export const API_KEY_PROVIDERS = Object.entries(OAUTH_PROVIDERS)
  .filter(([, p]) => p.api_key_only)
  .map(([id]) => id);
