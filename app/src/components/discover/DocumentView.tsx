import { useState } from "react";
import { X, Copy, ClipboardCheck, Download } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { clsx } from "clsx";

interface Props {
  title: string;
  markdown: string;
  onClose: () => void;
}

export default function DocumentView({ title, markdown, onClose }: Props) {
  const [copied, setCopied] = useState(false);

  async function copyToClipboard() {
    await navigator.clipboard.writeText(markdown);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleSave() {
    await window.compass?.app.saveFile(
      `${title.toLowerCase().replace(/\s+/g, "-")}.md`,
      markdown
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />

      {/* Panel */}
      <div className="relative ml-auto w-full max-w-2xl h-full bg-compass-bg border-l border-compass-border flex flex-col">
        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-compass-border shrink-0">
          <h2 className="text-lg font-semibold text-compass-text flex-1 truncate">{title}</h2>
          <button
            onClick={copyToClipboard}
            className={clsx(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
              copied
                ? "bg-green-500/20 text-green-400"
                : "bg-compass-accent hover:bg-compass-accent-hover text-white"
            )}
          >
            {copied ? (
              <ClipboardCheck className="w-3.5 h-3.5" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
            {copied ? "Copied" : "Copy"}
          </button>
          <button
            onClick={handleSave}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-compass-border text-compass-muted hover:text-compass-text transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            Save .md
          </button>
          <button onClick={onClose} className="text-compass-muted hover:text-compass-text">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Markdown content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <div className="prose prose-invert prose-sm max-w-none prose-headings:text-compass-text prose-p:text-neutral-400 prose-strong:text-compass-text prose-li:text-neutral-400 prose-code:text-compass-accent prose-pre:bg-compass-card prose-pre:border prose-pre:border-compass-border">
            <ReactMarkdown>{markdown}</ReactMarkdown>
          </div>
        </div>
      </div>
    </div>
  );
}
