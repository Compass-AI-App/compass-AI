import { create } from "zustand";
import type { SourceConfig, Evidence } from "../types/engine";

interface IngestionResult {
  name: string;
  type: string;
  items: number;
  error?: string;
}

interface WorkspaceState {
  workspacePath: string | null;
  productName: string;
  productDescription: string;
  sources: SourceConfig[];
  evidenceCount: number;
  evidenceSummary: Record<string, number>;
  ingestionResults: IngestionResult[];
  engineStatus: "connecting" | "ready" | "unavailable";
  isIngesting: boolean;
  isReconciling: boolean;
  isDiscovering: boolean;

  setWorkspace: (path: string, name: string, description?: string) => void;
  clearWorkspace: () => void;
  setSources: (sources: SourceConfig[]) => void;
  addSource: (source: SourceConfig) => void;
  setEngineStatus: (status: "connecting" | "ready" | "unavailable") => void;
  setIngesting: (v: boolean) => void;
  setReconciling: (v: boolean) => void;
  setDiscovering: (v: boolean) => void;
  setIngestionResults: (results: IngestionResult[], total: number, summary: Record<string, number>) => void;
  triggerIngestion: (workspacePath: string) => Promise<void>;
  switchWorkspace: (path: string, name: string, description?: string) => Promise<void>;
}

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  workspacePath: null,
  productName: "",
  productDescription: "",
  sources: [],
  evidenceCount: 0,
  evidenceSummary: {},
  ingestionResults: [],
  engineStatus: "connecting",
  isIngesting: false,
  isReconciling: false,
  isDiscovering: false,

  setWorkspace: (path, name, description = "") =>
    set({ workspacePath: path, productName: name, productDescription: description }),

  clearWorkspace: () =>
    set({
      workspacePath: null,
      productName: "",
      productDescription: "",
      sources: [],
      evidenceCount: 0,
      evidenceSummary: {},
      ingestionResults: [],
    }),

  setSources: (sources) => set({ sources }),
  addSource: (source) =>
    set((s) => ({ sources: [...s.sources.filter((x) => x.name !== source.name), source] })),

  setEngineStatus: (status) => set({ engineStatus: status }),
  setIngesting: (v) => set({ isIngesting: v }),
  setReconciling: (v) => set({ isReconciling: v }),
  setDiscovering: (v) => set({ isDiscovering: v }),

  setIngestionResults: (results, total, summary) =>
    set({ ingestionResults: results, evidenceCount: total, evidenceSummary: summary }),

  switchWorkspace: async (path: string, name: string, description = "") => {
    // Clear current state
    set({
      workspacePath: path,
      productName: name,
      productDescription: description,
      sources: [],
      evidenceCount: 0,
      evidenceSummary: {},
      ingestionResults: [],
      isIngesting: false,
    });

    // Load workspace info from engine
    try {
      const info = (await window.compass.engine.call("/workspace/info", {
        workspace_path: path,
      })) as {
        status: string;
        sources: Array<{ type: string; name: string; path?: string }>;
        evidence_count: number;
      };
      if (info.status === "ok") {
        set({
          sources: info.sources.map((s) => ({
            type: s.type,
            name: s.name,
            path: s.path ?? null,
            url: null,
            options: {},
          })),
        });
        if (info.evidence_count > 0) {
          set({ evidenceCount: info.evidence_count });
        } else if (info.sources.length > 0) {
          // Auto-ingest if sources exist but no evidence
          const { triggerIngestion } = useWorkspaceStore.getState();
          triggerIngestion(path);
        }
      }
    } catch (err) {
      console.error("Failed to load workspace info:", err);
    }
  },

  triggerIngestion: async (workspacePath: string) => {
    set({ isIngesting: true });
    try {
      const res = (await window.compass.engine.call("/ingest", {
        workspace_path: workspacePath,
      })) as {
        status: string;
        total: number;
        sources: { name: string; type: string; items: number; error?: string }[];
        summary: Record<string, number>;
      };
      if (res.status === "ok") {
        set({
          ingestionResults: res.sources,
          evidenceCount: res.total,
          evidenceSummary: res.summary,
        });
      }
    } catch (err) {
      console.error("Auto-ingest failed:", err);
    } finally {
      set({ isIngesting: false });
    }
  },
}));
