const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { test } = require("node:test");

const code = fs.readFileSync(path.join(__dirname, "../dist-electron/engine-bridge.js"), "utf8");

function fixture({packaged=false,probe,spawned,resolveRuntime}={}) {
  const requests = [];
  const launches = [];
  const exported = {};
  const children=[],statuses=[],argumentsList=[];
  const child = () => {
    const process = new EventEmitter();
    process.exitCode=null;
    process.stdout = new EventEmitter();
    process.stderr = new EventEmitter();
    process.kill = () => {process.exitCode=0;process.emit("exit", 0);};
    return process;
  };
  const mockRequire = (name) => {
    if(name==="./engine-runtime")return resolveRuntime?{packagedEngine:resolveRuntime}:require("../dist-electron/engine-runtime.js");
    if(name==="./engine-maintenance")return require("../dist-electron/engine-maintenance.js");
    if (name === "electron") return {
      app: { isPackaged: packaged },
      BrowserWindow: { getAllWindows: () => [{webContents:{send:(_channel,status)=>statuses.push(status)}}] },
    };
    if (name === "child_process") return {
      spawn: (_python, _args, options) => {
        launches.push(options.env);
        argumentsList.push({python:_python,args:_args,cwd:options.cwd});const launched=child();children.push(launched);spawned?.(launched,children.length);return launched;
      },
    };
    if (name === "fs") return { existsSync: () => true };
    if (name === "net") return {
      createServer: () => ({
        listen: (_port, host, callback) => {assert.equal(host,"127.0.0.1");queueMicrotask(callback);},
        address: () => ({ port: 12345 }),
        close: (callback) => callback(),
        on() {},
      }),
    };
    return require(name);
  };
  vm.runInNewContext(code+"\nexports.probeHealth=pollHealth;", {
    require: mockRequire,
    exports: exported,
    __dirname,
    process: { platform: "darwin",arch:"arm64",resourcesPath:"/fictional/resources", env: {} },
    console: { log() {}, error() {} },
    URL, AbortController, AbortSignal, setTimeout, clearTimeout,
    fetch: async (url, options) => {
      requests.push({ url, options });
      if(probe)return probe(url,options,requests.length);
      return { ok:true,json: async () => ({ status: "ready" }) };
    },
  });
  return { bridge: exported, requests, launches,children,statuses,argumentsList };
}

test("health, JSON calls and streaming requests use the private launch token", async () => {
  const { bridge, requests, launches } = fixture();
  await bridge.startEngine();
  await bridge.engineFetch("/health");
  await bridge.engineRequest("/chat/stream", { body: { message: "Fictional" } });
  assert.match(launches[0].COMPASS_ENGINE_TOKEN, /^[a-f0-9]{64}$/);
  assert.equal(requests.length, 3);
  for (const request of requests) {
    assert.equal(request.options.headers.Authorization, `Bearer ${launches[0].COMPASS_ENGINE_TOKEN}`);
    assert.equal(new URL(request.url).origin, "http://127.0.0.1:12345");
  }
  assert.equal(requests[2].options.method, "POST");
  bridge.stopEngine();
});

test("restart rotates the token and stopped engine requests fail", async () => {
  const { bridge, launches } = fixture();
  await bridge.startEngine();
  bridge.stopEngine();
  await assert.rejects(bridge.engineFetch("/health"), /Engine not started/);
  await bridge.startEngine();
  assert.notEqual(launches[0].COMPASS_ENGINE_TOKEN, launches[1].COMPASS_ENGINE_TOKEN);
  bridge.stopEngine();
});

test("caller-controlled endpoints cannot send the token to another origin", async () => {
  const { bridge, requests } = fixture();
  await bridge.startEngine();
  for (const endpoint of ["https://untrusted.example/", "//untrusted.example/", "@untrusted.example/"]) {
    await assert.rejects(bridge.engineRequest(endpoint), /Engine endpoint must stay/);
  }
  assert.equal(requests.length, 1);
  bridge.stopEngine();
});

test("desktop child environment drops provider credentials and requires native grants",()=>{
 const {bridge}=fixture();
 const environment=bridge.engineEnvironment({PATH:'/fictional/bin',ANTHROPIC_API_KEY:'fictional-secret',OPENROUTER_API_KEY:'fictional-secret',HF_TOKEN:'fictional-hf',COMPASS_CHATGPT_ACCESS_TOKEN:'fictional-secret',COMPASS_AUTH_TOKEN:'fictional-secret'});
 assert.equal(environment.PATH,'/fictional/bin');assert.equal(environment.COMPASS_NATIVE_INFERENCE_ONLY,'1');
 for(const name of ['ANTHROPIC_API_KEY','OPENROUTER_API_KEY','HF_TOKEN','COMPASS_CHATGPT_ACCESS_TOKEN','COMPASS_AUTH_TOKEN'])assert.equal(environment[name],undefined);
});


