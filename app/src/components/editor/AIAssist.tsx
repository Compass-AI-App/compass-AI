import { useState } from "react";
import type { Editor } from "@tiptap/react";
import { Sparkles, ChevronDown, Loader2 } from "lucide-react";
import { clsx } from "clsx";

interface AIAssistProps {
  editor: Editor | null;
  workspacePath: string;
  docType?: string;
}

type AIAction = {
  label: string;
  prompt: string;
  usesSelection?: boolean;
};

const AI_ACTIONS: AIAction[] = [
  { label: "Continue writing", prompt: "Continue writing from where the text left off. Maintain the same style and tone." },
  { label: "Expand this section", prompt: "Expand the following section with more detail, examples, and evidence:", usesSelection: true },
  { label: "Add evidence", prompt: "Add supporting evidence and citations for the following claim:", usesSelection: true },
  { label: "Summarize", prompt: "Summarize the following text concisely:", usesSelection: true },
  { label: "Improve writing", prompt: "Improve the clarity and professionalism of the following text:", usesSelection: true },
  { label: "Generate brief outline", prompt: "Generate a product brief outline with sections: Problem Statement, Target Audience, Proposed Solution, Requirements, Success Metrics, and Risks." },
  { label: "Add requirements", prompt: "Generate a prioritized list of product requirements (P0, P1, P2) based on the document context." },
];

function markdownToTiptapContent(markdown: string): string {
  // Return markdown as-is — Tiptap's StarterKit can parse it via insertContent
  // For more complex conversion, this could be expanded
  return markdown;
}

export default function AIAssist({ editor, workspacePath, docType }: AIAssistProps) {
  const [loading, setLoading] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [customPrompt, setCustomPrompt] = useState("");
  const [showCustom, setShowCustom] = useState(false);

  if (!editor) return null;

  async function runAIAction(action: AIAction) {
    if (!editor || !workspacePath) return;

    setLoading(true);
    setShowMenu(false);

    try {
      const { from, to } = editor.state.selection;
      const selectedText = editor.state.doc.textBetween(from, to, "\n");

      let prompt = action.prompt;
      if (action.usesSelection && selectedText) {
        prompt = `${action.prompt}\n\n${selectedText}`;
      }

      // Get full document context
      const fullText = editor.state.doc.textContent;
      const contextSnippet = fullText.slice(0, 2000);

      const fullPrompt = `[Document type: ${docType || "custom"}]\n[Current document excerpt: ${contextSnippet.slice(0, 500)}]\n\n${prompt}`;
      const res = (await window.compass.engine.call("/chat", {
        workspace_path: workspacePath,
        message: fullPrompt,
        agent_mode: "writer",
      })) as { status: string; reply: string };

      if (res.status === "ok" && res.reply) {
        const content = markdownToTiptapContent(res.reply);
        if (action.usesSelection && selectedText) {
          // Replace selection
          editor.chain().focus().deleteSelection().insertContent(content).run();
        } else {
          // Insert at cursor position
          editor.chain().focus().insertContent(content).run();
        }
      }
    } catch (err) {
      console.error("AI assist failed:", err);
    } finally {
      setLoading(false);
    }
  }

  async function runCustomPrompt() {
    if (!customPrompt.trim()) return;
    await runAIAction({ label: "Custom", prompt: customPrompt });
    setCustomPrompt("");
    setShowCustom(false);
  }

  async function generateBrief() {
    if (!editor || !workspacePath) return;
    setLoading(true);
    setShowMenu(false);

    try {
      const title = editor.state.doc.firstChild?.textContent || "Product";
      const res = (await window.compass.engine.call("/write/brief", {
        workspace_path: workspacePath,
        opportunity_title: title,
        description: "",
        evidence_summary: "",
      })) as { status: string; brief: { to_markdown?: string; problem_statement?: string; [key: string]: unknown } };

      if (res.status === "ok" && res.brief) {
        // The brief comes back as a ProductBrief object — build markdown
        const b = res.brief;
        const lines: string[] = [];
        if (b.problem_statement) lines.push(`## Problem Statement\n\n${b.problem_statement}\n`);
        if (b.target_audience) lines.push(`## Target Audience\n\n${b.target_audience}\n`);
        if (b.proposed_solution) lines.push(`## Proposed Solution\n\n${b.proposed_solution}\n`);
        if (Array.isArray(b.requirements) && b.requirements.length > 0) {
          lines.push("## Requirements\n");
          for (const req of b.requirements as Array<{ priority?: string; description?: string }>) {
            lines.push(`- **[${req.priority || "P1"}]** ${req.description || ""}`);
          }
          lines.push("");
        }
        if (Array.isArray(b.success_metrics) && b.success_metrics.length > 0) {
          lines.push("## Success Metrics\n");
          for (const m of b.success_metrics as string[]) lines.push(`- ${m}`);
          lines.push("");
        }
        if (Array.isArray(b.risks) && b.risks.length > 0) {
          lines.push("## Risks\n");
          for (const r of b.risks as string[]) lines.push(`- ${r}`);
          lines.push("");
        }

        const markdown = lines.join("\n");
        editor.chain().focus().insertContent(markdown).run();
      }
    } catch (err) {
      console.error("Brief generation failed:", err);
    } finally {
      setLoading(false);
    }
  }

  const hasSelection = editor.state.selection.from !== editor.state.selection.to;
  const visibleActions = AI_ACTIONS.filter(
    (a) => !a.usesSelection || hasSelection,
  );

  return (
    <div className="relative">
      <button
        onClick={() => setShowMenu(!showMenu)}
        disabled={loading}
        className={clsx(
          "flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg transition-colors",
          loading
            ? "bg-compass-accent/20 text-compass-accent"
            : "text-compass-muted hover:text-compass-accent hover:bg-compass-accent/10",
        )}
      >
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Sparkles className="w-4 h-4" />
        )}
        {loading ? "Generating..." : "AI Assist"}
        {!loading && <ChevronDown className="w-3 h-3" />}
      </button>

      {showMenu && !loading && (
        <div className="absolute top-full left-0 mt-1 w-64 bg-compass-card border border-compass-border rounded-lg shadow-xl z-50 overflow-hidden">
          <div className="py-1">
            {visibleActions.map((action) => (
              <button
                key={action.label}
                onClick={() => runAIAction(action)}
                className="w-full text-left px-3 py-2 text-sm text-compass-muted hover:text-compass-text hover:bg-white/5 transition-colors"
              >
                {action.label}
              </button>
            ))}

            {(docType === "brief" || docType === "prd") && (
              <button
                onClick={generateBrief}
                className="w-full text-left px-3 py-2 text-sm text-compass-accent hover:bg-compass-accent/10 transition-colors border-t border-compass-border"
              >
                Generate full brief from evidence
              </button>
            )}

            <div className="border-t border-compass-border">
              {showCustom ? (
                <div className="p-2">
                  <input
                    type="text"
                    value={customPrompt}
                    onChange={(e) => setCustomPrompt(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && runCustomPrompt()}
                    placeholder="Custom instruction..."
                    autoFocus
                    className="w-full px-2 py-1.5 text-sm bg-compass-bg border border-compass-border rounded text-compass-text focus:outline-none focus:border-compass-accent"
                  />
                </div>
              ) : (
                <button
                  onClick={() => setShowCustom(true)}
                  className="w-full text-left px-3 py-2 text-sm text-compass-muted hover:text-compass-text hover:bg-white/5 transition-colors"
                >
                  Custom instruction...
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
