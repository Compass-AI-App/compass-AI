/**
 * Engine Bridge — spawns the Python engine server and manages its lifecycle.
 *
 * On app startup: finds Python, picks a free port, spawns the FastAPI server,
 * polls /health until ready. On quit: kills the child process.
 *
 * Packaged builds use a preassembled, isolated CPython runtime; no first-launch install.
 * Handles engine crashes with restart capability.
 */

import { app, BrowserWindow } from "electron";
import { ChildProcess, spawn, execSync } from "child_process";
import { existsSync } from "fs";
import {packagedEngine} from "./engine-runtime";
import path from "path";
import net from "net";
import crypto from "crypto";
import {EngineMaintenance} from "./engine-maintenance";
const maintenance=new EngineMaintenance();
let stoppedChild:ChildProcess|null=null;
let launchPython="";
let launchFlags:string[]=[];
let startup:Promise<number>|null=null;
let startupAbort:AbortController|undefined;
let launchEpoch=0;

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
    return path.join(process.resourcesPath, "engine-runtime");
  }
  return path.resolve(__dirname, "../../engine");
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

  // Packaged app: fail closed when its prebuilt runtime is unavailable.
  if (isPackaged) {
    return packagedEngine(process.resourcesPath,process.platform,process.arch).python;
  }

  // Dev fallback: use system Python
  return findSystemPython();
}

function findFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, "127.0.0.1", () => {
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

async function pollHealth(port:number,token:string,signal:AbortSignal,alive:()=>boolean,timeoutMs=30_000):Promise<boolean>{
  const deadline=Date.now()+timeoutMs;
  while(Date.now()<deadline&&!signal.aborted&&alive()){
    try{
      const response=await fetch(`http://127.0.0.1:${port}/health`,{headers:{Authorization:`Bearer ${token}`},signal:AbortSignal.any([signal,AbortSignal.timeout(Math.max(1,Math.min(1000,deadline-Date.now())))])});
      const data=await response.json();
      if(response.ok&&data.status==="ready"&&!signal.aborted&&alive())return true;
    }catch{/* Startup has one total deadline, including response-body reads. */}
    if(!signal.aborted&&alive())await new Promise(resolve=>setTimeout(resolve,Math.min(100,Math.max(0,deadline-Date.now()))));
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
  if(isPackaged)for(const name of Object.keys(environment))if(name.startsWith("PYTHON")||name==="VIRTUAL_ENV"||name.startsWith("CONDA"))delete environment[name];
  environment.COMPASS_NATIVE_INFERENCE_ONLY="1";
  return environment;
}

export function startEngine():Promise<number>{
  if(startup)return startup;
  if(engineProcess&&enginePort)return Promise.resolve(enginePort);
  const operation=launchEngine();startup=operation;
  const settled=()=>{if(startup===operation)startup=null;};
  operation.then(settled,settled);return operation;
}
async function launchEngine():Promise<number>{
  const epoch=++launchEpoch,controller=new AbortController();startupAbort=controller;
  let child:ChildProcess|undefined,exited=false;
  try{
    if(stoppedChild)await waitForExit(stoppedChild);
    if(controller.signal.aborted||epoch!==launchEpoch)throw new Error("Engine startup was cancelled.");
    intentionalStop=false;
    notifyRenderer("engine-status",{state:"starting",message:"Starting engine…"});
    const runtime=isPackaged?packagedEngine(process.resourcesPath,process.platform,process.arch):{python:findPython(),directory:getEngineDir(),flags:["-B"]};
    const port=await findFreePort(),token=crypto.randomBytes(32).toString("hex");
    if(controller.signal.aborted||epoch!==launchEpoch)throw new Error("Engine startup was cancelled.");
    launchPython=runtime.python;launchFlags=runtime.flags;
    child=spawn(runtime.python,[...runtime.flags,"-m","compass.server",String(port)],{cwd:runtime.directory,stdio:["ignore","pipe","pipe"],env:{...engineEnvironment(process.env),COMPASS_ENGINE_PORT:String(port),COMPASS_ENGINE_TOKEN:token}});
    const launched=child;
    engineProcess=child;enginePort=port;engineToken=token;
    child.stdout?.on("data",(data:Buffer)=>console.log(`[engine] ${data.toString().trim()}`));
    child.stderr?.on("data",(data:Buffer)=>console.error(`[engine] ${data.toString().trim()}`));
    child.once("error",()=>{
      exited=true;controller.abort();
      if(engineProcess===launched){engineProcess=null;enginePort=0;engineToken="";}
      if(epoch===launchEpoch)notifyRenderer("engine-status",{state:"error",message:"The Compass engine process could not run. Restart Compass or reinstall this build."});
    });
    child.once("exit",code=>{
      exited=true;
      const current=engineProcess===launched;
      if(current){engineProcess=null;enginePort=0;engineToken="";}
      if(stoppedChild===launched)stoppedChild=null;
      if(current&&!intentionalStop&&epoch===launchEpoch)notifyRenderer("engine-status",{state:"crashed",message:`Engine stopped unexpectedly (exit code ${code}). Restart it to continue.`});
    });
    if(!await pollHealth(port,token,controller.signal,()=>!exited&&epoch===launchEpoch))throw new Error("The Compass engine did not become ready. Restart Compass or reinstall this build if the problem continues.");
    if(epoch!==launchEpoch)throw new Error("Engine startup was cancelled.");
    process.env.COMPASS_ENGINE_PORT=String(port);
    notifyRenderer("engine-status",{state:"ready",message:"Engine ready"});
    return port;
  }catch(cause){
    if(child&&!exited){child.kill("SIGTERM");await waitForExit(child);}
    if(engineProcess===child){engineProcess=null;enginePort=0;engineToken="";}
    if(epoch===launchEpoch)notifyRenderer("engine-status",{state:"error",message:cause instanceof Error?cause.message:"The engine could not start. Restart Compass."});
    throw cause;
  }finally{if(startupAbort===controller)startupAbort=undefined;}
}

export function stopEngine(): void {
  launchEpoch++;startupAbort?.abort();startup=null;
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
      const worker=spawn(launchPython||findPython(),[...launchFlags,"-m","compass.workspace_purge"],{cwd:getEngineDir(),stdio:["pipe","pipe","ignore"],env:engineEnvironment(process.env)});
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
