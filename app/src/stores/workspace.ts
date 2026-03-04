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
}));
