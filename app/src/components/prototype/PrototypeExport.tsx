import { useState } from "react";
import { Download, ChevronDown, Globe, Image, FileCode, Link2, Loader2 } from "lucide-react";

interface PrototypeExportProps {
  html: string;
  title: string;
}

export default function PrototypeExport({ html, title }: PrototypeExportProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [showShareResult, setShowShareResult] = useState(false);

  const slug = title
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");

  async function exportHtml() {
    setExporting(true);
    setShowMenu(false);
    try {
      await window.compass?.app.exportDocument(`${slug}.html`, html, "html");
    } catch (err) {
      console.error("HTML export failed:", err);
    } finally {
      setExporting(false);
    }
  }

  async function exportPng() {
    setExporting(true);
    setShowMenu(false);
    try {
      await window.compass?.app.captureHtmlPng(html, `${slug}.png`);
    } catch (err) {
      console.error("PNG export failed:", err);
    } finally {
      setExporting(false);
    }
  }

  async function shareToCloud() {
    setExporting(true);
    setShowMenu(false);
    try {
      const cloudUrl = localStorage.getItem("compass-cloud-url") || "https://compass.dev";
      const token = localStorage.getItem("compass-cloud-token");
      if (!token) {
        console.error("No cloud token — sign in first");
        return;
      }

      const res = await fetch(`${cloudUrl}/documents/share`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title,
          content: html,
          doc_type: "prototype",
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const url = `${cloudUrl}/d/${data.doc_id}`;
        setShareUrl(url);
        setShowShareResult(true);
        await navigator.clipboard.writeText(url);
      }
    } catch (err) {
      console.error("Cloud share failed:", err);
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="relative">
      <button
        onClick={() => setShowMenu(!showMenu)}
        disabled={exporting}
        className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-compass-muted hover:text-compass-text hover:bg-white/5 rounded-lg transition-colors"
      >
        {exporting ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Download className="w-4 h-4" />
        )}
        Export
        <ChevronDown className="w-3 h-3" />
      </button>

      {showMenu && !exporting && (
        <div className="absolute top-full right-0 mt-1 w-48 bg-compass-card border border-compass-border rounded-lg shadow-xl z-50 overflow-hidden">
          <div className="py-1">
            <button
              onClick={exportHtml}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-compass-muted hover:text-compass-text hover:bg-white/5 transition-colors"
            >
              <FileCode className="w-4 h-4" />
              HTML (.html)
            </button>
            <button
              onClick={exportPng}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-compass-muted hover:text-compass-text hover:bg-white/5 transition-colors"
            >
              <Image className="w-4 h-4" />
              PNG Screenshot
            </button>
            <button
              onClick={shareToCloud}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-compass-muted hover:text-compass-text hover:bg-white/5 transition-colors"
            >
              <Globe className="w-4 h-4" />
              Share Link (Cloud)
            </button>
          </div>
        </div>
      )}

      {showShareResult && shareUrl && (
        <div className="absolute top-full right-0 mt-1 w-64 bg-compass-card border border-compass-border rounded-lg shadow-xl z-50 p-3">
          <div className="flex items-center gap-2 mb-2">
            <Link2 className="w-4 h-4 text-compass-accent" />
            <span className="text-sm font-medium text-compass-text">Link copied!</span>
          </div>
          <p className="text-xs text-compass-muted break-all">{shareUrl}</p>
          <button
            onClick={() => setShowShareResult(false)}
            className="mt-2 text-xs text-compass-muted hover:text-compass-text transition-colors"
          >
            Close
          </button>
        </div>
      )}
    </div>
  );
}