test("concurrent startup shares one process and one readiness operation",async()=>{
 let release;const gate=new Promise(resolve=>{release=resolve;});
 const f=fixture({probe:async()=>{await gate;return {ok:true,json:async()=>({status:"ready"})};}});
 const first=f.bridge.startEngine(),second=f.bridge.startEngine();assert.equal(first,second);
 release();await Promise.all([first,second]);assert.equal(f.children.length,1);assert.equal(f.requests.length,1);f.bridge.stopEngine();
});
test("failed startup clears the launch and can be retried",async()=>{
 const f=fixture({spawned:(child,count)=>{if(count===1)queueMicrotask(()=>{child.exitCode=17;child.emit("exit",17);});}});
 await assert.rejects(f.bridge.startEngine(),/did not become ready/);assert.equal(f.statuses.some(status=>status.state==="ready"),false);
 await f.bridge.startEngine();assert.equal(f.children.length,2);assert.notEqual(f.launches[0].COMPASS_ENGINE_TOKEN,f.launches[1].COMPASS_ENGINE_TOKEN);f.bridge.stopEngine();
});
test("spawn errors reject startup without leaving an engine port or crashing the host",async()=>{
 const f=fixture({spawned:(child,count)=>{if(count===1)queueMicrotask(()=>child.emit("error",Error("fictional launch failure")));}});
 await assert.rejects(f.bridge.startEngine(),/did not become ready/);assert.equal(f.bridge.getEnginePort(),0);
 await f.bridge.startEngine();assert.equal(f.children.length,2);f.bridge.stopEngine();
});
test("stopping during readiness cannot mark the cancelled launch ready or interfere with its replacement",async()=>{
 const f=fixture({probe:(_url,options,count)=>count===1?new Promise((_,reject)=>options.signal.addEventListener("abort",()=>reject(Error("aborted")),{once:true})):Promise.resolve({ok:true,json:async()=>({status:"ready"})})});
 const first=f.bridge.startEngine();await new Promise(resolve=>setTimeout(resolve,0));f.bridge.stopEngine();const second=f.bridge.startEngine();
 await assert.rejects(first,/did not become ready|cancelled/);await second;
 assert.equal(f.children.length,2);assert.equal(f.statuses.filter(status=>status.state==="ready").length,1);assert.equal(f.statuses.some(status=>status.state==="error"),false);f.bridge.stopEngine();
});
test("readiness bounds an unfinished response body and never accepts non-success HTTP",async()=>{
 const hanging=fixture({probe:async(_url,options)=>({ok:true,json:()=>new Promise((_,reject)=>options.signal.addEventListener("abort",()=>reject(Error("body aborted")),{once:true}))})});
 const keepAlive=setTimeout(()=>{},1000);try{const started=Date.now();assert.equal(await hanging.bridge.probeHealth(12345,"fixture-token",new AbortController().signal,()=>true,20),false);assert.ok(Date.now()-started<500);}finally{clearTimeout(keepAlive);}
 const failed=fixture({probe:async()=>({ok:false,json:async()=>({status:"ready"})})});assert.equal(await failed.bridge.probeHealth(12345,"fixture-token",new AbortController().signal,()=>true,10),false);
});
test("packaged startup uses only its bundled Python with isolated flags and refuses a missing runtime",async()=>{
 const f=fixture({packaged:true,resolveRuntime:()=>({python:"/fictional/resources/engine-runtime/bin/python3",directory:"/fictional/resources/engine-runtime",flags:["-I","-B"]})});
 await f.bridge.startEngine();assert.deepEqual(Array.from(f.argumentsList[0].args).slice(0,4),["-I","-B","-m","compass.server"]);assert.equal(f.argumentsList[0].cwd,"/fictional/resources/engine-runtime");
 const env=f.bridge.engineEnvironment({PYTHONPATH:"/unrelated",PYTHONHOME:"/unrelated",VIRTUAL_ENV:"/unrelated",CONDA_PREFIX:"/unrelated",PATH:"/fixture"});for(const key of ["PYTHONPATH","PYTHONHOME","VIRTUAL_ENV","CONDA_PREFIX"])assert.equal(env[key],undefined);f.bridge.stopEngine();
 const missing=fixture({packaged:true,resolveRuntime:()=>{throw Error("Reinstall the incomplete bundle");}});await assert.rejects(missing.bridge.startEngine(),/Reinstall/);assert.equal(missing.children.length,0);assert.equal(missing.requests.length,0);assert.equal(missing.statuses.at(-1).state,"error");
});
