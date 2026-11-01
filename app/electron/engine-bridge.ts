/**
 * Engine Bridge — spawns the Python engine server and manages its lifecycle.
 *
 * On app startup: finds Python, picks a free port, spawns the FastAPI server,
 * polls /health until ready. On quit: kills the child process.
 *
 * For packaged builds: bootstraps a managed venv on first launch.
 * Handles engine crashes with restart capability.
 */

import { app, BrowserWindow } from "electron";
import { ChildProcess, spawn, execSync } from "child_process";
import { existsSync, mkdirSync } from "fs";
import path from "path";
import net from "net";
import crypto from "crypto";
import {EngineMaintenance} from "./engine-maintenance";
const maintenance=new EngineMaintenance();
let stoppedChild:ChildProcess|null=null;
let launchPython="";

let engineProcess: ChildProcess | null = null;
let enginePort: number = 0;
let engineToken = "";
let intentionalStop = false;

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

/** Managed venv location for packaged builds. */
function getManagedVenvDir(): string {
  return path.join(app.getPath("userData"), "engine-venv");
}

/**
 * For packaged builds: ensure a managed venv exists with compass-ai installed.
 * Returns the Python path inside the managed venv.
 */
function ensureManagedVenv(): string {
  const venvDir = getManagedVenvDir();
  const isWin = process.platform === "win32";
  const venvPython = isWin
    ? path.join(venvDir, "Scripts", "python.exe")
    : path.join(venvDir, "bin", "python3");

  if (existsSync(venvPython)) {
    return venvPython;
  }

  console.log("[engine-bridge] First launch: creating managed venv...");
  notifyRenderer("engine-status", { state: "setup", message: "Setting up Python environment..." });

  // Find system Python
  const systemPython = findSystemPython();
  console.log(`[engine-bridge] Using system Python: ${systemPython}`);

  mkdirSync(venvDir, { recursive: true });
  execSync(`"${systemPython}" -m venv "${venvDir}"`, { stdio: "inherit" });

  // Install compass-ai from the bundled engine source
  const engineDir = getEngineDir();
  console.log("[engine-bridge] Installing compass-ai into managed venv...");
  notifyRenderer("engine-status", { state: "setup", message: "Installing dependencies..." });
  execSync(`"${venvPython}" -m pip install --quiet "${engineDir}"`, {
    stdio: "inherit",
    timeout: 120_000,
  });

  console.log("[engine-bridge] Managed venv ready");
  return venvPython;
}

function findSystemPython(): string {
  const isWin = process.platform === "win32";
  const candidates = isWin ? ["python", "python3"] : ["python3", "python"];
  for (const cmd of candidates) {
    try {
      execSync(`${cmd} --version`, { stdio: "ignore" });
      return cmd;
    } catch {
      // not found
    }
  }
  throw new Error("Python 3 not found. Please install Python 3.11+ from python.org");
}

