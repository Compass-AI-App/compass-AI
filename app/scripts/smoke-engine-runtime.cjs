/** Exercise actual packaged bridge/server/worker bytes without accounts or system Python. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const vm=require('node:vm');
const childProcess=require('node:child_process');
const resources=path.resolve(process.argv[2]||'');
if(!process.argv[2])throw Error('Pass the packaged app Resources directory.');
const compiled=path.resolve(__dirname,'../dist-electron');
const directory=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'compass-packaged-smoke-')));
const children=[],statuses=[],exported={};
const environment={...process.env,PATH:'/no-system-python',PYTHONPATH:'/unrelated-python-path',PYTHONHOME:'/unrelated-python-home',VIRTUAL_ENV:'/unrelated-venv',COMPASS_LLM_PROVIDER:'anthropic',ANTHROPIC_API_KEY:'fictional-key-must-not-reach-engine'};
vm.runInNewContext(fs.readFileSync(path.join(compiled,'engine-bridge.js'),'utf8'),{
 exports:exported,__dirname:compiled,process:{platform:process.platform,arch:process.arch,resourcesPath:resources,env:environment},
 require:name=>{
  if(name==='electron')return {app:{isPackaged:true},BrowserWindow:{getAllWindows:()=>[{webContents:{send:(_channel,status)=>statuses.push(status)}}]}};
  if(name==='child_process')return {...childProcess,spawn:(python,args,options)=>{
   assert.equal(python,path.join(resources,'engine-runtime/bin/python3'));assert.deepEqual(Array.from(args).slice(0,3),['-I','-B','-m']);assert.equal(options.env.ANTHROPIC_API_KEY,undefined);assert.equal(options.env.PYTHONPATH,undefined);assert.equal(options.env.PYTHONHOME,undefined);
   const child=childProcess.spawn(python,args,options);children.push(child);return child;
  },execSync:()=>{throw Error('System Python/bootstrap commands must never run.');}};
  return name.startsWith('./')?require(path.join(compiled,name)):require(name);
 },console,URL,Buffer,AbortController,AbortSignal,setTimeout,clearTimeout,fetch,
});
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function call(endpoint,body){const result=await exported.engineFetch(endpoint,body?{body}:undefined);assert.equal(result.status,'ok',JSON.stringify(result));return result;}
async function stopped(child){
 if(child.exitCode!==null||child.signalCode)return;
 await new Promise((resolve,reject)=>{const timer=setTimeout(()=>{child.kill('SIGKILL');reject(Error('Packaged engine did not stop.'));},5000);child.once('exit',()=>{clearTimeout(timer);resolve();});});
}
(async()=>{
 try{
  await exported.startEngine();assert.equal(statuses.at(-1).state,'ready');assert.equal(children.length,1);
  const unauthenticated=await fetch(`http://127.0.0.1:${exported.getEnginePort()}/health`);assert.equal(unauthenticated.status,401);
  const workspace=path.join(directory,'workspace'),docs=path.join(directory,'original-docs');fs.mkdirSync(docs);
  const needle='Zulu retention finding is recorded at the document tail.';
  fs.writeFileSync(path.join(docs,'strategy.md'),'Original source.\n'+('Fictional context. '.repeat(5000))+'\n'+needle);
  await call('/init',{workspace_path:workspace,name:'Fictional packaged product'});
  const source=await call('/connect',{workspace_path:workspace,source_type:'docs',name:'Selected local docs',path:docs,new_source:true});
  let imported=await call('/imports/start',{workspace_path:workspace,source_ids:[source.source_id],request_id:'packaged-smoke-import'});
  const deadline=Date.now()+20_000;
  while(['queued','running'].includes(imported.job.state)||imported.job.draining){assert.ok(Date.now()<deadline,'Import deadline');await delay(30);imported=await call('/imports/status',{workspace_path:workspace,job_id:imported.job.id});}
  assert.equal(imported.job.state,'completed');
  const groups=await call('/tasks/sources',{workspace_path:workspace});assert.equal(groups.sources.length,1);
  const created=await call('/tasks/create',{workspace_path:workspace,question:'Which retention finding needs review?',reader:'Individual PM',completion_condition:'Choose a next investigation',source_names:[groups.sources[0].id]});
  const request={workspace_path:workspace,task_id:created.task.id};
  const passages=await call('/tasks/retrieve',{...request,query:'Zulu retention finding'});assert.ok(JSON.stringify(passages).includes(needle),'Tail evidence is available through SQLite without vector models');
  const evidence=await call('/tasks/evidence',request);assert.ok(evidence.items[0].content.endsWith(needle));
  const backup=path.join(directory,'workspace.compass-backup.json');await call('/workspace/backup',{workspace_path:workspace,backup_path:backup});
  const parent=path.join(directory,'restored');fs.mkdirSync(parent);
  const restored=await call('/workspace/restore',{backup_path:backup,parent_path:parent});
  assert.equal((await call('/tasks/list',{workspace_path:restored.workspace_path})).tasks.length,1);
  const info=await call('/workspace/info',{workspace_path:workspace}),stat=fs.statSync(workspace);
  await exported.purgeWorkspaceData({workspace_path:workspace,device:stat.dev,inode:stat.ino,config:{name:info.name,description:info.description,model:info.model,sources:[]},protected_paths:[docs]},()=>true);
  assert.equal(children.length,3,'Server, isolated stdlib worker, restarted server');
  assert.deepEqual((await call('/tasks/list',{workspace_path:workspace})).tasks,[]);
  assert.ok(fs.existsSync(backup));assert.ok(fs.existsSync(path.join(docs,'strategy.md')));assert.equal((await call('/tasks/list',{workspace_path:restored.workspace_path})).tasks.length,1);
  exported.stopEngine();await Promise.all(children.map(stopped));
  console.log(JSON.stringify({result:'passed',system_python:false,first_launch_install:false,authenticated_http:true,full_tail_import_and_fts:true,task_and_backup_restore:true,isolated_deletion_and_restart:true,provider_calls:0,launches:children.length}));
 }finally{
  exported.stopEngine();for(const child of children)if(child.exitCode===null&&!child.signalCode)child.kill('SIGKILL');
  fs.rmSync(directory,{recursive:true,force:true});
 }
})().catch(error=>{console.error(error);process.exitCode=1;});
