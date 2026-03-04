import { create } from "zustand";
import type { Evidence, SourceType } from "../types/engine";

interface EvidenceState {
  items: Evidence[];
  loading: boolean;
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
  filter: null,
  searchQuery: "",

  setItems: (items) => set({ items }),
  setLoading: (loading) => set({ loading }),
  setFilter: (filter) => set({ filter }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),

  fetchEvidence: async (workspacePath: string) => {
    set({ loading: true });
    try {
      const res = (await window.compass.engine.call("/evidence", {
        workspace_path: workspacePath,
      })) as { status: string; items: Evidence[] };

      if (res.status === "ok") {
        set({ items: res.items });
      }
    } catch (err) {
      console.error("Fetch evidence failed:", err);
    } finally {
      set({ loading: false });
    }
  },
}));
