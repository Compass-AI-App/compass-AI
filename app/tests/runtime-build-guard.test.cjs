const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const vm=require('node:vm');
const {createHash}=require('node:crypto');
const {test}=require('node:test');
const contract=require('../electron/engine-runtime.json');
const code=fs.readFileSync(path.join(__dirname,'../scripts/verify-engine-runtime.cjs'),'utf8');
function fixture(t){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'compass-build-guard-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const runtime=path.join(root,'.runtime/mac-arm64'),source=path.join(root,'engine/compass');fs.mkdirSync(source,{recursive:true});fs.mkdirSync(path.join(runtime,'lib/python3.11/site-packages/compass'),{recursive:true});fs.mkdirSync(path.join(runtime,'bin'),{recursive:true});
 const content='"""Fictional engine."""\n';fs.writeFileSync(path.join(source,'server.py'),content);fs.writeFileSync(path.join(runtime,'lib/python3.11/site-packages/compass/server.py'),content);fs.writeFileSync(path.join(runtime,'bin/python3'),'fictional executable',{mode:0o755});fs.writeFileSync(path.join(root,'engine/requirements-desktop.lock'),'fixture lock');
 const receipt={format:'compass-desktop-runtime-v1',target:'mac-arm64',python:contract.python,distribution_sha256:contract.targets['mac-arm64'].sha256,requirements_sha256:createHash('sha256').update('fixture lock').digest('hex'),engine_sha256:createHash('sha256').update('server.py\0'+content).digest('hex')};
 const file=path.join(runtime,'compass-runtime.json');fs.writeFileSync(file,JSON.stringify(receipt));
 const module={exports:{}};vm.runInNewContext(code,{require:name=>name==='builder-util'?{Arch:{3:'arm64',4:'universal'}}:name==='../electron/engine-runtime.json'?contract:require(name),module,__dirname:path.join(root,'app/scripts')});
 return {guard:module.exports,file,source,runtime,root};
}
test('guard admits matching source/runtime bytes and rejects a stale source or dependency lock',async t=>{
 const f=fixture(t);await f.guard({electronPlatformName:'darwin',arch:3});
 fs.appendFileSync(path.join(f.source,'server.py'),'# changed source\n');await assert.rejects(f.guard({electronPlatformName:'darwin',arch:3}),/Missing, incompatible or stale/);
 const g=fixture(t);fs.appendFileSync(path.join(g.root,'engine/requirements-desktop.lock'),'changed lock');await assert.rejects(g.guard({electronPlatformName:'darwin',arch:3}),/stale/);
});
test('missing runtime, universal and unsupported OS builds cannot produce an installer',async t=>{
 const f=fixture(t);fs.unlinkSync(f.file);await assert.rejects(f.guard({electronPlatformName:'darwin',arch:3}),/Build the matching offline engine/);
 await assert.rejects(f.guard({electronPlatformName:'darwin',arch:4}),/built separately/);await assert.rejects(f.guard({electronPlatformName:'win32',arch:3}),/only for macOS/);
});
