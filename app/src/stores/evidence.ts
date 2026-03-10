import { create } from "zustand";
import type { Evidence, SourceType } from "../types/engine";

interface EvidenceState {
  items: Evidence[];
  loading: boolean;
  error: string | null;
  filter: SourceType | null;
  searchQuery: string;

  setItems: (items: Evidence[]) => void;
  setLoading: (v: boolean) => void;
  setFilter: (f: SourceType | null) => void;
  setSearchQuery: (q: string) => void;
  fetchEvidence: (workspacePath: string) => Promise<void>;
}

export const useEvidenceStore = create<EvidenceState>((set) => ({
  items: [],
  loading: false,
  error: null,
  filter: null,
  searchQuery: "",

  setItems: (items) => set({ items }),
  setLoading: (loading) => set({ loading }),
  setFilter: (filter) => set({ filter }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),

  fetchEvidence: async (workspacePath: string) => {
    set({ loading: true, error: null });
    try {
      const res = (await window.compass.engine.call("/evidence", {
        workspace_path: workspacePath,
      })) as { status: string; items: Evidence[] };

      if (res.status === "ok") {
        set({ items: res.items });
      } else {
        set({ error: "Engine returned an unexpected response." });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      console.error("Fetch evidence failed:", err);
      set({ error: `Failed to load evidence: ${message}` });
    } finally {
      set({ loading: false });
    }
  },
}));
