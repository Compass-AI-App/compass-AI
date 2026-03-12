import { create } from "zustand";

export interface UserProfile {
  name: string;
  email: string;
  avatar_url: string;
  provider: string;
}

interface AuthState {
  user: UserProfile | null;
  loading: boolean;

  /** Load persisted profile from localStorage. */
  loadProfile: () => void;

  /** Set profile after social auth login. */
  setProfile: (profile: UserProfile) => void;

  /** Clear profile on logout. */
  logout: () => void;
}

const PROFILE_KEY = "compass-user-profile";
const AUTH_PROVIDER_KEY = "compass-auth-provider";

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: false,

  loadProfile: () => {
    try {
      const raw = localStorage.getItem(PROFILE_KEY);
      if (raw) {
        const profile = JSON.parse(raw) as UserProfile;
        set({ user: profile });
      }
    } catch {
      // Corrupted data — clear it
      localStorage.removeItem(PROFILE_KEY);
      localStorage.removeItem(AUTH_PROVIDER_KEY);
    }
  },

  setProfile: (profile: UserProfile) => {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
    localStorage.setItem(AUTH_PROVIDER_KEY, profile.provider);
    set({ user: profile });
  },

  logout: () => {
    localStorage.removeItem(PROFILE_KEY);
    localStorage.removeItem(AUTH_PROVIDER_KEY);
    set({ user: null });
  },
}));
