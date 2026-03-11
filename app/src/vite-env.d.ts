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

interface Window {
  compass: {
    engine: CompassEngine;
    app: CompassApp;
    secrets: CompassSecrets;
  };
}
