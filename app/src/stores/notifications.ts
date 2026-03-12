import { create } from "zustand";

export interface Notification {
  id: string;
  type: "info" | "success" | "warning" | "error";
  title: string;
  message?: string;
  timestamp: number;
  read: boolean;
}

interface NotificationsState {
  notifications: Notification[];
  unreadCount: number;

  add: (type: Notification["type"], title: string, message?: string) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
  remove: (id: string) => void;
  clear: () => void;
}

export const useNotificationsStore = create<NotificationsState>((set, get) => ({
  notifications: [],
  unreadCount: 0,

  add: (type, title, message) => {
    const notification: Notification = {
      id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      type,
      title,
      message,
      timestamp: Date.now(),
      read: false,
    };
    const updated = [notification, ...get().notifications].slice(0, 50);
    set({
      notifications: updated,
      unreadCount: updated.filter((n) => !n.read).length,
    });

    // Trigger desktop notification if available
    if (typeof Notification !== "undefined" && Notification.permission === "granted") {
      new Notification(title, { body: message });
    }
  },

  markRead: (id) => {
    const updated = get().notifications.map((n) =>
      n.id === id ? { ...n, read: true } : n,
    );
    set({
      notifications: updated,
      unreadCount: updated.filter((n) => !n.read).length,
    });
  },

  markAllRead: () => {
    const updated = get().notifications.map((n) => ({ ...n, read: true }));
    set({ notifications: updated, unreadCount: 0 });
  },

  remove: (id) => {
    const updated = get().notifications.filter((n) => n.id !== id);
    set({
      notifications: updated,
      unreadCount: updated.filter((n) => !n.read).length,
    });
  },

  clear: () => set({ notifications: [], unreadCount: 0 }),
}));
