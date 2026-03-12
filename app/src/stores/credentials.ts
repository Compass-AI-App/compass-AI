import { create } from "zustand";

interface CredentialInfo {
  provider: string;
  method: string;
  status: "connected" | "expired" | "disconnected";
  scopes?: string[];
  expires_at?: number;
  metadata?: Record<string, string>;
}

interface CredentialsState {
  credentials: CredentialInfo[];
  loading: boolean;
  error: string | null;

  fetchCredentials: () => Promise<void>;
  connectOAuth: (providerId: string) => Promise<void>;
  connectApiKey: (providerId: string, apiKey: string, metadata?: Record<string, string>) => Promise<void>;
  disconnect: (providerId: string) => Promise<void>;
}

export const useCredentialsStore = create<CredentialsState>((set, get) => ({
  credentials: [],
  loading: false,
  error: null,

  fetchCredentials: async () => {
    try {
      set({ loading: true, error: null });
      const list = await window.compass?.credentials?.list();
      set({ credentials: list || [], loading: false });
    } catch (err) {
      set({ error: String(err), loading: false });
    }
  },

  connectOAuth: async (providerId: string) => {
    try {
      set({ loading: true, error: null });

      // Get provider config
      const providerConfig = await window.compass?.providers?.get(providerId);
      if (!providerConfig) {
        set({ error: `Unknown provider: ${providerId}`, loading: false });
        return;
      }

      if (!providerConfig.client_id) {
        set({
          error: `No client ID configured for ${providerConfig.name}. Set COMPASS_${providerId.toUpperCase()}_CLIENT_ID environment variable.`,
          loading: false,
        });
        return;
      }

      // Start OAuth flow (opens browser window)
      const result = await window.compass.oauth.start(providerConfig);

      // Store credential in vault
      await window.compass.credentials.store(providerId, {
        provider: providerId,
        method: "oauth",
        access_token: result.access_token,
        refresh_token: result.refresh_token,
        expires_at: result.expires_at,
        scopes: result.scopes,
      });

      // Inject into engine
      await window.compass.engine.call("/credentials/inject", {
        provider: providerId,
        access_token: result.access_token,
        refresh_token: result.refresh_token,
        expires_at: result.expires_at,
      });

      // Refresh list
      await get().fetchCredentials();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // Don't show error if user cancelled
      if (msg.includes("cancelled")) {
        set({ loading: false });
      } else {
        set({ error: msg, loading: false });
      }
    }
  },

  connectApiKey: async (providerId: string, apiKey: string, metadata?: Record<string, string>) => {
    try {
      set({ loading: true, error: null });

      // Store in vault
      await window.compass.credentials.store(providerId, {
        provider: providerId,
        method: "api_key",
        access_token: apiKey,
        metadata,
      });

      // Inject into engine
      await window.compass.engine.call("/credentials/inject", {
        provider: providerId,
        access_token: apiKey,
        metadata,
      });

      await get().fetchCredentials();
    } catch (err) {
      set({ error: String(err), loading: false });
    }
  },

  disconnect: async (providerId: string) => {
    try {
      set({ loading: true, error: null });

      // Remove from vault
      await window.compass.credentials.delete(providerId);

      // Remove from engine memory
      await window.compass.engine.call("/credentials/revoke", {
        provider: providerId,
      });

      await get().fetchCredentials();
    } catch (err) {
      set({ error: String(err), loading: false });
    }
  },
}));
