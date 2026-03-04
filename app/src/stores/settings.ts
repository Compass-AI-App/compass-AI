import { create } from "zustand";

export type LLMProvider = "compass" | "byok";

interface SettingsState {
  provider: LLMProvider;
  apiKey: string;
  model: string;
  tokenUsage: { input: number; output: number; total: number; cost: string };

  setProvider: (p: LLMProvider) => void;
  setApiKey: (k: string) => void;
  setModel: (m: string) => void;
  setTokenUsage: (u: { input: number; output: number; total: number; cost: string }) => void;
  loadSettings: () => void;
  saveSettings: () => void;
  fetchUsage: () => Promise<void>;
}

const SETTINGS_KEY = "compass-settings";

export const useSettingsStore = create<SettingsState>((set, get) => ({
  provider: "compass",
  apiKey: "",
  model: "claude-sonnet-4-20250514",
  tokenUsage: { input: 0, output: 0, total: 0, cost: "$0.00" },

  setProvider: (provider) => {
    set({ provider });
    get().saveSettings();
  },
  setApiKey: (apiKey) => {
    set({ apiKey });
    get().saveSettings();
  },
  setModel: (model) => {
    set({ model });
    get().saveSettings();
  },
  setTokenUsage: (tokenUsage) => set({ tokenUsage }),

  loadSettings: () => {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        set({
          provider: data.provider || "compass",
          model: data.model || "claude-sonnet-4-20250514",
        });
      }
    } catch {
      // ignore
    }
  },

  saveSettings: () => {
    const { provider, model } = get();
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ provider, model }));
  },

  fetchUsage: async () => {
    try {
      const res = (await window.compass?.engine.call("/usage")) as {
        status: string;
        session_tokens: { input: number; output: number };
        total_tokens: number;
        total_cost_estimate: string;
      };
      if (res?.status === "ok") {
        set({
          tokenUsage: {
            input: res.session_tokens.input,
            output: res.session_tokens.output,
            total: res.total_tokens,
            cost: res.total_cost_estimate,
          },
        });
      }
    } catch {
      // ignore
    }
  },
}));
