/** Types for the credential vault — encrypted storage for OAuth tokens and API keys. */

export type AuthMethod = "oauth" | "api_key" | "pat";

export type ConnectionStatus = "connected" | "expired" | "disconnected";

/** A credential stored in the Electron vault (encrypted via OS keychain). */
export interface Credential {
  provider: string; // e.g. "github", "slack", "jira"
  method: AuthMethod;
  access_token: string;
  refresh_token?: string;
  expires_at?: number; // Unix timestamp (ms)
  scopes?: string[];
  metadata?: Record<string, string>; // e.g. { site_url: "myteam.atlassian.net" }
}

/** Summary of a stored credential (without sensitive token values). */
export interface CredentialInfo {
  provider: string;
  method: AuthMethod;
  status: ConnectionStatus;
  scopes?: string[];
  expires_at?: number;
  metadata?: Record<string, string>;
}

/** Supported OAuth/API providers. */
export type ProviderId =
  | "github"
  | "google"
  | "slack"
  | "atlassian"
  | "linear"
  | "notion"
  | "zendesk";

/** The credential vault API exposed via window.compass.credentials. */
export interface CredentialVault {
  store: (provider: string, credential: Credential) => Promise<boolean>;
  load: (provider: string) => Promise<Credential | null>;
  delete: (provider: string) => Promise<boolean>;
  list: () => Promise<CredentialInfo[]>;
}
