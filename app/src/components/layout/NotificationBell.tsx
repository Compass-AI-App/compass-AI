import { useState, useEffect, useRef } from "react";
import { Bell, Check, X, Trash2, Info, CheckCircle, AlertTriangle, AlertCircle } from "lucide-react";
import { useNotificationsStore } from "../../stores/notifications";
import type { Notification } from "../../stores/notifications";

const TYPE_ICONS: Record<Notification["type"], typeof Info> = {
  info: Info,
  success: CheckCircle,
  warning: AlertTriangle,
  error: AlertCircle,
};

const TYPE_COLORS: Record<Notification["type"], string> = {
  info: "text-blue-400",
  success: "text-green-400",
  warning: "text-amber-400",
  error: "text-red-400",
};

export default function NotificationBell() {
  const { notifications, unreadCount, markRead, markAllRead, remove, clear } =
    useNotificationsStore();
  const [showPanel, setShowPanel] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Request notification permission
  useEffect(() => {
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  // Close on outside click
  useEffect(() => {
    if (!showPanel) return;
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setShowPanel(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showPanel]);

  function formatTime(timestamp: number): string {
    const diff = Date.now() - timestamp;
    if (diff < 60000) return "Just now";
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return new Date(timestamp).toLocaleDateString();
  }

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => setShowPanel(!showPanel)}
        className="relative p-2 text-compass-muted hover:text-compass-text transition-colors rounded-lg hover:bg-white/5"
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-compass-accent text-white text-[10px] font-bold rounded-full flex items-center justify-center">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {showPanel && (
        <div className="absolute bottom-full left-0 mb-2 w-80 bg-compass-card border border-compass-border rounded-xl shadow-xl z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-compass-border">
            <h3 className="text-sm font-medium text-compass-text">
              Notifications
            </h3>
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  className="text-xs text-compass-muted hover:text-compass-text transition-colors px-1.5 py-0.5"
                  title="Mark all read"
                >
                  <Check className="w-3.5 h-3.5" />
                </button>
              )}
              {notifications.length > 0 && (
                <button
                  onClick={clear}
                  className="text-xs text-compass-muted hover:text-compass-text transition-colors px-1.5 py-0.5"
                  title="Clear all"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Notifications list */}
          <div className="max-h-72 overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="text-xs text-compass-muted text-center py-8">
                No notifications
              </p>
            ) : (
              notifications.map((notif) => {
                const Icon = TYPE_ICONS[notif.type];
                const color = TYPE_COLORS[notif.type];
                return (
                  <div
                    key={notif.id}
                    onClick={() => markRead(notif.id)}
                    className={`flex items-start gap-2.5 px-4 py-2.5 hover:bg-white/5 cursor-pointer transition-colors ${
                      !notif.read ? "bg-compass-accent/5" : ""
                    }`}
                  >
                    <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${color}`} />
                    <div className="flex-1 min-w-0">
                      <p
                        className={`text-xs ${
                          notif.read ? "text-compass-muted" : "text-compass-text font-medium"
                        }`}
                      >
                        {notif.title}
                      </p>
                      {notif.message && (
                        <p className="text-[10px] text-compass-muted mt-0.5 truncate">
                          {notif.message}
                        </p>
                      )}
                      <p className="text-[10px] text-compass-muted/60 mt-0.5">
                        {formatTime(notif.timestamp)}
                      </p>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        remove(notif.id);
                      }}
                      className="p-0.5 text-compass-muted hover:text-compass-text opacity-0 group-hover:opacity-100 transition-all"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
