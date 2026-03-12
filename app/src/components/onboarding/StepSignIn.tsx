import { useState } from "react";
import { Github, Loader2, UserCircle } from "lucide-react";
import { useAuthStore } from "../../stores/auth";

interface StepSignInProps {
  onNext: () => void;
}

function GoogleIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

export default function StepSignIn({ onNext }: StepSignInProps) {
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState("");
  const setProfile = useAuthStore((s) => s.setProfile);

  async function handleSocialAuth(providerId: string) {
    setLoading(providerId);
    setError("");

    try {
      const providers = await window.compass.providers?.list();
      const providerConfig = providers?.find(
        (p: { id: string }) => p.id === providerId
      );

      if (!providerConfig) {
        setError(`Provider ${providerId} not configured`);
        return;
      }

      const result = await window.compass.oauth.start(providerConfig);

      await window.compass.credentials.store(providerId, {
        provider: providerId,
        method: "oauth",
        access_token: result.access_token,
        refresh_token: result.refresh_token || "",
        expires_at: result.expires_at || 0,
        scopes: result.scopes || [],
      });

      // Fetch profile
      let profile = { name: "User", email: "", avatar_url: "", provider: providerId };
      try {
        if (providerId === "github") {
          const res = await fetch("https://api.github.com/user", {
            headers: { Authorization: `Bearer ${result.access_token}` },
          });
          const data = await res.json();
          profile = {
            name: data.name || data.login,
            email: data.email || "",
            avatar_url: data.avatar_url || "",
            provider: providerId,
          };
        } else if (providerId === "google") {
          const res = await fetch(
            "https://www.googleapis.com/oauth2/v2/userinfo",
            {
              headers: { Authorization: `Bearer ${result.access_token}` },
            }
          );
          const data = await res.json();
          profile = {
            name: data.name || "",
            email: data.email || "",
            avatar_url: data.picture || "",
            provider: providerId,
          };
        }
      } catch {
        // Profile fetch is best-effort
      }

      setProfile(profile);
      onNext();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Auth failed";
      setError(message);
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="text-center">
      <UserCircle className="w-12 h-12 text-compass-accent mx-auto mb-4" />
      <h2 className="text-xl font-semibold text-compass-text mb-2">
        Sign In
      </h2>
      <p className="text-sm text-neutral-400 mb-6">
        Sign in to connect your tools, or skip to use Compass locally.
      </p>

      <div className="space-y-3 max-w-xs mx-auto">
        <button
          onClick={() => handleSocialAuth("github")}
          disabled={loading !== null}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium bg-[#24292f] hover:bg-[#32383f] text-white transition-colors disabled:opacity-50"
        >
          {loading === "github" ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Github className="w-4 h-4" />
          )}
          Continue with GitHub
        </button>

        <button
          onClick={() => handleSocialAuth("google")}
          disabled={loading !== null}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium bg-white hover:bg-neutral-100 text-neutral-800 transition-colors disabled:opacity-50"
        >
          {loading === "google" ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <GoogleIcon />
          )}
          Continue with Google
        </button>

        {error && <p className="text-xs text-red-400">{error}</p>}

        <div className="relative my-4">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-compass-border" />
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="bg-compass-bg px-2 text-compass-muted">or</span>
          </div>
        </div>

        <button
          onClick={onNext}
          className="w-full py-2.5 rounded-lg text-sm text-compass-muted hover:text-compass-text border border-compass-border hover:border-compass-accent/50 transition-colors"
        >
          Skip for now
        </button>
      </div>
    </div>
  );
}
