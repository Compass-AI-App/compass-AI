/// <reference types="vite/client" />

interface CompassEngine {
  call: (endpoint: string, body?: unknown) => Promise<unknown>;
  health: () => Promise<{ status: string; version: string }>;
  stream: (endpoint: string, body?: unknown) => Promise<{ status: string }>;
  onStreamData: (callback: (data: string) => void) => () => void;
}

interface CompassApp {
  selectDirectory: () => Promise<string | null>;
  selectFile: (filters?: { name: string; extensions: string[] }[]) => Promise<string | null>;
  saveFile: (defaultName: string, content: string) => Promise<string | null>;
}

interface Window {
  compass: {
    engine: CompassEngine;
    app: CompassApp;
  };
}
