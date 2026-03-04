import { create } from "zustand";
import type { Opportunity, FeatureSpec } from "../types/engine";

interface OpportunitiesState {
  opportunities: Opportunity[];
  loading: boolean;
  activeSpec: { title: string; markdown: string; spec: FeatureSpec } | null;
  specLoading: boolean;

  setOpportunities: (o: Opportunity[]) => void;
  setLoading: (v: boolean) => void;
  setActiveSpec: (s: { title: string; markdown: string; spec: FeatureSpec } | null) => void;
  setSpecLoading: (v: boolean) => void;
  runDiscover: (workspacePath: string) => Promise<void>;
  generateSpec: (workspacePath: string, title: string) => Promise<void>;
}

export const useOpportunitiesStore = create<OpportunitiesState>((set) => ({
  opportunities: [],
  loading: false,
  activeSpec: null,
  specLoading: false,

  setOpportunities: (opportunities) => set({ opportunities }),
  setLoading: (loading) => set({ loading }),
  setActiveSpec: (activeSpec) => set({ activeSpec }),
  setSpecLoading: (specLoading) => set({ specLoading }),

  runDiscover: async (workspacePath: string) => {
    set({ loading: true });
    try {
      const res = (await window.compass.engine.call("/discover", {
        workspace_path: workspacePath,
      })) as { status: string; opportunities: Opportunity[] };

      if (res.status === "ok") {
        set({ opportunities: res.opportunities });
      }
    } catch (err) {
      console.error("Discover failed:", err);
    } finally {
      set({ loading: false });
    }
  },

  generateSpec: async (workspacePath: string, title: string) => {
    set({ specLoading: true });
    try {
      const res = (await window.compass.engine.call("/specify", {
        workspace_path: workspacePath,
        opportunity_title: title,
      })) as { status: string; title: string; markdown: string; spec: FeatureSpec };

      if (res.status === "ok") {
        set({ activeSpec: { title: res.title, markdown: res.markdown, spec: res.spec } });
      }
    } catch (err) {
      console.error("Specify failed:", err);
    } finally {
      set({ specLoading: false });
    }
  },
}));
