import { useState } from "react";
import { MessageCircle, X, Send, Check } from "lucide-react";
import { clsx } from "clsx";

type FeedbackType = "bug" | "feature" | "general";

interface FeedbackEntry {
  type: FeedbackType;
  message: string;
  timestamp: string;
  appVersion: string;
}

const FEEDBACK_KEY = "compass-feedback";
const TYPES: { value: FeedbackType; label: string }[] = [
  { value: "bug", label: "Bug" },
  { value: "feature", label: "Feature Request" },
  { value: "general", label: "General" },
];

function saveFeedback(entry: FeedbackEntry) {
  try {
    const existing = JSON.parse(localStorage.getItem(FEEDBACK_KEY) || "[]");
    existing.push(entry);
    localStorage.setItem(FEEDBACK_KEY, JSON.stringify(existing));
  } catch {
    // ignore
  }
}

export function exportFeedback(): string {
  try {
    const entries: FeedbackEntry[] = JSON.parse(localStorage.getItem(FEEDBACK_KEY) || "[]");
    if (entries.length === 0) return "No feedback submitted yet.";

    const lines = ["# Compass Feedback Export", "", `Total: ${entries.length} entries`, ""];
    for (const entry of entries) {
      lines.push(`## [${entry.type.toUpperCase()}] ${entry.timestamp}`);
      lines.push("");
      lines.push(entry.message);
      lines.push("");
      lines.push(`_App version: ${entry.appVersion}_`);
      lines.push("");
      lines.push("---");
      lines.push("");
    }
    return lines.join("\n");
  } catch {
    return "Error reading feedback.";
  }
}

export default function FeedbackButton() {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<FeedbackType>("general");
  const [message, setMessage] = useState("");
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit() {
    if (!message.trim()) return;

    saveFeedback({
      type,
      message: message.trim(),
      timestamp: new Date().toISOString(),
      appVersion: "0.1.0",
    });

    setSubmitted(true);
    setTimeout(() => {
      setSubmitted(false);
      setOpen(false);
      setMessage("");
      setType("general");
    }, 1500);
  }

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-40 w-10 h-10 rounded-full bg-compass-accent hover:bg-compass-accent-hover text-white flex items-center justify-center shadow-lg transition-colors"
      >
        <MessageCircle className="w-5 h-5" />
      </button>

      {/* Modal */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-end p-6">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="relative w-80 rounded-xl bg-compass-sidebar border border-compass-border shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-compass-border">
              <h3 className="text-sm font-medium text-compass-text">Send Feedback</h3>
              <button onClick={() => setOpen(false)} className="text-compass-muted hover:text-compass-text">
                <X className="w-4 h-4" />
              </button>
            </div>

            {submitted ? (
              <div className="px-4 py-8 text-center">
                <Check className="w-8 h-8 text-green-400 mx-auto mb-2" />
                <p className="text-sm text-compass-text">Thank you for your feedback!</p>
              </div>
            ) : (
              <div className="p-4 space-y-3">
                {/* Type selector */}
                <div className="flex gap-2">
                  {TYPES.map((t) => (
                    <button
                      key={t.value}
                      onClick={() => setType(t.value)}
                      className={clsx(
                        "px-3 py-1 rounded-full text-xs font-medium transition-colors",
                        type === t.value
                          ? "bg-compass-accent text-white"
                          : "bg-compass-card border border-compass-border text-compass-muted hover:text-compass-text"
                      )}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>

                {/* Message */}
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="What's on your mind?"
                  rows={4}
                  className="w-full px-3 py-2 rounded-lg bg-compass-card border border-compass-border text-sm text-compass-text placeholder:text-neutral-600 focus:outline-none focus:border-compass-accent resize-none"
                />

                {/* Submit */}
                <button
                  onClick={handleSubmit}
                  disabled={!message.trim()}
                  className={clsx(
                    "w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                    message.trim()
                      ? "bg-compass-accent hover:bg-compass-accent-hover text-white"
                      : "bg-compass-card text-neutral-600 cursor-not-allowed"
                  )}
                >
                  <Send className="w-3.5 h-3.5" />
                  Submit
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
