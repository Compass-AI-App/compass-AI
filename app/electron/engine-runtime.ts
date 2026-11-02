/** Resolve the signed app's preassembled runtime; packaged startup never installs software. */
import fs from "fs";
import path from "path";
import contract from "./engine-runtime.json";

export function packagedEngine(resources:string,platform:string,arch:string){
 if(platform!=="darwin"||!["arm64","x64"].includes(arch))throw new Error("This Compass release requires a supported macOS engine build.");
 const root=path.join(resources,"engine-runtime"),file=path.join(root,"compass-runtime.json");
 try{
  if(!fs.lstatSync(root).isDirectory()||fs.lstatSync(root).isSymbolicLink()||!fs.lstatSync(file).isFile()||fs.lstatSync(file).isSymbolicLink()||fs.statSync(file).size>16_000)throw Error();
  const receipt=JSON.parse(fs.readFileSync(file,"utf8"));
  if(receipt.format!=="compass-desktop-runtime-v1"||receipt.target!==`mac-${arch}`||receipt.python!==contract.python||receipt.distribution_sha256!==contract.targets[`mac-${arch}` as keyof typeof contract.targets].sha256||!/^[a-f0-9]{64}$/.test(receipt.requirements_sha256)||!/^[a-f0-9]{64}$/.test(receipt.engine_sha256))throw Error();
  const python=path.join(root,"bin","python3"),resolved=fs.realpathSync(python),canonical=fs.realpathSync(root),relative=path.relative(canonical,resolved);
  if(!relative||relative.startsWith(`..${path.sep}`)||relative===".."||path.isAbsolute(relative)||!fs.statSync(resolved).isFile())throw Error();
  fs.accessSync(python,fs.constants.X_OK);
  return {python,directory:root,flags:["-I","-B"]};
 }catch{throw new Error("The bundled Compass engine is missing, incompatible or incomplete. Reinstall this app build; no system Python or network installation was used.");}
}
