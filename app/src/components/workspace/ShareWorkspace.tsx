import { useState, useEffect } from "react";
import { Share2, UserPlus, X, Trash2, Loader2, Copy, Check } from "lucide-react";

interface Member {
  email: string;
  role: string;
}

interface TeamWorkspace {
  id: string;
  name: string;
  description: string;
  owner_email: string;
  members: string[];
  member_access: Member[];
}

interface ShareWorkspaceProps {
  workspaceName: string;
  workspaceDescription: string;
}

export default function ShareWorkspace({
  workspaceName,
  workspaceDescription,
}: ShareWorkspaceProps) {
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [teamWorkspace, setTeamWorkspace] = useState<TeamWorkspace | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"read" | "write">("read");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  const cloudUrl = localStorage.getItem("compass-cloud-url") || "https://compass.dev";
  const token = localStorage.getItem("compass-cloud-token");

  async function cloudFetch(path: string, options?: RequestInit) {
    const res = await fetch(`${cloudUrl}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...options?.headers,
      },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "Request failed" }));
      throw new Error(err.detail || "Request failed");
    }
    return res.json();
  }

  async function handleOpen() {
    setShowModal(true);
    if (!token) return;

    setLoading(true);
    setError("");
    try {
      // Check for existing shared workspace
      const workspaces = (await cloudFetch("/teams/workspaces")) as TeamWorkspace[];
      const existing = workspaces.find((w) => w.name === workspaceName);
      if (existing) {
        setTeamWorkspace(existing);
      }
    } catch {
      // No existing workspace, that's fine
    }
    setLoading(false);
  }

  async function handleCreate() {
    setLoading(true);
    setError("");
    try {
      const ws = await cloudFetch("/teams/workspaces", {
        method: "POST",
        body: JSON.stringify({
          name: workspaceName,
          description: workspaceDescription,
        }),
      });
      setTeamWorkspace(ws);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to share workspace");
    }
    setLoading(false);
  }

  async function handleInvite() {
    if (!inviteEmail.trim() || !teamWorkspace) return;
    setError("");
    try {
      await cloudFetch(`/teams/workspaces/${teamWorkspace.id}/invite`, {
        method: "POST",
        body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole }),
      });
      // Refresh workspace
      const ws = await cloudFetch(`/teams/workspaces/${teamWorkspace.id}`);
      setTeamWorkspace(ws);
      setInviteEmail("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to invite");
    }
  }

  async function handleRemove(email: string) {
    if (!teamWorkspace) return;
    try {
      await cloudFetch(`/teams/workspaces/${teamWorkspace.id}/members/${email}`, {
        method: "DELETE",
      });
      const ws = await cloudFetch(`/teams/workspaces/${teamWorkspace.id}`);
      setTeamWorkspace(ws);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove member");
    }
  }

  function handleCopyLink() {
    if (teamWorkspace) {
      navigator.clipboard.writeText(`${cloudUrl}/workspace/${teamWorkspace.id}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  if (!token) {
    return (
      <button
        disabled
        title="Sign in to share workspaces"
        className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-compass-muted/50 cursor-not-allowed"
      >
        <Share2 className="w-4 h-4" />
        Share
      </button>
    );
  }

  return (
    <>
      <button
        onClick={handleOpen}
        className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-compass-muted hover:text-compass-text hover:bg-white/5 rounded-lg transition-colors"
      >
        <Share2 className="w-4 h-4" />
        Share
      </button>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-compass-card border border-compass-border rounded-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-compass-text">
                Share Workspace
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="p-1 text-compass-muted hover:text-compass-text transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {error && (
              <p className="text-sm text-red-400 mb-3">{error}</p>
            )}

            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 animate-spin text-compass-accent" />
              </div>
            ) : !teamWorkspace ? (
              <div className="space-y-4">
                <p className="text-sm text-compass-muted">
                  Share "{workspaceName}" with your team via Compass Cloud.
                  Evidence stays local — only workspace metadata is shared.
                </p>
                <button
                  onClick={handleCreate}
                  className="w-full py-2.5 bg-compass-accent text-white rounded-lg text-sm font-medium hover:bg-compass-accent/80 transition-colors"
                >
                  Share Workspace
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Invite form */}
                <div className="flex gap-2">
                  <input
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="Email address"
                    className="flex-1 px-3 py-2 bg-compass-bg border border-compass-border rounded-lg text-sm text-compass-text placeholder:text-compass-muted focus:outline-none focus:border-compass-accent"
                    onKeyDown={(e) => e.key === "Enter" && handleInvite()}
                  />
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value as "read" | "write")}
                    className="px-2 py-2 bg-compass-bg border border-compass-border rounded-lg text-sm text-compass-text"
                  >
                    <option value="read">Read</option>
                    <option value="write">Write</option>
                  </select>
                  <button
                    onClick={handleInvite}
                    disabled={!inviteEmail.trim()}
                    className="p-2 bg-compass-accent text-white rounded-lg hover:bg-compass-accent/80 disabled:opacity-50 transition-colors"
                  >
                    <UserPlus className="w-4 h-4" />
                  </button>
                </div>

                {/* Members list */}
                <div className="space-y-1">
                  <h3 className="text-xs font-medium text-compass-muted uppercase tracking-wider">
                    Members ({teamWorkspace.members.length})
                  </h3>
                  {teamWorkspace.members.map((email) => {
                    const access = teamWorkspace.member_access.find(
                      (m) => m.email === email,
                    );
                    const isOwner = email === teamWorkspace.owner_email;
                    return (
                      <div
                        key={email}
                        className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-white/5"
                      >
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-compass-accent/20 flex items-center justify-center">
                            <span className="text-xs font-medium text-compass-accent">
                              {email.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <span className="text-sm text-compass-text">
                            {email}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-compass-muted">
                            {isOwner ? "Owner" : access?.role || "read"}
                          </span>
                          {!isOwner && (
                            <button
                              onClick={() => handleRemove(email)}
                              className="p-1 text-compass-muted hover:text-red-400 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Copy link */}
                <button
                  onClick={handleCopyLink}
                  className="flex items-center gap-1.5 text-sm text-compass-accent hover:text-compass-accent/80 transition-colors"
                >
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {copied ? "Link copied!" : "Copy workspace link"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
