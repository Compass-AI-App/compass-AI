/** Build guard: never publish an installer with a missing or stale engine runtime. */
const fs=require('node:fs');
const path=require('node:path');
const {createHash}=require('node:crypto');
const {Arch}=require('builder-util');
const root=path.resolve(__dirname,'../..');
function pythonFiles(directory){
 const files=[];
 function visit(folder){for(const entry of fs.readdirSync(folder,{withFileTypes:true})){
  const file=path.join(folder,entry.name);
  if(entry.isSymbolicLink())throw Error('Engine source symlinks are not supported.');
  if(entry.isDirectory())visit(file);else if(entry.isFile()&&file.endsWith('.py'))files.push(file);
 }}
 visit(directory);return files.sort();
}
const hash=value=>createHash('sha256').update(value).digest('hex');
function packageHash(directory){const digest=createHash('sha256');for(const file of pythonFiles(directory)){digest.update(path.relative(directory,file));digest.update('\0');digest.update(fs.readFileSync(file));}return digest.digest('hex');}
module.exports=async context=>{
 const arch=Arch[context.arch],platform=context.electronPlatformName;
 if(platform!=='darwin'||!['arm64','x64'].includes(arch))throw Error('Offline engine packaging is currently supported only for macOS ARM64 and x64, built separately.');
 const runtime=path.join(root,'.runtime',`mac-${arch}`);
 try{
  const contract=require('../electron/engine-runtime.json');
  if(fs.lstatSync(runtime).isSymbolicLink())throw Error();
  const receipt=JSON.parse(fs.readFileSync(path.join(runtime,'compass-runtime.json'),'utf8'));
  const valid=[
   receipt.format==='compass-desktop-runtime-v1',receipt.target===`mac-${arch}`,receipt.python===contract.python,
   receipt.distribution_sha256===contract.targets[`mac-${arch}`].sha256,
   receipt.requirements_sha256===hash(fs.readFileSync(path.join(root,'engine/requirements-desktop.lock'))),
   receipt.engine_sha256===packageHash(path.join(root,'engine/compass')),
   receipt.engine_sha256===packageHash(path.join(runtime,'lib/python3.11/site-packages/compass')),
  ];
  if(valid.some(value=>!value))throw Error();
  const python=fs.realpathSync(path.join(runtime,'bin/python3'));
  const relative=path.relative(fs.realpathSync(runtime),python);
  if(relative.startsWith('..')||path.isAbsolute(relative))throw Error();
  fs.accessSync(python,fs.constants.X_OK);
 }catch{throw Error(`Build the matching offline engine before packaging: python3 ../engine/build_desktop_runtime.py --target mac-${arch}. Missing, incompatible or stale runtimes are never bootstrapped on users' machines.`);}
};