function findPython(): string {
  const engineDir = getEngineDir();
  const isWin = process.platform === "win32";

  // In development, prefer the local venv
  if (!isPackaged) {
    if (isWin) {
      const venvPythonWin = path.join(engineDir, ".venv\\Scripts\\python.exe");
      if (existsSync(venvPythonWin)) return venvPythonWin;
    } else {
      const venvPython = path.join(engineDir, ".venv/bin/python");
      if (existsSync(venvPython)) return venvPython;

      const venvPython3 = path.join(engineDir, ".venv/bin/python3");
      if (existsSync(venvPython3)) return venvPython3;
    }
  }

  // Packaged app: use managed venv (bootstrap if needed)
  if (isPackaged) {
    return ensureManagedVenv();
  }

  // Dev fallback: use system Python
  return findSystemPython();
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

async function pollHealth(port: number, timeoutMs = 30_000): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/health`, {
        headers: { Authorization: `Bearer ${engineToken}` },
      });
      const data = await res.json();
      if (data.status === "ready") return true;
    } catch {
      // not ready yet
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  return false;
}

/** Send status updates to the renderer process. */
function notifyRenderer(channel: string, data: unknown): void {
  const windows = BrowserWindow.getAllWindows();
  for (const win of windows) {
    try {
      win.webContents.send(channel, data);
    } catch {
      // Window might be closed
    }
  }
}

export function engineEnvironment(source:NodeJS.ProcessEnv):NodeJS.ProcessEnv {
  const environment={...source};
  for(const name of Object.keys(environment))if(/(?:API_KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL)/i.test(name))delete environment[name];
  environment.COMPASS_NATIVE_INFERENCE_ONLY="1";
  return environment;
}

export async function startEngine(): Promise<number> {
  if(stoppedChild)await waitForExit(stoppedChild);
  if (engineProcess && enginePort) return enginePort;

  intentionalStop = false;

  notifyRenderer("engine-status", { state: "starting", message: "Starting engine..." });

  const python = findPython();
  launchPython=python;
  enginePort = await findFreePort();
  engineToken = crypto.randomBytes(32).toString("hex");

  console.log(`[engine-bridge] Starting engine: ${python} -m compass.server ${enginePort}`);

  const engineDir = getEngineDir();
  engineProcess = spawn(python, ["-m", "compass.server", String(enginePort)], {
    cwd: engineDir,
    stdio: ["ignore", "pipe", "pipe"],
    env: {
      ...engineEnvironment(process.env),
      COMPASS_ENGINE_PORT: String(enginePort),
      COMPASS_ENGINE_TOKEN: engineToken,
    },
  });

  engineProcess.stdout?.on("data", (data: Buffer) => {
    console.log(`[engine] ${data.toString().trim()}`);
  });

  engineProcess.stderr?.on("data", (data: Buffer) => {
    console.error(`[engine] ${data.toString().trim()}`);
  });

  const launchedChild=engineProcess;
  engineProcess.on("exit", (code) => {
    console.log(`[engine-bridge] Engine exited with code ${code}`);
    if(engineProcess===launchedChild){engineProcess = null;enginePort = 0;engineToken = "";}
    if(stoppedChild===launchedChild)stoppedChild=null;

    if (!intentionalStop) {
      console.error("[engine-bridge] Engine crashed unexpectedly");
      notifyRenderer("engine-status", {
        state: "crashed",
        message: `Engine stopped unexpectedly (exit code ${code}). Click to restart.`,
      });
    }
  });

  const ready = await pollHealth(enginePort);
  if (!ready) {
    console.error("[engine-bridge] Engine failed to start within timeout");
    notifyRenderer("engine-status", {
      state: "error",
      message: "Engine failed to start. Check that Python 3.11+ is installed.",
    });
  } else {
    console.log(`[engine-bridge] Engine ready on port ${enginePort}`);
    notifyRenderer("engine-status", { state: "ready", message: "Engine ready" });
  }

  // Store port so IPC handlers can use it
  process.env.COMPASS_ENGINE_PORT = String(enginePort);

  return enginePort;
}

export function stopEngine(): void {
  intentionalStop = true;
  engineToken = "";
  if (engineProcess) {
    console.log("[engine-bridge] Stopping engine");
    stoppedChild=engineProcess;
    engineProcess.kill("SIGTERM");
    engineProcess = null;
    enginePort = 0;
  }
}

export function getEnginePort(): number {
  return enginePort;
}

export async function engineRequest(
  endpoint: string,
  options?: { method?: string; body?: unknown }
): Promise<Response> {
  maintenance.assertAvailable();
  return rawEngineRequest(endpoint,options);
}

async function rawEngineRequest(endpoint:string,options?:{method?:string;body?:unknown}):Promise<Response>{
  if (!enginePort || !engineToken) throw new Error("Engine not started");

  const origin = `http://127.0.0.1:${enginePort}`;
  const url = new URL(endpoint, origin);
  if (!endpoint.startsWith("/") || url.origin !== origin) {
    throw new Error("Engine endpoint must stay on the local engine origin");
  }
  const fetchOpts: RequestInit = {
    method: options?.body ? "POST" : options?.method || "GET",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${engineToken}` },
  };
  if (options?.body) {
    fetchOpts.body = JSON.stringify(options.body);
  }

  return fetch(url.toString(), fetchOpts);
}

export async function engineFetch(
  endpoint: string,
  options?: { method?: string; body?: unknown }
): Promise<unknown> {
  return maintenance.request(async()=>{const res = await rawEngineRequest(endpoint, options);return res.json();});
}


function waitForExit(child:ChildProcess):Promise<void>{
  if(child.exitCode!==null&&child.exitCode!==undefined || child.signalCode)return Promise.resolve();
  return new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>{child.kill("SIGKILL");},3_000);
    const deadline=setTimeout(()=>{cleanup();reject(new Error("The engine did not stop. Workspace files were kept."));},8_000);
    const cleanup=()=>{clearTimeout(timer);clearTimeout(deadline);child.removeListener("exit",done);};
    const done=()=>{cleanup();resolve();};child.once("exit",done);
  });
}
export function assertEngineAvailable(){maintenance.assertAvailable();}
export async function purgeWorkspaceData(request:any,nativeIdle:()=>boolean,onRestart:()=>Promise<unknown>=async()=>{}):Promise<any>{
  return maintenance.run(async()=>{
    const response=await rawEngineRequest("/connections/readiness");const result=await response.json();
    return result.status==="ok"&&result.busy===false&&nativeIdle();
  },async()=>{const child=engineProcess;if(child){stopEngine();await waitForExit(child);}},async()=>{
    return new Promise((resolve,reject)=>{
      const worker=spawn(launchPython||findPython(),["-m","compass.workspace_purge"],{cwd:getEngineDir(),stdio:["pipe","pipe","ignore"],env:engineEnvironment(process.env)});
      let output="";const timer=setTimeout(()=>{worker.kill("SIGTERM");},60_000);
      const hardTimer=setTimeout(()=>worker.kill("SIGKILL"),63_000);
      worker.stdin?.on("error",()=>{});
      worker.stdout?.on("data",chunk=>{output+=chunk.toString();if(output.length>16_000)worker.kill("SIGTERM");});
      worker.once("error",()=>{clearTimeout(timer);clearTimeout(hardTimer);reject(new Error("The deletion worker could not start. Workspace files were kept."));});
      worker.once("exit",()=>{clearTimeout(timer);clearTimeout(hardTimer);let result:any;try{result=JSON.parse(output);}catch{reject(new Error("The deletion worker stopped before completion. Resume deletion from Workspace."));return;}if(result.status!=="deleted"){reject(new Error(typeof result.message==="string"?result.message:"Deletion did not finish. Resume it from Workspace."));return;}resolve(result);});
      worker.stdin?.end(JSON.stringify(request));
    });
  },async()=>{await startEngine();await onRestart();});
}
