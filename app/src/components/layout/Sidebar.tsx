import { useEffect } from "react";
import { NavLink } from "react-router-dom";
import {
  Home,
  Database,
  AlertTriangle,
  Lightbulb,
  MessageCircle,
  Settings,
  Compass,
} from "lucide-react";
import { clsx } from "clsx";
import { useWorkspaceStore } from "../../stores/workspace";
import { useSettingsStore } from "../../stores/settings";
import { useNavigate } from "react-router-dom";

const navItems = [
  { to: "/workspace", icon: Home, label: "Workspace" },
  { to: "/evidence", icon: Database, label: "Evidence" },
  { to: "/conflicts", icon: AlertTriangle, label: "Conflicts" },
  { to: "/discover", icon: Lightbulb, label: "Discover" },
  { to: "/chat", icon: MessageCircle, label: "Chat" },
];

const statusColor: Record<string, string> = {
  ready: "bg-green-500",
  connecting: "bg-yellow-500 animate-pulse",
  unavailable: "bg-red-500",
};

export default function Sidebar() {
  const engineStatus = useWorkspaceStore((s) => s.engineStatus);
  const setEngineStatus = useWorkspaceStore((s) => s.setEngineStatus);
  const productName = useWorkspaceStore((s) => s.productName);
  const tokenUsage = useSettingsStore((s) => s.tokenUsage);
  const fetchUsage = useSettingsStore((s) => s.fetchUsage);
  const provider = useSettingsStore((s) => s.provider);

  useEffect(() => {
    let cancelled = false;
    async function check() {
      try {
        const res = await window.compass?.engine.health();
        if (!cancelled) {
          setEngineStatus(res?.status === "ready" ? "ready" : "unavailable");
        }
      } catch {
        if (!cancelled) setEngineStatus("unavailable");
      }
    }
    check();
    const interval = setInterval(check, 10000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [setEngineStatus]);

  useEffect(() => {
    if (engineStatus === "ready") fetchUsage();
    const interval = setInterval(() => {
      if (engineStatus === "ready") fetchUsage();
    }, 30000);
    return () => clearInterval(interval);
  }, [engineStatus, fetchUsage]);

  return (
    <aside className="flex flex-col w-[220px] h-full bg-compass-sidebar border-r border-compass-border select-none">
      {/* Title bar drag region */}
      <div className="h-12 flex items-center gap-2 px-4 draggable shrink-0"
           style={{ WebkitAppRegion: "drag" } as React.CSSProperties}>
        <Compass className="w-5 h-5 text-compass-accent shrink-0" />
        <span className="text-sm font-semibold text-compass-text tracking-tight truncate">
          {productName || "Compass"}
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 flex flex-col gap-0.5 px-2 pt-1 overflow-y-auto">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              clsx(
                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
                isActive
                  ? "bg-white/10 text-compass-text"
                  : "text-compass-muted hover:text-compass-text hover:bg-white/5"
              )
            }
          >
            <Icon className="w-4 h-4 shrink-0" />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Bottom section */}
      <div className="px-2 pb-3 shrink-0">
        <NavLink
          to="/settings"
          className={({ isActive }) =>
            clsx(
              "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
              isActive
                ? "bg-white/10 text-compass-text"
                : "text-compass-muted hover:text-compass-text hover:bg-white/5"
            )
          }
        >
          <Settings className="w-4 h-4 shrink-0" />
          Settings
        </NavLink>
        <div className="mt-2 px-3 py-1.5 space-y-1">
          <div className="flex items-center gap-2">
            <div className={clsx("w-2 h-2 rounded-full", statusColor[engineStatus])} />
            <span className="text-xs text-compass-muted">
              Engine {engineStatus}
            </span>
          </div>
          {tokenUsage.total > 0 && (
            <div className="text-xs text-compass-muted">
              {tokenUsage.total.toLocaleString()} tokens &middot; {tokenUsage.cost}
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
