const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const vm=require('node:vm');
const {LegacyData,captureLegacyScript,removeLegacyScript}=require('../dist-electron/legacy-data.js');
function fixture(t){
 const data=new Map([['compass-prototypes',JSON.stringify([{html:'<script>throw Error("Must not run")</script>'}])],['compass-presentations','[malformed older data'],['compass-chat-L2ZpY3Rpb25hbA==','[{"content":"Earlier user text"}]'],['compass-feedback','[{"message":"Earlier feedback"}]'],['compass-api-key','fictional-secret'],['compass-onboarding-complete','true']]);
 const storage={get length(){return data.size;},key:index=>[...data.keys()][index]??null,getItem:key=>data.get(key)??null,removeItem:key=>data.delete(key),setItem:(key,value)=>data.set(key,value)};
 const run=code=>vm.runInNewContext(code,{localStorage:storage});
 const service=new LegacyData(async()=>run(captureLegacyScript),async snapshot=>run(removeLegacyScript(snapshot)));
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'compass-legacy-'));t.after(()=>fs.rmSync(directory,{recursive:true,force:true}));
 return {data,storage,run,service,destination:path.join(directory,'older.compass-legacy.json')};
}
test('export preserves malformed and unsafe artifact text without reading credentials or executing content',async t=>{
 const f=fixture(t),summary=await f.service.status();assert.equal(summary.records,4);assert.equal(summary.malformed,1);
 const result=await f.service.export(async()=>f.destination);assert.equal(result.status,'saved');
 const raw=fs.readFileSync(f.destination,'utf8'),archive=JSON.parse(raw);assert.equal(raw.includes('fictional-secret'),false);assert.ok(archive.records['compass-prototypes'].includes('<script>'));assert.equal(archive.records['compass-presentations'],'[malformed older data');assert.equal(fs.statSync(f.destination).mode&0o777,0o600);
 assert.equal(f.data.size,6);
});
test('native cancellation leaves all records and settings unchanged',async t=>{
 const f=fixture(t),before=[...f.data];assert.equal((await f.service.export(async()=>null)).status,'cancelled');assert.equal((await f.service.clear(async()=>false)).status,'cancelled');assert.deepEqual([...f.data],before);
});
test('clearing is snapshot-checked and removes only the legacy allowlist',async t=>{
 const f=fixture(t);await assert.rejects(f.service.clear(async()=>{f.data.set('compass-prototypes','Changed');return true;}),/changed/);assert.ok(f.data.has('compass-presentations'));
 assert.equal((await f.service.clear(async()=>true)).status,'cleared');assert.equal((await f.service.status()).records,0);assert.equal(f.data.get('compass-api-key'),'fictional-secret');assert.equal(f.data.get('compass-onboarding-complete'),'true');
});
test('changed data during an export dialog cannot replace an existing archive',async t=>{
 const f=fixture(t);fs.writeFileSync(f.destination,'Existing export');await assert.rejects(f.service.export(async()=>{f.data.set('compass-prototypes','New data');return f.destination;}),/changed/);assert.equal(fs.readFileSync(f.destination,'utf8'),'Existing export');
});
test('stored strings cannot inject script through the clear snapshot expression',async t=>{
 const f=fixture(t);f.data.set('compass-prototypes','</script>";throw Error("Injected");//');assert.equal((await f.service.clear(async()=>true)).status,'cleared');assert.equal(f.data.get('compass-api-key'),'fictional-secret');
});


test('a storage failure rolls back removed records and never reports success',async t=>{
 const f=fixture(t),before=Object.fromEntries(f.data);const remove=f.storage.removeItem;
 f.storage.removeItem=key=>{if(key==='compass-presentations')throw Error('Fictional storage failure');return remove(key);};
 await assert.rejects(f.service.clear(async()=>true),/could not be cleared/);assert.deepEqual(Object.fromEntries(f.data),before);
});
test('export and clear dialogs cannot race each other',async t=>{
 const f=fixture(t);let entered,release;const opened=new Promise(resolve=>entered=resolve);let confirmed=false;
 const exporting=f.service.export(async()=>{entered();return new Promise(resolve=>release=()=>resolve(f.destination));});await opened;
 const clearing=f.service.clear(async()=>{confirmed=true;return false;});await new Promise(resolve=>setImmediate(resolve));assert.equal(confirmed,false);
 release();await exporting;await clearing;assert.equal(confirmed,true);assert.ok(f.data.has('compass-prototypes'));
});
