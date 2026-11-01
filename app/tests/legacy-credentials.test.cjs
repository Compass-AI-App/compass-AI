const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const vm=require('node:vm');
const {test}=require('node:test');
const {LegacyCredentials,captureCredentialScript,removeCredentialScript}=require('../dist-electron/legacy-credentials.js');
const {AIVault}=require('../dist-electron/ai-vault.js');
const {AIConnections}=require('../dist-electron/ai-connections.js');
function fixture(t){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'compass-old-keys-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const browser=new Map();let available=true,failRemove=false,network=async()=>({});
 const localStorage={getItem:key=>browser.has(key)?browser.get(key):null,removeItem:key=>{if(failRemove)throw Error();browser.delete(key);}};
 const capture=async()=>vm.runInNewContext(captureCredentialScript,{localStorage});
 const remove=async records=>vm.runInNewContext(removeCredentialScript(records),{localStorage});
 const decrypt=value=>{if(!available||!value.toString().startsWith('encrypted:'))throw Error('Locked');return value.toString().slice(10);};
 const vault=new AIVault(path.join(dir,'new.enc'),{available:()=>available,encrypt:value=>Buffer.from('encrypted:'+value),decrypt});
 const file=path.join(dir,'secrets.enc');
 const legacy=new LegacyCredentials(file,capture,remove,decrypt);
 let busy=false;
 const ai=new AIConnections(vault,async()=>{},async()=>({status:'ok',busy}),(...args)=>network(...args),'',undefined,undefined,record=>legacy.removeMatching(record));
 return {browser,file,vault,legacy,ai,encrypt:value=>Buffer.from('encrypted:'+value).toString('base64'),setNetwork:fn=>{network=fn;},lock:()=>{available=false;},failRemove:()=>{failRemove=true;},allowRemove:()=>{failRemove=false;},setBusy:value=>{busy=value;}};
}
test('status is metadata only and browser removal treats script-like values as inert text',async t=>{
 const f=fixture(t),key='fictional-</script>";throw Error("injection");';f.browser.set('compass-api-key',key);f.browser.set('other-setting','keep');
 const summary=await f.legacy.status();assert.equal(summary.browserKey,true);assert.equal(JSON.stringify(summary).includes(key),false);
 assert.equal((await f.legacy.clear(async()=>false)).status,'cancelled');assert.equal(f.browser.get('compass-api-key'),key);
 assert.equal((await f.legacy.clear(async()=>true)).status,'cleared');assert.equal(f.browser.get('other-setting'),'keep');
});
test('browser migration validates selected provider, consumes only old key and preserves active selection on retry',async t=>{
 const f=fixture(t);f.browser.set('compass-api-key','fixture-key');f.browser.set('compass-cloud-token','cloud-stays');
 f.setNetwork(async(url,init)=>{assert.equal(url,'https://openrouter.ai/api/v1/key');assert.equal(init.headers.Authorization,'Bearer fixture-key');return {};});
 const list=await f.legacy.migrateBrowser(f.ai,'openrouter');assert.equal(list.length,1);assert.equal(JSON.stringify(list).includes('fixture-key'),false);assert.equal(f.browser.has('compass-api-key'),false);assert.equal(f.browser.get('compass-cloud-token'),'cloud-stays');assert.equal(f.vault.read().active,null);
 const data=f.vault.read();data.connections[0].model='fixture/model';data.active=list[0].id;data.managed=true;f.vault.write(data);
 f.browser.set('compass-api-key','fixture-key');await f.legacy.migrateBrowser(f.ai,'openrouter');assert.equal(f.ai.list().length,1);assert.equal(f.ai.status().active.model,'fixture/model');
});
test('locked storage and failed provider validation preserve older key without new records',async t=>{
 const f=fixture(t);f.browser.set('compass-api-key','fixture-key');f.setNetwork(async()=>{throw Error('Provider unavailable');});
 await assert.rejects(f.legacy.migrateBrowser(f.ai,'anthropic'),/Provider unavailable/);assert.equal(f.vault.read().connections.length,0);assert.equal(f.browser.get('compass-api-key'),'fixture-key');
 f.lock();await assert.rejects(f.legacy.migrateBrowser(f.ai,'anthropic'),/OS keychain/);assert.equal(f.browser.get('compass-api-key'),'fixture-key');
});
test('changing a source during provider validation prevents persistence',async t=>{
 const f=fixture(t);f.browser.set('compass-api-key','fixture-key');f.setNetwork(async()=>{f.browser.set('compass-api-key','newer-key');return {};});
 await assert.rejects(f.legacy.migrateBrowser(f.ai,'anthropic'),/changed during validation/);assert.equal(f.vault.read().connections.length,0);assert.equal(f.browser.get('compass-api-key'),'newer-key');
});
test('failed consumption reports recoverable secure copy and retry does not duplicate it',async t=>{
 const f=fixture(t);f.browser.set('compass-api-key','fixture-key');f.failRemove();
 await assert.rejects(f.legacy.migrateBrowser(f.ai,'anthropic'),/saved securely.*older copy/);assert.equal(f.ai.list().length,1);assert.equal(f.browser.get('compass-api-key'),'fixture-key');
 f.allowRemove();await f.legacy.migrateBrowser(f.ai,'anthropic');assert.equal(f.ai.list().length,1);assert.equal(f.browser.has('compass-api-key'),false);
});
test('saved Claude import consumes encrypted slot, retains unrelated connector and rejects plaintext fallback',async t=>{
 const f=fixture(t);fs.writeFileSync(f.file,JSON.stringify({'anthropic-api-key':f.encrypt('fixture-claude'),'credential:github':'unrelated'}));
 await f.legacy.importClaude(f.ai);assert.deepEqual(JSON.parse(fs.readFileSync(f.file)),{'credential:github':'unrelated'});assert.equal(f.vault.read().connections[0].accessToken,'fixture-claude');
 fs.writeFileSync(f.file,JSON.stringify({'anthropic-api-key':'old-plaintext'}));await assert.rejects(f.legacy.importClaude(f.ai),/could not be decrypted/);assert.equal(JSON.parse(fs.readFileSync(f.file))['anthropic-api-key'],'old-plaintext');
});
test('corrupt legacy file is preserved on migration and explicitly removable without touching new connections',async t=>{
 const f=fixture(t);await f.ai.saveKey('anthropic','current-key');fs.writeFileSync(f.file,'{broken');f.browser.set('compass-cloud-token','retired-token');
 assert.equal((await f.legacy.status()).nativeRecords,null);await assert.rejects(f.legacy.importClaude(f.ai),/unreadable/);assert.equal(fs.readFileSync(f.file,'utf8'),'{broken');
 assert.equal((await f.legacy.clear(async()=>true)).status,'cleared');assert.equal(fs.existsSync(f.file),false);assert.equal(f.browser.has('compass-cloud-token'),false);assert.equal(f.ai.list()[0].status,'connected');
});
test('legacy symlink and oversized file are rejected without following or deleting them',async t=>{
 const f=fixture(t),target=path.join(path.dirname(f.file),'original');fs.writeFileSync(target,'{}');fs.symlinkSync(target,f.file);
 await assert.rejects(f.legacy.status(),/safely read/);await assert.rejects(f.legacy.clear(async()=>true),/safely read/);assert.equal(fs.readFileSync(target,'utf8'),'{}');fs.unlinkSync(f.file);fs.writeFileSync(f.file,Buffer.alloc(1_000_001));await assert.rejects(f.legacy.status(),/safely read/);
});
test('cleanup rechecks after confirmation and reports partial native/browser removal honestly',async t=>{
 const f=fixture(t);fs.writeFileSync(f.file,'{}');
 await assert.rejects(f.legacy.clear(async()=>{fs.writeFileSync(f.file,'{"new":"copy"}');return true;}),/changed/);assert.equal(fs.existsSync(f.file),true);
 f.browser.set('compass-api-key','fixture-key');f.failRemove();await assert.rejects(f.legacy.clear(async()=>true),/Native cleanup may have completed/);assert.equal(fs.existsSync(f.file),false);assert.equal(f.browser.get('compass-api-key'),'fixture-key');
});
test('sign-out removes matching native/browser and duplicate vault copies, preserving distinct connections',async t=>{
 const f=fixture(t);const [first]=await f.ai.saveKey('anthropic','fixture-key');await f.ai.saveKey('openrouter','other-key');
 const data=f.vault.read();data.connections.push({...data.connections[0],id:'b'.repeat(32)});data.active='b'.repeat(32);data.managed=true;f.vault.write(data);
 fs.writeFileSync(f.file,JSON.stringify({'anthropic-api-key':f.encrypt('fixture-key'),'credential:claude':f.encrypt(JSON.stringify({api_key:'fixture-key'})),'credential:github':'unrelated'}));f.browser.set('compass-api-key','fixture-key');f.browser.set('compass-cloud-token','different-token');
 f.setBusy(true);await assert.rejects(f.ai.disconnect(first.id),/Finish or cancel/);assert.equal(f.browser.has('compass-api-key'),true);
 f.setBusy(false);await f.ai.disconnect(first.id);assert.equal(f.ai.status().active,null);assert.equal(f.ai.list().filter(item=>item.provider==='anthropic').every(item=>item.status==='signed_out'),true);assert.equal(f.vault.read().connections[1].accessToken,'other-key');assert.deepEqual(JSON.parse(fs.readFileSync(f.file)),{'credential:github':'unrelated'});assert.equal(f.browser.get('compass-cloud-token'),'different-token');
});
test('failed legacy cleanup keeps current connection recoverable and permits explicit cleanup then sign-out',async t=>{
 const f=fixture(t),[record]=await f.ai.saveKey('anthropic','fixture-key');fs.writeFileSync(f.file,JSON.stringify({'anthropic-api-key':'old-plaintext'}));
 await assert.rejects(f.ai.disconnect(record.id),/older credential copy could not be checked/);assert.equal(f.vault.read().connections[0].accessToken,'fixture-key');await f.legacy.clear(async()=>true);await f.ai.disconnect(record.id);assert.equal(f.ai.list()[0].status,'signed_out');
});
test('manual key saves serialize with sign-out and do not leave a pending duplicate credential',async t=>{
 const f=fixture(t),[record]=await f.ai.saveKey('anthropic','fixture-key');let release,started;const pending=new Promise(resolve=>{started=resolve;});f.setNetwork(async()=>{started();await new Promise(resolve=>{release=resolve;});return {};});
 const save=f.ai.saveKey('anthropic','fixture-key');await pending;const disconnect=f.ai.disconnect(record.id);release();await Promise.all([save,disconnect]);assert.equal(f.ai.list().length,1);assert.equal(f.vault.read().connections[0].accessToken,'');
});
test('failed protected-store write preserves the original key and never consumes its source',async t=>{
 const f=fixture(t);f.browser.set('compass-api-key','fixture-key');const original=f.vault.write;f.vault.write=()=>{throw Error('Disk full');};
 try{await assert.rejects(f.legacy.migrateBrowser(f.ai,'anthropic'),/Disk full/);}finally{f.vault.write=original;}
 assert.equal(f.browser.get('compass-api-key'),'fixture-key');assert.equal(f.vault.read().connections.length,0);
});
test('older credential removal needs no unlocked keychain and failed atomic native cleanup preserves both stores',async t=>{
 const f=fixture(t),[record]=await f.ai.saveKey('anthropic','fixture-key');const raw=JSON.stringify({'anthropic-api-key':f.encrypt('fixture-key')});fs.writeFileSync(f.file,raw);
 const rename=fs.renameSync;fs.renameSync=()=>{throw Error('Disk unavailable');};
 try{await assert.rejects(f.ai.disconnect(record.id),/Disk unavailable/);}finally{fs.renameSync=rename;}
 assert.equal(fs.readFileSync(f.file,'utf8'),raw);assert.equal(f.vault.read().connections[0].accessToken,'fixture-key');assert.equal(fs.readdirSync(path.dirname(f.file)).some(name=>name.endsWith('.tmp')),false);
 f.lock();assert.equal((await f.legacy.clear(async()=>true)).status,'cleared');assert.equal(fs.existsSync(f.file),false);
});
