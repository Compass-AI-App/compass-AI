import { create } from "zustand";
import type { Opportunity, FeatureSpec } from "../types/engine";

interface OpportunitiesState {
  opportunities: Opportunity[];
  loading: boolean;
  error: string | null;
  activeSpec: { title: string; markdown: string; cursorMarkdown: string; claudeCodeMarkdown: string; spec: FeatureSpec } | null;
  specLoading: boolean;
  specError: string | null;
  activeBrief: { title: string; markdown: string } | null;
  briefLoading: boolean;
  activeChallenge: { title: string; markdown: string } | null;
  challengeLoading: boolean;

  setOpportunities: (o: Opportunity[]) => void;
  setLoading: (v: boolean) => void;
  setActiveSpec: (s: { title: string; markdown: string; cursorMarkdown: string; claudeCodeMarkdown: string; spec: FeatureSpec } | null) => void;
  setSpecLoading: (v: boolean) => void;
  setActiveBrief: (b: { title: string; markdown: string } | null) => void;
  setActiveChallenge: (c: { title: string; markdown: string } | null) => void;
  runDiscover: (workspacePath: string) => Promise<void>;
  generateSpec: (workspacePath: string, title: string) => Promise<void>;
  generateBrief: (workspacePath: string, title: string) => Promise<void>;
  generateChallenge: (workspacePath: string, title: string) => Promise<void>;
}

export const useOpportunitiesStore = create<OpportunitiesState>((set) => ({
  opportunities: [],
  loading: false,
  error: null,
  activeSpec: null,
  specLoading: false,
  specError: null,
  activeBrief: null,
  briefLoading: false,
  activeChallenge: null,
  challengeLoading: false,

  setOpportunities: (opportunities) => set({ opportunities }),
  setLoading: (loading) => set({ loading }),
  setActiveSpec: (activeSpec) => set({ activeSpec }),
  setSpecLoading: (specLoading) => set({ specLoading }),
  setActiveBrief: (activeBrief) => set({ activeBrief }),
  setActiveChallenge: (activeChallenge) => set({ activeChallenge }),

  runDiscover: async (workspacePath: string) => {
    set({ loading: true, error: null });
    try {
      const res = (await window.compass.engine.call("/discover", {
        workspace_path: workspacePath,
      })) as { status: string; opportunities: Opportunity[] };

      if (res.status === "ok") {
        set({ opportunities: res.opportunities });
      } else {
        set({ error: "Discovery returned an unexpected response." });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      console.error("Discover failed:", err);
      set({ error: `Discovery failed: ${message}` });
    } finally {
      set({ loading: false });
    }
  },

  generateSpec: async (workspacePath: string, title: string) => {
    set({ specLoading: true, specError: null });
    try {
      const res = (await window.compass.engine.call("/specify", {
        workspace_path: workspacePath,
        opportunity_title: title,
      })) as { status: string; title: string; markdown: string; cursor_markdown: string; claude_code_markdown: string; spec: FeatureSpec };

      if (res.status === "ok") {
        set({
          activeSpec: {
            title: res.title,
            markdown: res.markdown,
            cursorMarkdown: res.cursor_markdown || "",
            claudeCodeMarkdown: res.claude_code_markdown || "",
            spec: res.spec,
          },
        });
      } else {
        set({ specError: "Specification generation returned an unexpected response." });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      console.error("Specify failed:", err);
      set({ specError: `Spec generation failed: ${message}` });
    } finally {
      set({ specLoading: false });
    }
  },

  generateBrief: async (workspacePath: string, title: string) => {
    set({ briefLoading: true });
    try {
      const res = (await window.compass.engine.call("/write/brief", {
        workspace_path: workspacePath,
        opportunity_title: title,
      })) as { status: string; markdown: string };

      if (res.status === "ok") {
        set({ activeBrief: { title, markdown: res.markdown } });
      }
    } catch (err) {
      console.error("Brief generation failed:", err);
    } finally {
      set({ briefLoading: false });
    }
  },

  generateChallenge: async (workspacePath: string, title: string) => {
    set({ challengeLoading: true });
    try {
      const res = (await window.compass.engine.call("/challenge", {
        workspace_path: workspacePath,
        opportunity_title: title,
      })) as { status: string; markdown: string };

      if (res.status === "ok") {
        set({ activeChallenge: { title, markdown: res.markdown } });
      }
    } catch (err) {
      console.error("Challenge generation failed:", err);
    } finally {
      set({ challengeLoading: false });
    }
  },
}));
