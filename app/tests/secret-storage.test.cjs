const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const vm = require("node:vm");
const { test } = require("node:test");

const mainCode = fs.readFileSync(path.join(__dirname, "../dist-electron/main.js"), "utf8");

function fixture(t, { platform = "darwin", available = true, backend = "gnome_libsecret" } = {}) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "compass-secret-check-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const handlers = new Map();
  const state = { available };
  const engineCalls=[];
  const electron = {
    app: {
      getPath: () => directory,
      requestSingleInstanceLock: () => true,
      whenReady: () => ({ then() {} }),
      setAsDefaultProtocolClient() {},
      on() {},
    },
    ipcMain: { handle: (name, handler) => handlers.set(name, handler) },
    safeStorage: {
      isEncryptionAvailable: () => state.available,
      getSelectedStorageBackend: () => {
        assert.equal(platform, "linux");
        return backend;
      },
      // This fixture checks credential policy and IPC behavior, not OS cryptography.
      encryptString: (value) => Buffer.from(`fixture-ciphertext:${value}`),
      decryptString: (value) => {
        const text = value.toString();
        if (!text.startsWith("fixture-ciphertext:")) throw new Error("Not encrypted");
        return text.slice("fixture-ciphertext:".length);
      },
    },
  };
  const exported={};
  vm.runInNewContext(mainCode+"\nexports.storageAvailable=hasSecureSecretStorage;", {
    require: (name) => {
      if (name === "electron") return electron;
      if (name === "electron-updater") return { autoUpdater: {} };
      // Sender authorization is exercised independently in ipc.test.cjs.
      if (name === "./ipc") return { handleMainIPC: electron.ipcMain.handle };
      if (name === "./release-policy") return require("../dist-electron/release-policy.js");
      if (name === "./ai-connections") return {engineOperation:()=>"other"};
      if (name === "./engine-bridge") return {engineFetch:async(endpoint)=>{engineCalls.push(endpoint);return {status:"ok"};}};
      if (name === "./legacy-credentials") return require("../dist-electron/legacy-credentials.js");
      if (name.startsWith("./")) return {};
      return require(name);
    },
    exports: exported,
    __dirname: path.join(directory, "dist-electron"),
    process: { platform, argv: [], env: {} },
    Buffer,
    console,
  });
  return {
    call: (name, ...args) => handlers.get(name)({}, ...args),
    file: path.join(directory, "secrets.enc"),
    state, engineCalls, storageAvailable:exported.storageAvailable,
  };
}

test("production secure-storage policy rejects unavailable OS storage and Linux basic_text",t=>{
  assert.equal(fixture(t,{available:false}).storageAvailable(),false);
  assert.equal(fixture(t,{platform:"linux",backend:"basic_text"}).storageAvailable(),false);
  assert.equal(fixture(t,{platform:"linux",backend:"gnome_libsecret"}).storageAvailable(),true);
  assert.equal(fixture(t).storageAvailable(),true);
});

test("retired generic credential handlers are not registered",t=>{
  const vault=fixture(t);
  for(const name of ["secrets-store","secrets-load","secrets-delete","credential-store","credential-load","credential-delete","credential-list"]){
    assert.throws(()=>vault.call(name,"key","value"),/not a function/);
  }
});

test("main process rejects deferred engine calls before invoking its transport", async t => {
  const f=fixture(t);
  for(const endpoint of ["/git/push","/prototype/generate","/configure","/documents/delete","/chat/stream"]) {
    assert.equal((await f.call("engine-call",endpoint,{})).status,"error");
  }
  assert.deepEqual(f.engineCalls,[]);
  assert.equal((await f.call("engine-call","/tasks/list",{})).status,"error");
  assert.deepEqual(f.engineCalls,[]);
});
