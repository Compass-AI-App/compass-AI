import { create } from "zustand";
import type { Conflict } from "../types/engine";

interface ConflictsState {
  conflicts: Conflict[];
  loading: boolean;

  setConflicts: (c: Conflict[]) => void;
  setLoading: (v: boolean) => void;
  runReconcile: (workspacePath: string) => Promise<void>;
}

export const useConflictsStore = create<ConflictsState>((set) => ({
  conflicts: [],
  loading: false,

  setConflicts: (conflicts) => set({ conflicts }),
  setLoading: (loading) => set({ loading }),

  runReconcile: async (workspacePath: string) => {
    set({ loading: true });
    try {
      const res = (await window.compass.engine.call("/reconcile", {
        workspace_path: workspacePath,
      })) as { status: string; conflicts: Conflict[] };

      if (res.status === "ok") {
        set({ conflicts: res.conflicts });
      }
    } catch (err) {
      console.error("Reconcile failed:", err);
    } finally {
      set({ loading: false });
    }
  },
}));
