/** Preserve legacy artifacts as inert text; clearing is explicitly app-wide. */
import fs from "fs/promises";
import path from "path";
import {createHash,randomUUID} from "crypto";
export const legacyKey=(key:string)=>["compass-presentations","compass-prototypes","compass-pinned-charts","compass-feedback"].includes(key)||/^compass-chat-[A-Za-z0-9+/=]{1,32}$/.test(key);
export type LegacySnapshot=Record<string,string>;
export function validateLegacy(value:unknown):LegacySnapshot{
 if(!value||typeof value!=="object"||Array.isArray(value))throw new Error("Legacy data could not be read. Existing records were kept.");
 const entries=Object.entries(value);if(entries.length>2048||entries.some(([key,raw])=>!legacyKey(key)||typeof raw!=="string")||Buffer.byteLength(JSON.stringify(value))>20_000_000)throw new Error("Legacy data exceeds its supported scope or size. Existing records were kept.");
 return Object.fromEntries(entries.sort(([a],[b])=>a.localeCompare(b)));
}
export function legacySummary(snapshot:LegacySnapshot){
 const groups={presentations:0,prototypes:0,charts:0,conversations:0,feedback:0};let malformed=0;
 for(const [key,raw] of Object.entries(snapshot)){
  const group=key==="compass-presentations"?"presentations":key==="compass-prototypes"?"prototypes":key==="compass-pinned-charts"?"charts":key==="compass-feedback"?"feedback":"conversations";
  try{const data=JSON.parse(raw);if(!Array.isArray(data))throw Error();groups[group]+=data.length;}catch{malformed++;}
 }
 return {records:Object.keys(snapshot).length,bytes:Buffer.byteLength(JSON.stringify(snapshot)),groups,malformed};
}
export const captureLegacyScript=`(()=>{const data={};for(let index=0;index<localStorage.length;index++){const key=localStorage.key(index);if(key&&(${legacyKey.toString()})(key))data[key]=localStorage.getItem(key);}return data;})()`;
export function removeLegacyScript(snapshot:LegacySnapshot){
 return `(()=>{const expected=JSON.parse(${JSON.stringify(JSON.stringify(snapshot))});const read=()=>${captureLegacyScript};const same=(a,b)=>{const keys=Object.keys(a).sort();return JSON.stringify(keys)===JSON.stringify(Object.keys(b).sort())&&keys.every(key=>a[key]===b[key]);};if(!same(read(),expected))return {ok:false};try{for(const key of Object.keys(expected))localStorage.removeItem(key);return {ok:Object.keys(read()).length===0};}catch{for(const [key,value] of Object.entries(expected)){try{localStorage.setItem(key,value);}catch{}}return {ok:false,partial:!same(read(),expected)};}})()`;
}
export class LegacyData {
 private tail:Promise<unknown>=Promise.resolve();
 private serial<T>(operation:()=>Promise<T>):Promise<T>{const next=this.tail.then(operation,operation);this.tail=next.catch(()=>{});return next;}
 constructor(private capture:()=>Promise<unknown>,private remove:(snapshot:LegacySnapshot)=>Promise<{ok:boolean;partial?:boolean}>){ }
 private async read(){return validateLegacy(await this.capture());}
 async status(){return legacySummary(await this.read());}
 export(choose:()=>Promise<string|null>){return this.serial(()=>this.saveExport(choose));}
 private async saveExport(choose:()=>Promise<string|null>){
  const snapshot=await this.read();if(!Object.keys(snapshot).length)throw new Error("No older app artifacts are stored.");
  const destination=await choose();if(!destination)return {status:"cancelled" as const};
  if(!path.isAbsolute(destination)||!destination.endsWith(".compass-legacy.json"))throw new Error("Choose a .compass-legacy.json destination.");
  const current=await this.read();if(JSON.stringify(snapshot)!==JSON.stringify(current))throw new Error("Older app data changed while the dialog was open. Export again; nothing was cleared.");
  const content=JSON.stringify({format:"compass-legacy-app-data-v1",exported_at:new Date().toISOString(),scope:"All legacy records in this app profile; workspace association is unknown.",sha256:createHash("sha256").update(JSON.stringify(snapshot)).digest("hex"),records:snapshot},null,2);
  const temporary=path.join(path.dirname(destination),`.compass-legacy-${randomUUID()}.tmp`);let file:fs.FileHandle|undefined;
  try{file=await fs.open(temporary,"wx",0o600);await file.writeFile(content,"utf8");await file.sync();await file.close();file=undefined;await fs.rename(temporary,destination);}
  finally{await file?.close();await fs.rm(temporary,{force:true});}
  return {status:"saved" as const,...legacySummary(snapshot)};
 }
 clear(confirm:(summary:ReturnType<typeof legacySummary>)=>Promise<boolean>){return this.serial(()=>this.clearRecords(confirm));}
 private async clearRecords(confirm:(summary:ReturnType<typeof legacySummary>)=>Promise<boolean>){
  const snapshot=await this.read();if(!Object.keys(snapshot).length)return {status:"cleared" as const};
  if(!await confirm(legacySummary(snapshot)))return {status:"cancelled" as const};
  const result=await this.remove(snapshot);
  if(!result.ok)throw new Error(result.partial?"Clearing was interrupted. Some older records may remain; refresh the counts and retry. Other app settings were kept.":"Older records changed or could not be cleared. Refresh the counts and retry; other app settings were kept.");
  if(Object.keys(await this.read()).length)throw new Error("New older records appeared during clearing. Refresh and review them before retrying.");
  return {status:"cleared" as const};
 }
}
