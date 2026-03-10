import { useState } from "react";
import { Compass, ArrowRight, Loader2 } from "lucide-react";
import { clsx } from "clsx";
import { useSettingsStore } from "../stores/settings";
import { useNavigate } from "react-router-dom";

type Mode = "login" | "signup";

const CLOUD_TOKEN_KEY = "compass-cloud-token";

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
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

  function handleSkip() {
    navigate("/settings");
  }

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
              ? "Sign in to Compass Cloud"
              : "Start with 50k free tokens/month"}
          </p>
        </div>

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
            disabled={loading || !email || !password}
            className={clsx(
              "w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors",
              loading || !email || !password
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
