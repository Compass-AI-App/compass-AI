import { create } from "zustand";
import type { PrototypeData } from "../components/prototype/PrototypePreview";

export interface SavedPrototype extends PrototypeData {
  id: string;
  createdAt: string;
}

interface PrototypesState {
  prototypes: SavedPrototype[];
  activePrototype: SavedPrototype | null;
  loading: boolean;
  error: string | null;

  generate: (
    workspacePath: string,
    description: string,
    prototypeType?: string,
  ) => Promise<SavedPrototype | null>;
  save: (prototype: SavedPrototype) => void;
  remove: (id: string) => void;
  setActive: (p: SavedPrototype | null) => void;
  loadSaved: () => void;
}

const STORAGE_KEY = "compass-prototypes";

export const usePrototypesStore = create<PrototypesState>((set, get) => ({
  prototypes: [],
  activePrototype: null,
  loading: false,
  error: null,

  generate: async (workspacePath, description, prototypeType = "landing-page") => {
    set({ loading: true, error: null });
    try {
      const res = (await window.compass.engine.call("/prototype/generate", {
        workspace_path: workspacePath,
        description,
        prototype_type: prototypeType,
      })) as { status: string; prototype: PrototypeData };

      if (res.status === "ok" && res.prototype) {
        const saved: SavedPrototype = {
          ...res.prototype,
          id: `proto-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          createdAt: new Date().toISOString(),
        };
        const updated = [saved, ...get().prototypes];
        set({ prototypes: updated, activePrototype: saved, loading: false });
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
        return saved;
      }
      set({ error: "Failed to generate prototype", loading: false });
      return null;
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : "Generation failed",
        loading: false,
      });
      return null;
    }
  },

  save: (prototype) => {
    const existing = get().prototypes;
    const idx = existing.findIndex((p) => p.id === prototype.id);
    const updated = idx >= 0
      ? existing.map((p) => (p.id === prototype.id ? prototype : p))
      : [prototype, ...existing];
    set({ prototypes: updated, activePrototype: prototype });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  },

  remove: (id) => {
    const updated = get().prototypes.filter((p) => p.id !== id);
    set({
      prototypes: updated,
      activePrototype:
        get().activePrototype?.id === id ? null : get().activePrototype,
    });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  },

  setActive: (p) => set({ activePrototype: p }),

  loadSaved: () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as SavedPrototype[];
        set({ prototypes: parsed });
      }
    } catch {
      // corrupted
    }
  },
}));
