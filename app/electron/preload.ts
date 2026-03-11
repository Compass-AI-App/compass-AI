import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("compass", {
  engine: {
    call: (endpoint: string, body?: unknown) =>
      ipcRenderer.invoke("engine-call", endpoint, body),
    health: () => ipcRenderer.invoke("engine-health"),
    restart: () => ipcRenderer.invoke("engine-restart"),
    stream: (endpoint: string, body?: unknown) =>
      ipcRenderer.invoke("engine-stream", endpoint, body),
    onStreamData: (callback: (data: string) => void) => {
      const handler = (_event: unknown, data: string) => callback(data);
      ipcRenderer.on("engine-stream-data", handler);
      return () => ipcRenderer.removeListener("engine-stream-data", handler);
    },
    onStatus: (callback: (data: { state: string; message: string }) => void) => {
      const handler = (_event: unknown, data: { state: string; message: string }) => callback(data);
      ipcRenderer.on("engine-status", handler);
      return () => ipcRenderer.removeListener("engine-status", handler);
    },
  },
  app: {
    selectDirectory: () => ipcRenderer.invoke("select-directory"),
    selectFile: (filters?: { name: string; extensions: string[] }[]) =>
      ipcRenderer.invoke("select-file", filters),
    saveFile: (defaultName: string, content: string) =>
      ipcRenderer.invoke("save-file", defaultName, content),
  },
  secrets: {
    store: (key: string, value: string) =>
      ipcRenderer.invoke("secrets-store", key, value),
    load: (key: string) => ipcRenderer.invoke("secrets-load", key),
    delete: (key: string) => ipcRenderer.invoke("secrets-delete", key),
  },
});
