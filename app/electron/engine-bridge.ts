/**
 * Engine Bridge — spawns the Python engine server and manages its lifecycle.
 *
 * On app startup: finds Python, picks a free port, spawns the FastAPI server,
 * polls /health until ready. On quit: kills the child process.
 */

import { app } from "electron";
import { ChildProcess, spawn } from "child_process";
import { existsSync } from "fs";
import path from "path";
import net from "net";

let engineProcess: ChildProcess | null = null;
let enginePort: number = 0;

const isPackaged = app.isPackaged;

/**
 * Returns the engine directory — either the bundled sidecar resource
 * (in a packaged .dmg) or the local development path.
 */
function getEngineDir(): string {
  if (isPackaged) {
    return path.join(process.resourcesPath, "engine");
  }
  return path.resolve(__dirname, "../../engine");
}

function findPython(): string {
  const engineDir = getEngineDir();

  // In development, prefer the local venv
  if (!isPackaged) {
    const venvPython = path.join(engineDir, ".venv/bin/python");
    if (existsSync(venvPython)) return venvPython;

    const venvPython3 = path.join(engineDir, ".venv/bin/python3");
    if (existsSync(venvPython3)) return venvPython3;
  }

  // Packaged app or fallback: use system Python
  const candidates = ["python3", "python"];
  for (const c of candidates) {
    return c; // rely on PATH
  }
  return "python3";
}

function findFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, () => {
      const addr = server.address();
      if (addr && typeof addr === "object") {
        const port = addr.port;
        server.close(() => resolve(port));
      } else {
        reject(new Error("Could not find free port"));
      }
    });
    server.on("error", reject);
  });
}

async function pollHealth(port: number, timeoutMs = 15000): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`http://localhost:${port}/health`);
      const data = await res.json();
      if (data.status === "ready") return true;
    } catch {
      // not ready yet
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  return false;
}

export async function startEngine(): Promise<number> {
  if (engineProcess && enginePort) return enginePort;

  const python = findPython();
  enginePort = await findFreePort();

  console.log(`[engine-bridge] Starting engine: ${python} -m compass.server ${enginePort}`);

  const engineDir = getEngineDir();
  engineProcess = spawn(python, ["-m", "compass.server", String(enginePort)], {
    cwd: engineDir,
    stdio: ["ignore", "pipe", "pipe"],
    env: {
      ...process.env,
      COMPASS_ENGINE_PORT: String(enginePort),
    },
  });

  engineProcess.stdout?.on("data", (data: Buffer) => {
    console.log(`[engine] ${data.toString().trim()}`);
  });

  engineProcess.stderr?.on("data", (data: Buffer) => {
    console.error(`[engine] ${data.toString().trim()}`);
  });

  engineProcess.on("exit", (code) => {
    console.log(`[engine-bridge] Engine exited with code ${code}`);
    engineProcess = null;
    enginePort = 0;
  });

  const ready = await pollHealth(enginePort);
  if (!ready) {
    console.error("[engine-bridge] Engine failed to start within timeout");
  } else {
    console.log(`[engine-bridge] Engine ready on port ${enginePort}`);
  }

  // Store port so IPC handlers can use it
  process.env.COMPASS_ENGINE_PORT = String(enginePort);

  return enginePort;
}

export function stopEngine(): void {
  if (engineProcess) {
    console.log("[engine-bridge] Stopping engine");
    engineProcess.kill("SIGTERM");
    engineProcess = null;
    enginePort = 0;
  }
}

export function getEnginePort(): number {
  return enginePort;
}

export async function engineFetch(
  endpoint: string,
  options?: { method?: string; body?: unknown }
): Promise<unknown> {
  if (!enginePort) throw new Error("Engine not started");

  const url = `http://localhost:${enginePort}${endpoint}`;
  const fetchOpts: RequestInit = {
    method: options?.body ? "POST" : options?.method || "GET",
    headers: { "Content-Type": "application/json" },
  };
  if (options?.body) {
    fetchOpts.body = JSON.stringify(options.body);
  }

  const res = await fetch(url, fetchOpts);
  return res.json();
}
