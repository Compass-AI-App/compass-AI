import { create } from "zustand";

interface Citation {
  id: string;
  title: string;
  source_type: string;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations?: Citation[];
  timestamp: number;
}

interface ChatState {
  messages: ChatMessage[];
  loading: boolean;

  addMessage: (msg: ChatMessage) => void;
  setLoading: (v: boolean) => void;
  clearMessages: () => void;
  sendMessage: (workspacePath: string, content: string) => Promise<void>;
}

let messageId = 0;
function nextId() {
  return `msg-${++messageId}-${Date.now()}`;
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  loading: false,

  addMessage: (msg) => set((s) => ({ messages: [...s.messages, msg] })),
  setLoading: (loading) => set({ loading }),
  clearMessages: () => set({ messages: [] }),

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

      const res = (await window.compass.engine.call("/chat", {
        workspace_path: workspacePath,
        message: content,
        history,
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
    }
  },
}));
