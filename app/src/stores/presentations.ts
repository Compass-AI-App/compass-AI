import { create } from "zustand";
import type { PresentationData } from "../components/slides/SlideRenderer";

export interface SavedPresentation extends PresentationData {
  id: string;
  createdAt: string;
  audience: string;
}

interface PresentationsState {
  presentations: SavedPresentation[];
  activePresentation: SavedPresentation | null;
  loading: boolean;
  error: string | null;

  generate: (
    workspacePath: string,
    topic: string,
    audience?: string,
    slideCount?: number,
  ) => Promise<SavedPresentation | null>;
  save: (presentation: SavedPresentation) => void;
  remove: (id: string) => void;
  setActive: (p: SavedPresentation | null) => void;
  loadSaved: () => void;
}

const STORAGE_KEY = "compass-presentations";

export const usePresentationsStore = create<PresentationsState>((set, get) => ({
  presentations: [],
  activePresentation: null,
  loading: false,
  error: null,

  generate: async (workspacePath, topic, audience = "cross-functional", slideCount = 8) => {
    set({ loading: true, error: null });
    try {
      const res = (await window.compass.engine.call("/presentation/generate", {
        workspace_path: workspacePath,
        topic,
        audience,
        slide_count: slideCount,
      })) as {
        status: string;
        presentation: PresentationData & { audience?: string };
      };

      if (res.status === "ok" && res.presentation) {
        const saved: SavedPresentation = {
          ...res.presentation,
          id: `pres-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          createdAt: new Date().toISOString(),
          audience: audience,
        };
        const updated = [saved, ...get().presentations];
        set({ presentations: updated, activePresentation: saved, loading: false });
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
        return saved;
      }
      set({ error: "Failed to generate presentation", loading: false });
      return null;
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : "Generation failed",
        loading: false,
      });
      return null;
    }
  },

  save: (presentation) => {
    const updated = get().presentations.map((p) =>
      p.id === presentation.id ? presentation : p,
    );
    set({ presentations: updated, activePresentation: presentation });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  },

  remove: (id) => {
    const updated = get().presentations.filter((p) => p.id !== id);
    set({
      presentations: updated,
      activePresentation:
        get().activePresentation?.id === id ? null : get().activePresentation,
    });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  },

  setActive: (p) => set({ activePresentation: p }),

  loadSaved: () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as SavedPresentation[];
        set({ presentations: parsed });
      }
    } catch {
      // corrupted
    }
  },
}));
