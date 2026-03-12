import { create } from "zustand";

export interface ChartSpec {
  type: string;
  title: string;
  data: Record<string, unknown>[];
  x_key: string;
  y_keys: string[];
}

export interface PinnedChart extends ChartSpec {
  id: string;
  query: string;
  pinnedAt: string;
}

interface DashboardState {
  charts: ChartSpec[];
  title: string;
  loading: boolean;
  error: string | null;
  pinnedCharts: PinnedChart[];

  generateDashboard: (workspacePath: string, question: string) => Promise<void>;
  pinChart: (chart: ChartSpec, query: string) => void;
  unpinChart: (id: string) => void;
  loadPinned: (workspacePath: string) => Promise<void>;
}

const PINNED_KEY = "compass-pinned-charts";

export const useDashboardStore = create<DashboardState>((set, get) => ({
  charts: [],
  title: "",
  loading: false,
  error: null,
  pinnedCharts: [],

  generateDashboard: async (workspacePath, question) => {
    set({ loading: true, error: null });
    try {
      const res = (await window.compass.engine.call("/dashboard/generate", {
        workspace_path: workspacePath,
        question,
      })) as { status: string; title: string; charts: ChartSpec[] };

      if (res.status === "ok") {
        set({ charts: res.charts, title: res.title, loading: false });
      } else {
        set({ error: "Failed to generate dashboard", loading: false });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Dashboard generation failed";
      set({ error: message, loading: false });
    }
  },

  pinChart: (chart, query) => {
    const id = `pin-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const pinned: PinnedChart = {
      ...chart,
      id,
      query,
      pinnedAt: new Date().toISOString(),
    };
    const updated = [...get().pinnedCharts, pinned];
    set({ pinnedCharts: updated });
    localStorage.setItem(PINNED_KEY, JSON.stringify(updated));
  },

  unpinChart: (id) => {
    const updated = get().pinnedCharts.filter((c) => c.id !== id);
    set({ pinnedCharts: updated });
    localStorage.setItem(PINNED_KEY, JSON.stringify(updated));
  },

  loadPinned: async () => {
    try {
      const raw = localStorage.getItem(PINNED_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as PinnedChart[];
        set({ pinnedCharts: parsed });
      }
    } catch {
      // Corrupted data
    }
  },
}));
