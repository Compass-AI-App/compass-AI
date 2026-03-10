import { useEffect, useRef, useCallback } from "react";
import { useChatStore } from "../stores/chat";

/**
 * Hook for streaming chat responses from the engine via SSE.
 * Falls back to non-streaming /chat endpoint if stream is unavailable.
 */
export function useStreamingChat() {
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    return () => {
      cleanupRef.current?.();
    };
  }, []);

  const sendStreaming = useCallback(
    async (workspacePath: string, content: string) => {
      const store = useChatStore.getState();
      const messages = store.messages;

      const userMsg = {
        id: `msg-${Date.now()}`,
        role: "user" as const,
        content,
        timestamp: Date.now(),
      };
      store.addMessage(userMsg);
      store.setLoading(true);

      const assistantId = `msg-${Date.now()}-a`;
      let accumulatedText = "";

      // Add placeholder assistant message
      store.addMessage({
        id: assistantId,
        role: "assistant",
        content: "",
        timestamp: Date.now(),
      });

      // Set up stream data listener
      const cleanup = window.compass?.engine.onStreamData((raw: string) => {
        try {
          const data = JSON.parse(raw);

          if (data.token) {
            accumulatedText += data.token;
            // Update the last message in place
            const state = useChatStore.getState();
            const msgs = [...state.messages];
            const idx = msgs.findIndex((m) => m.id === assistantId);
            if (idx >= 0) {
              msgs[idx] = { ...msgs[idx], content: accumulatedText };
              useChatStore.setState({ messages: msgs });
            }
          }

          if (data.done) {
            store.setLoading(false);
            cleanup?.();
          }

          if (data.citations) {
            const state = useChatStore.getState();
            const msgs = [...state.messages];
            const idx = msgs.findIndex((m) => m.id === assistantId);
            if (idx >= 0) {
              msgs[idx] = { ...msgs[idx], citations: data.citations };
              useChatStore.setState({ messages: msgs });
            }
          }
        } catch {
          // ignore parse errors from partial data
        }
      });
      cleanupRef.current = cleanup || null;

      const history = messages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      try {
        await window.compass.engine.stream("/chat/stream", {
          workspace_path: workspacePath,
          message: content,
          history,
        });
      } catch {
        // If streaming fails, show error in assistant message
        store.setLoading(false);
        cleanup?.();
        if (!accumulatedText) {
          const state = useChatStore.getState();
          const msgs = [...state.messages];
          const idx = msgs.findIndex((m) => m.id === assistantId);
          if (idx >= 0) {
            msgs[idx] = {
              ...msgs[idx],
              content: "Failed to get a response. Please check that the engine is running and try again.",
            };
            useChatStore.setState({ messages: msgs });
          }
        }
      }
    },
    []
  );

  return { sendStreaming };
}
