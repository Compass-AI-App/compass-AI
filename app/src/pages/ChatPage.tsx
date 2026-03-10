import { useState, useRef, useEffect } from "react";
import { MessageCircle, Send, Loader2, Trash2, Database } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { clsx } from "clsx";
import { useWorkspaceStore } from "../stores/workspace";
import { useChatStore, type AgentMode } from "../stores/chat";
import { useStreamingChat } from "../hooks/useStreamingChat";

const sourceColors: Record<string, string> = {
  code: "text-compass-code",
  docs: "text-compass-docs",
  data: "text-compass-data",
  judgment: "text-compass-judgment",
};

const agentModes: { id: AgentMode; label: string }[] = [
  { id: "default", label: "Default" },
  { id: "thought-partner", label: "Thought Partner" },
  { id: "technical-analyst", label: "Technical Analyst" },
  { id: "devils-advocate", label: "Devil's Advocate" },
];

export default function ChatPage() {
  const workspacePath = useWorkspaceStore((s) => s.workspacePath);
  const { messages, loading, agentMode, clearMessages, setAgentMode, loadHistory } =
    useChatStore();
  const { sendStreaming } = useStreamingChat();
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (workspacePath) {
      loadHistory(workspacePath);
    }
  }, [workspacePath, loadHistory]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  function handleSend() {
    if (!input.trim() || !workspacePath || loading) return;
    sendStreaming(workspacePath, input.trim());
    setInput("");
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-8 py-4 border-b border-compass-border shrink-0">
        <MessageCircle className="w-5 h-5 text-compass-accent" />
        <h1 className="text-lg font-semibold text-compass-text">Chat</h1>
        <span className="text-xs text-compass-muted">Ask questions grounded in your evidence</span>
        {messages.length > 0 && (
          <button
            onClick={clearMessages}
            className="ml-auto text-compass-muted hover:text-compass-text transition-colors"
            title="Clear chat"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Agent Mode Selector */}
      <div className="flex gap-2 px-8 py-2 border-b border-compass-border shrink-0">
        {agentModes.map((mode) => (
          <button
            key={mode.id}
            onClick={() => setAgentMode(mode.id)}
            className={clsx(
              "px-3 py-1 rounded-full text-xs transition-colors",
              agentMode === mode.id
                ? "bg-compass-accent text-white"
                : "bg-compass-card border border-compass-border text-compass-muted hover:text-compass-text"
            )}
          >
            {mode.label}
          </button>
        ))}
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-8 py-4 space-y-4">
        {messages.length === 0 && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center max-w-sm">
              <MessageCircle className="w-10 h-10 text-compass-muted mx-auto mb-3" />
              <p className="text-compass-muted text-sm">
                Ask anything about your product. Compass will answer based on your ingested evidence.
              </p>
              <div className="mt-4 space-y-2">
                {[
                  "What are users most frustrated about?",
                  "Where do our docs disagree with reality?",
                  "What should we prioritize next quarter?",
                ].map((q) => (
                  <button
                    key={q}
                    onClick={() => {
                      setInput(q);
                    }}
                    className="block w-full text-left px-3 py-2 rounded-lg bg-compass-card border border-compass-border text-sm text-compass-muted hover:text-compass-text hover:border-compass-accent/30 transition-colors"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={clsx("flex", msg.role === "user" ? "justify-end" : "justify-start")}
          >
            <div
              className={clsx(
                "max-w-[80%] rounded-xl px-4 py-3",
                msg.role === "user"
                  ? "bg-compass-accent text-white"
                  : "bg-compass-card border border-compass-border"
              )}
            >
              {msg.role === "assistant" ? (
                <div className="prose prose-invert prose-sm max-w-none prose-p:text-neutral-300 prose-strong:text-compass-text prose-li:text-neutral-300">
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                </div>
              ) : (
                <p className="text-sm">{msg.content}</p>
              )}

              {/* Citations */}
              {msg.citations && msg.citations.length > 0 && (
                <div className="mt-2 pt-2 border-t border-compass-border">
                  <div className="flex items-center gap-1 mb-1">
                    <Database className="w-3 h-3 text-compass-muted" />
                    <span className="text-xs text-compass-muted">Sources</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {msg.citations.map((c) => (
                      <span
                        key={c.id}
                        className={clsx(
                          "text-xs px-1.5 py-0.5 rounded bg-white/5",
                          sourceColors[c.source_type] || "text-compass-muted"
                        )}
                        title={c.title}
                      >
                        {c.title.length > 30 ? c.title.slice(0, 30) + "..." : c.title}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-compass-card border border-compass-border rounded-xl px-4 py-3">
              <Loader2 className="w-4 h-4 animate-spin text-compass-muted" />
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="px-8 py-4 border-t border-compass-border shrink-0">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder={workspacePath ? "Ask about your product..." : "Open a workspace first"}
            disabled={!workspacePath || loading}
            className="flex-1 px-4 py-2.5 rounded-lg bg-compass-card border border-compass-border text-sm text-compass-text placeholder:text-neutral-600 focus:outline-none focus:ring-1 focus:ring-compass-accent disabled:opacity-50"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || !workspacePath || loading}
            className={clsx(
              "p-2.5 rounded-lg transition-colors",
              input.trim() && workspacePath && !loading
                ? "bg-compass-accent hover:bg-compass-accent-hover text-white"
                : "bg-neutral-800 text-neutral-500"
            )}
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
