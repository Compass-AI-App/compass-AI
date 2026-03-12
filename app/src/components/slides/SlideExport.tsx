import { useState } from "react";
import { Download, ChevronDown, Globe, FileDown } from "lucide-react";
import type { PresentationData } from "./SlideRenderer";
import type { ContentBlock } from "./SlideLayouts";

interface SlideExportProps {
  presentation: PresentationData;
}

function blockToHtml(block: ContentBlock): string {
  switch (block.type) {
    case "heading":
      return `<h2 style="font-size:1.5em;margin-bottom:0.5em;">${block.content}</h2>`;
    case "text":
      return `<p style="margin-bottom:0.5em;color:#e0e0e0;">${block.content}</p>`;
    case "bullet_list":
      return `<ul style="margin-bottom:0.5em;">${(block.items || []).map((item) => `<li style="margin-bottom:0.3em;color:#e0e0e0;">${item}</li>`).join("")}</ul>`;
    case "quote":
      return `<blockquote style="border-left:3px solid #6366f1;padding-left:1em;font-style:italic;color:#a0a0a0;">${block.content}</blockquote>`;
    case "chart_spec":
      return `<div style="background:#1a1a2e;border-radius:8px;padding:1.5em;text-align:center;border:1px solid #333;"><p style="color:#6366f1;">📊 ${block.content}</p></div>`;
    case "image_placeholder":
      return `<div style="background:#1a1a2e;border-radius:8px;padding:2em;text-align:center;border:2px dashed #333;"><p style="color:#666;">${block.content}</p></div>`;
    case "evidence_citation":
      return `<span style="background:rgba(99,102,241,0.15);color:#818cf8;border-radius:3px;padding:2px 6px;font-size:0.85em;">${block.content}</span>`;
    default:
      return `<p>${block.content}</p>`;
  }
}

function presentationToHtml(presentation: PresentationData): string {
  const slides = presentation.slides
    .map((slide, i) => {
      const blocksHtml = slide.content_blocks.map(blockToHtml).join("\n      ");
      const isTitle = slide.layout === "title";

      return `
    <div class="slide" style="
      page-break-after: always;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      ${isTitle ? "justify-content: center; align-items: center; text-align: center;" : ""}
      padding: 60px 80px;
      box-sizing: border-box;
      position: relative;
    ">
      ${slide.title ? `<h1 style="font-size:${isTitle ? "2.5em" : "2em"};margin-bottom:1em;color:#f0f0f0;">${slide.title}</h1>` : ""}
      ${blocksHtml}
      <div style="position:absolute;bottom:30px;right:40px;font-size:0.8em;color:#444;">${i + 1} / ${presentation.slides.length}</div>
    </div>`;
    })
    .join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${presentation.title}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f0f1a; color: #e0e0e0; }
    .slide { background: #16162a; }
    .slide + .slide { border-top: 1px solid #222; }
    @media print {
      .slide { page-break-after: always; }
    }
    @media screen {
      .controls { position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%); display: flex; gap: 12px; z-index: 100; }
      .controls button { padding: 8px 16px; background: #6366f1; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 14px; }
      .controls button:hover { background: #4f46e5; }
    }
  </style>
</head>
<body>
${slides}
<div class="controls">
  <button onclick="window.scrollBy(0,-window.innerHeight)">Previous</button>
  <button onclick="window.scrollBy(0,window.innerHeight)">Next</button>
</div>
</body>
</html>`;
}

function presentationToPdfHtml(presentation: PresentationData): string {
  // Same as regular HTML but optimized for print
  return presentationToHtml(presentation).replace(
    "@media screen {",
    "@media screen { .controls { display: none; } } @media never {",
  );
}

export default function SlideExport({ presentation }: SlideExportProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [exporting, setExporting] = useState(false);

  const slug = presentation.title
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");

  async function exportAs(format: "html" | "pdf") {
    setExporting(true);
    setShowMenu(false);

    try {
      if (format === "html") {
        const html = presentationToHtml(presentation);
        await window.compass?.app.exportDocument(
          `${slug}.html`,
          html,
          "html",
        );
      } else {
        const html = presentationToPdfHtml(presentation);
        await window.compass?.app.exportDocument(
          `${slug}.pdf`,
          html,
          "pdf",
        );
      }
    } catch (err) {
      console.error("Slide export failed:", err);
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
        <Download className="w-4 h-4" />
        Export
        <ChevronDown className="w-3 h-3" />
      </button>

      {showMenu && !exporting && (
        <div className="absolute top-full right-0 mt-1 w-44 bg-compass-card border border-compass-border rounded-lg shadow-xl z-50 overflow-hidden">
          <div className="py-1">
            <button
              onClick={() => exportAs("html")}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-compass-muted hover:text-compass-text hover:bg-white/5 transition-colors"
            >
              <Globe className="w-4 h-4" />
              HTML (.html)
            </button>
            <button
              onClick={() => exportAs("pdf")}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-compass-muted hover:text-compass-text hover:bg-white/5 transition-colors"
            >
              <FileDown className="w-4 h-4" />
              PDF (.pdf)
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
