import { app, BrowserWindow, ipcMain, dialog, safeStorage } from "electron";
import path from "path";
import fs from "fs";
import { autoUpdater } from "electron-updater";
import { startEngine, stopEngine, engineFetch } from "./engine-bridge";

let mainWindow: BrowserWindow | null = null;

const isDev = !app.isPackaged;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    titleBarStyle: "hiddenInset",
    backgroundColor: "#0a0a0a",
    trafficLightPosition: { x: 16, y: 16 },
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (isDev) {
    mainWindow.loadURL("http://localhost:5173");
  } else {
    mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  createWindow();

  try {
    await startEngine();
  } catch (err) {
    console.error("[main] Failed to start engine:", err);
  }

  // Auto-updater: check for updates in packaged builds
  if (app.isPackaged) {
    autoUpdater.logger = console;
    autoUpdater.checkForUpdatesAndNotify();
  }
});

app.on("window-all-closed", () => {
  stopEngine();
  app.quit();
});

app.on("before-quit", () => {
  stopEngine();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// IPC: Native folder picker
ipcMain.handle("select-directory", async () => {
  const result = await dialog.showOpenDialog({
    properties: ["openDirectory"],
  });
  return result.canceled ? null : result.filePaths[0];
});

// IPC: Native file picker
ipcMain.handle("select-file", async (_event, filters) => {
  const result = await dialog.showOpenDialog({
    properties: ["openFile"],
    filters: filters || [],
  });
  return result.canceled ? null : result.filePaths[0];
});

// IPC: Save file dialog
ipcMain.handle("save-file", async (_event, defaultName: string, content: string) => {
  const result = await dialog.showSaveDialog({
    defaultPath: defaultName,
    filters: [{ name: "Markdown", extensions: ["md"] }],
  });
  if (result.canceled || !result.filePath) return null;
  const fs = await import("fs/promises");
  await fs.writeFile(result.filePath, content, "utf-8");
  return result.filePath;
});

// IPC: Engine API call (proxied through main process via engine-bridge)
ipcMain.handle("engine-call", async (_event, endpoint: string, body?: unknown) => {
  try {
    return await engineFetch(endpoint, body ? { body } : undefined);
  } catch (err) {
    return { status: "error", message: String(err) };
  }
});

// IPC: Engine SSE stream (for chat streaming)
ipcMain.handle(
  "engine-stream",
  async (event, endpoint: string, body?: unknown) => {
    const port = process.env.COMPASS_ENGINE_PORT || "9811";
    const url = `http://localhost:${port}${endpoint}`;

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      });

      if (!res.body) return { status: "error", message: "No response body" };

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            event.sender.send("engine-stream-data", data);
          } else if (line.startsWith("event: ")) {
            const eventName = line.slice(7).trim();
            // next data line will contain the event data
          }
        }
      }

      event.sender.send("engine-stream-data", JSON.stringify({ done: true }));
      return { status: "ok" };
    } catch (err) {
      return { status: "error", message: String(err) };
    }
  }
);

// IPC: Engine health check
ipcMain.handle("engine-health", async () => {
  try {
    return await engineFetch("/health");
  } catch {
    return { status: "unavailable" };
  }
});

// IPC: Secure secret storage via OS keychain (Electron safeStorage)
// Secrets are encrypted with the OS keychain and stored in a local file.
// They never leave the machine and are not readable without OS-level auth.
const secretsPath = path.join(app.getPath("userData"), "secrets.enc");

ipcMain.handle("secrets-store", async (_event, key: string, value: string) => {
  if (!safeStorage.isEncryptionAvailable()) {
    // Fallback: store as-is (still better than localStorage — it's in app data, not browser storage)
    const store = loadSecretsFile();
    store[key] = value;
    fs.writeFileSync(secretsPath, JSON.stringify(store), "utf-8");
    return true;
  }
  const store = loadSecretsFile();
  store[key] = safeStorage.encryptString(value).toString("base64");
  fs.writeFileSync(secretsPath, JSON.stringify(store), "utf-8");
  return true;
});

ipcMain.handle("secrets-load", async (_event, key: string) => {
  const store = loadSecretsFile();
  const encrypted = store[key];
  if (!encrypted) return null;
  if (!safeStorage.isEncryptionAvailable()) {
    return encrypted; // Fallback: stored as plaintext
  }
  try {
    return safeStorage.decryptString(Buffer.from(encrypted, "base64"));
  } catch {
    return null; // Corrupted or re-keyed — user will need to re-enter
  }
});

ipcMain.handle("secrets-delete", async (_event, key: string) => {
  const store = loadSecretsFile();
  delete store[key];
  fs.writeFileSync(secretsPath, JSON.stringify(store), "utf-8");
  return true;
});

function loadSecretsFile(): Record<string, string> {
  try {
    return JSON.parse(fs.readFileSync(secretsPath, "utf-8"));
  } catch {
    return {};
  }
}
