import { useState } from "react";
import { Share2, Copy, Check, Lock } from "lucide-react";
import { clsx } from "clsx";
const CLOUD_TOKEN_KEY = "compass-cloud-token";
const CLOUD_URL_KEY = "compass-cloud-url";
const DEFAULT_CLOUD_URL = "https://api.compass.dev";

interface ShareButtonProps {
  title: string;
  docType: string;
  markdown: string;
  html?: string;
}

export default function ShareButton({
  title,
  docType,
  markdown,
  html,
}: ShareButtonProps) {
  const [showModal, setShowModal] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [usePassword, setUsePassword] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cloudToken = localStorage.getItem(CLOUD_TOKEN_KEY);
  const cloudUrl = localStorage.getItem(CLOUD_URL_KEY) || DEFAULT_CLOUD_URL;

  async function handleShare() {
    if (!cloudToken || !cloudUrl) {
      setError("Sign in to Compass Cloud to share documents");
      return;
    }

    setSharing(true);
    setError(null);

    try {
      const res = await fetch(`${cloudUrl}/documents/share`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${cloudToken}`,
        },
        body: JSON.stringify({
          title,
          doc_type: docType,
          content_markdown: markdown,
          content_html: html || "",
          password: usePassword ? password : null,
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to share document");
      }

      const data = (await res.json()) as { id: string; url: string };
      const fullUrl = `${cloudUrl}${data.url}`;
      setShareUrl(fullUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Share failed");
    } finally {
      setSharing(false);
    }
  }

  async function handleCopy() {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-compass-muted hover:text-compass-text hover:bg-white/5 rounded-lg transition-colors"
      >
        <Share2 className="w-4 h-4" />
        Share
      </button>

      {showModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-compass-card border border-compass-border rounded-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-compass-text mb-4">
              Share Document
            </h3>

            {shareUrl ? (
              <div className="space-y-4">
                <p className="text-sm text-compass-muted">
                  Your document is shared! Copy the link below:
                </p>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={shareUrl}
                    readOnly
                    className="flex-1 px-3 py-2 rounded-lg bg-compass-bg border border-compass-border text-compass-text text-sm"
                  />
                  <button
                    onClick={handleCopy}
                    className="p-2 rounded-lg bg-compass-accent text-white hover:bg-compass-accent/90 transition-colors"
                  >
                    {copied ? (
                      <Check className="w-4 h-4" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>
                </div>
                {usePassword && (
                  <p className="text-xs text-compass-muted flex items-center gap-1">
                    <Lock className="w-3 h-3" />
                    Password protected
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-compass-muted">
                  Share &quot;{title}&quot; via a link. Anyone with the link can
                  view it.
                </p>

                <label className="flex items-center gap-2 text-sm text-compass-muted">
                  <input
                    type="checkbox"
                    checked={usePassword}
                    onChange={(e) => setUsePassword(e.target.checked)}
                    className="rounded"
                  />
                  Password protect
                </label>

                {usePassword && (
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter password"
                    className="w-full px-3 py-2 rounded-lg bg-compass-bg border border-compass-border text-compass-text text-sm focus:outline-none focus:border-compass-accent"
                  />
                )}

                {error && (
                  <p className="text-sm text-red-400">{error}</p>
                )}
              </div>
            )}

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => {
                  setShowModal(false);
                  setShareUrl(null);
                  setError(null);
                }}
                className="px-4 py-2 text-sm text-compass-muted hover:text-compass-text transition-colors"
              >
                {shareUrl ? "Done" : "Cancel"}
              </button>
              {!shareUrl && (
                <button
                  onClick={handleShare}
                  disabled={sharing}
                  className={clsx(
                    "px-4 py-2 text-sm rounded-lg transition-colors",
                    "bg-compass-accent text-white hover:bg-compass-accent/90",
                    sharing && "opacity-50",
                  )}
                >
                  {sharing ? "Sharing..." : "Create Link"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
