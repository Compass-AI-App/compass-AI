import { create } from "zustand";

export interface WorkspaceEntry {
  id: string;
  name: string;
  description: string;
  path: string;
  created_at: string;
  last_opened: string;
}

interface WorkspaceManagerState {
  workspaces: WorkspaceEntry[];
  activeWorkspaceId: string | null;
  loaded: boolean;

  loadWorkspaces: () => Promise<void>;
  saveWorkspaces: () => Promise<void>;
  addWorkspace: (entry: Omit<WorkspaceEntry, "id" | "created_at" | "last_opened">) => Promise<WorkspaceEntry>;
  removeWorkspace: (id: string) => Promise<void>;
  openWorkspace: (id: string) => void;
  getActiveWorkspace: () => WorkspaceEntry | null;
}

function generateId() {
  return `ws-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

const STORAGE_KEY = "compass-workspaces";
const ACTIVE_KEY = "compass-active-workspace";

export const useWorkspaceManager = create<WorkspaceManagerState>((set, get) => ({
  workspaces: [],
  activeWorkspaceId: null,
  loaded: false,

  loadWorkspaces: async () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const workspaces: WorkspaceEntry[] = raw ? JSON.parse(raw) : [];
      const activeWorkspaceId = localStorage.getItem(ACTIVE_KEY) || null;
      set({ workspaces, activeWorkspaceId, loaded: true });
    } catch {
      set({ workspaces: [], loaded: true });
    }
  },

  saveWorkspaces: async () => {
    const { workspaces, activeWorkspaceId } = get();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(workspaces));
    if (activeWorkspaceId) {
      localStorage.setItem(ACTIVE_KEY, activeWorkspaceId);
    }
  },

  addWorkspace: async (entry) => {
    const ws: WorkspaceEntry = {
      ...entry,
      id: generateId(),
      created_at: new Date().toISOString(),
      last_opened: new Date().toISOString(),
    };
    set((s) => {
      const workspaces = [...s.workspaces, ws];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(workspaces));
      localStorage.setItem(ACTIVE_KEY, ws.id);
      return { workspaces, activeWorkspaceId: ws.id };
    });
    return ws;
  },

  removeWorkspace: async (id) => {
    set((s) => {
      const workspaces = s.workspaces.filter((w) => w.id !== id);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(workspaces));
      const activeWorkspaceId = s.activeWorkspaceId === id ? null : s.activeWorkspaceId;
      return { workspaces, activeWorkspaceId };
    });
  },

  openWorkspace: (id) => {
    set((s) => {
      const workspaces = s.workspaces.map((w) =>
        w.id === id ? { ...w, last_opened: new Date().toISOString() } : w
      );
      localStorage.setItem(STORAGE_KEY, JSON.stringify(workspaces));
      localStorage.setItem(ACTIVE_KEY, id);
      return { workspaces, activeWorkspaceId: id };
    });
  },

  getActiveWorkspace: () => {
    const { workspaces, activeWorkspaceId } = get();
    return workspaces.find((w) => w.id === activeWorkspaceId) || null;
  },
}));
