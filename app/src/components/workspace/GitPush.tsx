import { useState } from "react";
import { Github, ExternalLink, Lock, Globe } from "lucide-react";
import { clsx } from "clsx";

interface GitPushProps {
  workspacePath: string;
  productName: string;
}

export default function GitPush({ workspacePath, productName }: GitPushProps) {
  const [repoName, setRepoName] = useState(
    productName.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-")
  );
  const [isPrivate, setIsPrivate] = useState(true);
  const [pushing, setPushing] = useState(false);
  const [result, setResult] = useState<{ repo_url?: string; error?: string } | null>(null);

  async function handlePush() {
    if (!repoName.trim()) return;
    setPushing(true);
    setResult(null);

    try {
      const res = (await window.compass.engine.call("/git/push", {
        workspace_path: workspacePath,
        repo_name: repoName.trim(),
        private: isPrivate,
      })) as { status: string; repo_url?: string; error?: string };

      if (res.status === "ok") {
        setResult({ repo_url: res.repo_url });
      } else {
        setResult({ error: res.error || "Push failed" });
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Push failed";
      setResult({ error: message });
    } finally {
      setPushing(false);
    }
  }

  if (result?.repo_url) {
    return (
      <div className="rounded-lg bg-green-500/10 border border-green-500/20 p-4">
        <div className="flex items-center gap-2 mb-2">
          <Github className="w-4 h-4 text-green-400" />
          <span className="text-sm font-medium text-green-400">Pushed to GitHub</span>
        </div>
        <a
          href={result.repo_url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-sm text-compass-accent hover:underline"
        >
          {result.repo_url}
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>
    );
  }

  return (
    <div className="rounded-lg bg-compass-card border border-compass-border p-4">
      <div className="flex items-center gap-2 mb-3">
        <Github className="w-4 h-4 text-compass-muted" />
        <span className="text-sm font-medium text-compass-text">Push to GitHub</span>
      </div>

      <div className="space-y-3">
        <div>
          <label className="block text-xs text-compass-muted mb-1">Repository name</label>
          <input
            type="text"
            value={repoName}
            onChange={(e) => setRepoName(e.target.value)}
            placeholder="my-product"
            className="w-full px-3 py-1.5 rounded-lg bg-compass-bg border border-compass-border text-compass-text text-sm placeholder:text-neutral-600 focus:outline-none focus:ring-1 focus:ring-compass-accent"
          />
        </div>

        <button
          onClick={() => setIsPrivate(!isPrivate)}
          className="flex items-center gap-2 text-xs text-compass-muted hover:text-compass-text transition-colors"
        >
          {isPrivate ? (
            <Lock className="w-3 h-3" />
          ) : (
            <Globe className="w-3 h-3" />
          )}
          {isPrivate ? "Private repository" : "Public repository"}
        </button>

        {result?.error && (
          <p className="text-xs text-red-400">{result.error}</p>
        )}

        <button
          onClick={handlePush}
          disabled={!repoName.trim() || pushing}
          className={clsx(
            "w-full py-2 rounded-lg text-sm font-medium transition-colors",
            repoName.trim() && !pushing
              ? "bg-compass-accent hover:bg-compass-accent-hover text-white"
              : "bg-neutral-800 text-neutral-500 cursor-not-allowed"
          )}
        >
          {pushing ? "Pushing..." : "Create & Push"}
        </button>
      </div>
    </div>
  );
}
