import { create } from "zustand";

export interface Citation {
  id: string;
  title: string;
  source_type: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations?: Citation[];
  timestamp: number;
}

export type AgentMode = "default" | "thought-partner" | "technical-analyst" | "devils-advocate" | "writer" | "meeting-prep" | "experiment-designer";

interface ChatState {
  messages: ChatMessage[];
  loading: boolean;
  agentMode: AgentMode;

  addMessage: (msg: ChatMessage) => void;
  updateMessage: (id: string, update: Partial<ChatMessage>) => void;
  setLoading: (v: boolean) => void;
  setAgentMode: (mode: AgentMode) => void;
  clearMessages: () => void;
  loadHistory: (workspacePath: string) => void;
  saveHistory: (workspacePath: string) => void;
  sendMessage: (workspacePath: string, content: string) => Promise<void>;
}

let messageId = 0;
function nextId() {
  return `msg-${++messageId}-${Date.now()}`;
}

const HISTORY_PREFIX = "compass-chat-";
const MAX_MESSAGES = 100;

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  loading: false,
  agentMode: "default",

  addMessage: (msg) =>
    set((s) => ({ messages: [...s.messages, msg].slice(-MAX_MESSAGES) })),

  updateMessage: (id, update) =>
    set((s) => ({
      messages: s.messages.map((m) => (m.id === id ? { ...m, ...update } : m)),
    })),

  setLoading: (loading) => set({ loading }),
  setAgentMode: (agentMode) => set({ agentMode }),

  clearMessages: () => set({ messages: [] }),

  loadHistory: (workspacePath: string) => {
    try {
      const key = HISTORY_PREFIX + btoa(workspacePath).slice(0, 32);
      const raw = localStorage.getItem(key);
      if (raw) {
        const messages = JSON.parse(raw) as ChatMessage[];
        set({ messages: messages.slice(-MAX_MESSAGES) });
      }
    } catch {
      // ignore
    }
  },

  saveHistory: (workspacePath: string) => {
    try {
      const key = HISTORY_PREFIX + btoa(workspacePath).slice(0, 32);
      const { messages } = get();
      localStorage.setItem(key, JSON.stringify(messages.slice(-MAX_MESSAGES)));
    } catch {
      // ignore — localStorage may be full
    }
  },

  sendMessage: async (workspacePath: string, content: string) => {
    const userMsg: ChatMessage = {
      id: nextId(),
      role: "user",
      content,
      timestamp: Date.now(),
    };
    set((s) => ({ messages: [...s.messages, userMsg], loading: true }));

    try {
      const history = get().messages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const { agentMode } = get();
      const res = (await window.compass.engine.call("/chat", {
        workspace_path: workspacePath,
        message: content,
        history,
        agent_mode: agentMode,
      })) as { status: string; response: string; citations: Citation[] };

      if (res.status === "ok") {
        const assistantMsg: ChatMessage = {
          id: nextId(),
          role: "assistant",
          content: res.response,
          citations: res.citations,
          timestamp: Date.now(),
        };
        set((s) => ({ messages: [...s.messages, assistantMsg] }));
      }
    } catch (err) {
      console.error("Chat failed:", err);
      const errorMsg: ChatMessage = {
        id: nextId(),
        role: "assistant",
        content: "Sorry, I encountered an error. Please try again.",
        timestamp: Date.now(),
      };
      set((s) => ({ messages: [...s.messages, errorMsg] }));
    } finally {
      set({ loading: false });
      get().saveHistory(workspacePath);
    }
  },
}));
