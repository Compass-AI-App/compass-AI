import { useState, useEffect } from "react";
import {
  Activity,
  Database,
  Lightbulb,
  AlertTriangle,
  FileText,
  Presentation,
  Code2,
  MessageCircle,
  RefreshCw,
} from "lucide-react";

interface ActivityEvent {
  id: string;
  event_type: string;
  title: string;
  description: string;
  timestamp: string;
  metadata: Record<string, unknown>;
}

const EVENT_ICONS: Record<string, typeof Activity> = {
  ingest: Database,
  discover: Lightbulb,
  reconcile: AlertTriangle,
  document: FileText,
  presentation: Presentation,
  prototype: Code2,
  chat: MessageCircle,
};

const EVENT_COLORS: Record<string, string> = {
  ingest: "text-blue-400",
  discover: "text-amber-400",
  reconcile: "text-orange-400",
  document: "text-green-400",
  presentation: "text-purple-400",
  prototype: "text-cyan-400",
  chat: "text-compass-accent",
};

interface ActivityFeedProps {
  workspacePath: string;
}

export default function ActivityFeed({ workspacePath }: ActivityFeedProps) {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(false);

  async function loadEvents() {
    setLoading(true);
    try {
      const res = (await window.compass.engine.call("/activity", {
        workspace_path: workspacePath,
        limit: 20,
      })) as { events: ActivityEvent[] };
      setEvents(res.events || []);
    } catch {
      // Activity endpoint may not be available
    }
    setLoading(false);
  }

  useEffect(() => {
    if (workspacePath) loadEvents();
  }, [workspacePath]);

  // Auto-refresh every 30s
  useEffect(() => {
    if (!workspacePath) return;
    const interval = setInterval(loadEvents, 30000);
    return () => clearInterval(interval);
  }, [workspacePath]);

  function formatTime(timestamp: string): string {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();

    if (diff < 60000) return "Just now";
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return date.toLocaleDateString();
  }

  return (
    <div className="bg-compass-card border border-compass-border rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-compass-accent" />
          <h3 className="text-sm font-medium text-compass-text">Activity</h3>
        </div>
        <button
          onClick={loadEvents}
          disabled={loading}
          className="p-1 text-compass-muted hover:text-compass-text transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {events.length === 0 ? (
        <p className="text-xs text-compass-muted py-4 text-center">
          No activity yet
        </p>
      ) : (
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {events.map((event) => {
            const Icon = EVENT_ICONS[event.event_type] || Activity;
            const color = EVENT_COLORS[event.event_type] || "text-compass-muted";
            return (
              <div key={event.id} className="flex items-start gap-2.5">
                <Icon className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${color}`} />
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-compass-text truncate">
                    {event.title}
                  </p>
                  <p className="text-[10px] text-compass-muted">
                    {formatTime(event.timestamp)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
