const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {test}=require('node:test');
const {packagedEngine}=require('../dist-electron/engine-runtime.js');
const contract=require('../dist-electron/engine-runtime.json');
function fixture(t){
 const resources=fs.mkdtempSync(path.join(os.tmpdir(),'compass-runtime-policy-'));t.after(()=>fs.rmSync(resources,{force:true,recursive:true}));
 const root=path.join(resources,'engine-runtime');fs.mkdirSync(path.join(root,'bin'),{recursive:true});
 const python=path.join(root,'bin','python3.11');fs.writeFileSync(python,'fictional executable',{mode:0o755});fs.symlinkSync('python3.11',path.join(root,'bin','python3'));
 const file=path.join(root,'compass-runtime.json');
 const receipt={format:'compass-desktop-runtime-v1',target:'mac-arm64',python:contract.python,distribution_sha256:contract.targets['mac-arm64'].sha256,requirements_sha256:'a'.repeat(64),engine_sha256:'b'.repeat(64)};
 fs.writeFileSync(file,JSON.stringify(receipt));return {resources,root,python,file,receipt};
}
test('packaged runtime resolves only a compatible private app resource and contained executable',t=>{
 const f=fixture(t),runtime=packagedEngine(f.resources,'darwin','arm64');assert.equal(runtime.directory,f.root);assert.equal(fs.realpathSync(runtime.python),fs.realpathSync(f.python));assert.deepEqual(runtime.flags,['-I','-B']);
});
for(const change of [{format:'other'},{target:'mac-x64'},{python:'3.11.11'},{distribution_sha256:'wrong'},{requirements_sha256:'z'.repeat(64)},{engine_sha256:''}]){
 test('incompatible runtime receipt fails closed: '+Object.keys(change).join(','),t=>{
  const f=fixture(t);fs.writeFileSync(f.file,JSON.stringify({...f.receipt,...change}));assert.throws(()=>packagedEngine(f.resources,'darwin','arm64'),/Reinstall/);
 });
}
test('missing, corrupt and oversized runtime receipts never fall back to system Python',t=>{
 const f=fixture(t);for(const content of ['',JSON.stringify({padding:'x'.repeat(16_000)})]){fs.writeFileSync(f.file,content);assert.throws(()=>packagedEngine(f.resources,'darwin','arm64'),/Reinstall/);}
 fs.unlinkSync(f.file);assert.throws(()=>packagedEngine(f.resources,'darwin','arm64'),/Reinstall/);assert.throws(()=>packagedEngine(f.resources,'win32','x64'),/supported macOS/);
});
test('external executable or receipt symlinks and non-executable files cannot become the bundled engine',t=>{
 const f=fixture(t);fs.unlinkSync(path.join(f.root,'bin','python3'));const outside=path.join(f.resources,'outside');fs.writeFileSync(outside,'fictional executable',{mode:0o755});fs.symlinkSync(outside,path.join(f.root,'bin','python3'));assert.throws(()=>packagedEngine(f.resources,'darwin','arm64'),/Reinstall/);
 fs.unlinkSync(path.join(f.root,'bin','python3'));fs.symlinkSync('python3.11',path.join(f.root,'bin','python3'));fs.chmodSync(f.python,0o644);assert.throws(()=>packagedEngine(f.resources,'darwin','arm64'),/Reinstall/);fs.chmodSync(f.python,0o755);
 fs.unlinkSync(f.file);fs.writeFileSync(outside,JSON.stringify(f.receipt));fs.symlinkSync(outside,f.file);assert.throws(()=>packagedEngine(f.resources,'darwin','arm64'),/Reinstall/);
});
