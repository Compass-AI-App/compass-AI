/// <reference types="vite/client" />

interface CompassEngine {
  call: (endpoint: string, body?: unknown) => Promise<unknown>;
  health: () => Promise<{ status: string; version: string }>;
  restart: () => Promise<{ status: string; message?: string }>;
  stream: (endpoint: string, body?: unknown) => Promise<{ status: string }>;
  onStreamData: (callback: (data: string) => void) => () => void;
  onStatus: (callback: (data: { state: string; message: string }) => void) => () => void;
}

interface CompassApp {
  selectDirectory: () => Promise<string | null>;
  selectFile: (filters?: { name: string; extensions: string[] }[]) => Promise<string | null>;
  saveFile: (defaultName: string, content: string) => Promise<string | null>;
}

interface CompassSecrets {
  store: (key: string, value: string) => Promise<boolean>;
  load: (key: string) => Promise<string | null>;
  delete: (key: string) => Promise<boolean>;
}

interface CredentialObject {
  provider: string;
  method: "oauth" | "api_key" | "pat";
  access_token: string;
  refresh_token?: string;
  expires_at?: number;
  scopes?: string[];
  metadata?: Record<string, string>;
}

interface CredentialInfoObject {
  provider: string;
  method: string;
  status: "connected" | "expired" | "disconnected";
  scopes?: string[];
  expires_at?: number;
  metadata?: Record<string, string>;
}

interface CompassCredentials {
  store: (provider: string, credential: CredentialObject) => Promise<boolean>;
  load: (provider: string) => Promise<CredentialObject | null>;
  delete: (provider: string) => Promise<boolean>;
  list: () => Promise<CredentialInfoObject[]>;
}

interface Window {
  compass: {
    engine: CompassEngine;
    app: CompassApp;
    secrets: CompassSecrets;
    credentials: CompassCredentials;
  };
}
