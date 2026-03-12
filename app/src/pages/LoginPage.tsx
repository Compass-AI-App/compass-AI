import { useState } from "react";
import { Compass, ArrowRight, Loader2, Github } from "lucide-react";
import { clsx } from "clsx";
import { useSettingsStore } from "../stores/settings";
import { useNavigate } from "react-router-dom";

type Mode = "login" | "signup";

const CLOUD_TOKEN_KEY = "compass-cloud-token";

/** Minimal profile fetched after social auth. */
export interface SocialProfile {
  name: string;
  email: string;
  avatar_url: string;
  provider: string;
}

/**
 * Fetch the authenticated user's profile from the provider API.
 */
async function fetchSocialProfile(
  provider: string,
  accessToken: string
): Promise<SocialProfile> {
  if (provider === "github") {
    const res = await fetch("https://api.github.com/user", {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
    });
    if (!res.ok) throw new Error("Failed to fetch GitHub profile");
    const data = await res.json();
    // GitHub may not return email in /user; fetch from /user/emails
    let email = data.email || "";
    if (!email) {
      try {
        const emailRes = await fetch("https://api.github.com/user/emails", {
          headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
        });
        if (emailRes.ok) {
          const emails = await emailRes.json();
          const primary = emails.find((e: { primary: boolean }) => e.primary);
          email = primary?.email || emails[0]?.email || "";
        }
      } catch {
        // Non-critical — email will be empty
      }
    }
    return {
      name: data.name || data.login,
      email,
      avatar_url: data.avatar_url || "",
      provider: "github",
    };
  }

  if (provider === "google") {
    const res = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) throw new Error("Failed to fetch Google profile");
    const data = await res.json();
    return {
      name: data.name || data.email,
      email: data.email || "",
      avatar_url: data.picture || "",
      provider: "google",
    };
  }

  throw new Error(`Unsupported social auth provider: ${provider}`);
}

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState<string | null>(null);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const setProvider = useSettingsStore((s) => s.setProvider);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) return;

    setLoading(true);
    setError("");

    try {
      const endpoint = mode === "login" ? "/auth/login" : "/auth/signup";
      const res = await fetch(`${getCloudUrl()}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({ detail: "Request failed" }));
        setError(data.detail || "Request failed");
        return;
      }

      const data = await res.json();
      localStorage.setItem(CLOUD_TOKEN_KEY, data.token);
      setProvider("compass");
      navigate("/workspace");
    } catch {
      setError("Connection failed. Is Compass Cloud reachable?");
    } finally {
      setLoading(false);
    }
  }

  async function handleSocialAuth(providerId: string) {
    setSocialLoading(providerId);
    setError("");

    try {
      // Get provider config
      const providerConfig = await window.compass?.providers?.get(providerId);
      if (!providerConfig) {
        setError(`Provider "${providerId}" not configured. Set COMPASS_${providerId.toUpperCase()}_CLIENT_ID environment variable.`);
        return;
      }

      if (!providerConfig.client_id) {
        setError(`No client ID configured for ${providerConfig.name}. Set COMPASS_${providerId.toUpperCase()}_CLIENT_ID environment variable.`);
        return;
      }

      // Start OAuth flow (opens browser window)
      const result = await window.compass.oauth.start(providerConfig);

      // Store credential in vault (doubles as service credential)
      await window.compass.credentials.store(providerId, {
        provider: providerId,
        method: "oauth",
        access_token: result.access_token,
        refresh_token: result.refresh_token,
        expires_at: result.expires_at,
        scopes: result.scopes,
      });

      // Inject into engine
      await window.compass.engine.call("/credentials/inject", {
        provider: providerId,
        access_token: result.access_token,
        refresh_token: result.refresh_token,
        expires_at: result.expires_at,
      });

      // Fetch user profile
      const profile = await fetchSocialProfile(providerId, result.access_token);

      // Persist profile in localStorage
      localStorage.setItem("compass-user-profile", JSON.stringify(profile));
      localStorage.setItem("compass-auth-provider", providerId);

      // Navigate to workspace
      navigate("/workspace");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.includes("cancelled")) {
        setError(msg);
      }
    } finally {
      setSocialLoading(null);
    }
  }

  function handleSkip() {
    navigate("/settings");
  }

  const isSocialLoading = socialLoading !== null;

  return (
    <div className="min-h-screen bg-compass-bg flex items-center justify-center p-8">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Compass className="w-12 h-12 text-compass-accent mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-compass-text">
            {mode === "login" ? "Welcome Back" : "Create Account"}
          </h1>
          <p className="text-sm text-neutral-400 mt-1">
            {mode === "login"
              ? "Sign in to Compass"
              : "Start with 50k free tokens/month"}
          </p>
        </div>

        {/* Social Auth Buttons */}
        <div className="space-y-2 mb-6">
          <button
            onClick={() => handleSocialAuth("github")}
            disabled={isSocialLoading || loading}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium bg-[#24292f] hover:bg-[#32383f] text-white transition-colors disabled:opacity-50"
          >
            {socialLoading === "github" ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Github className="w-4 h-4" />
            )}
            Continue with GitHub
          </button>
          <button
            onClick={() => handleSocialAuth("google")}
            disabled={isSocialLoading || loading}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium bg-white hover:bg-neutral-100 text-neutral-800 transition-colors disabled:opacity-50"
          >
            {socialLoading === "google" ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <GoogleIcon />
            )}
            Continue with Google
          </button>
        </div>

        {/* Divider */}
        <div className="flex items-center gap-3 mb-6">
          <div className="flex-1 border-t border-compass-border" />
          <span className="text-xs text-compass-muted">or</span>
          <div className="flex-1 border-t border-compass-border" />
        </div>

        {/* Email/Password Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-neutral-400 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-compass-card border border-compass-border text-compass-text text-sm placeholder:text-neutral-600 focus:outline-none focus:border-compass-accent"
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label className="block text-sm text-neutral-400 mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-compass-card border border-compass-border text-compass-text text-sm placeholder:text-neutral-600 focus:outline-none focus:border-compass-accent"
            />
          </div>

          {error && (
            <p className="text-sm text-red-400">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading || !email || !password || isSocialLoading}
            className={clsx(
              "w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors",
              loading || !email || !password || isSocialLoading
                ? "bg-compass-card text-neutral-600 cursor-not-allowed"
                : "bg-compass-accent hover:bg-compass-accent-hover text-white"
            )}
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <ArrowRight className="w-4 h-4" />
            )}
            {mode === "login" ? "Sign In" : "Create Account"}
          </button>
        </form>

        <div className="mt-6 text-center space-y-3">
          <button
            onClick={() => setMode(mode === "login" ? "signup" : "login")}
            className="text-sm text-compass-accent hover:text-compass-accent-hover"
          >
            {mode === "login" ? "Need an account? Sign up" : "Already have an account? Sign in"}
          </button>

          <div className="border-t border-compass-border pt-3">
            <button
              onClick={handleSkip}
              className="text-xs text-compass-muted hover:text-compass-text"
            >
              Skip — I'll use my own API key (BYOK)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function getCloudUrl(): string {
  return localStorage.getItem("compass-cloud-url") || "https://api.compass.dev";
}

/** Google "G" logo as inline SVG. */
function GoogleIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}
