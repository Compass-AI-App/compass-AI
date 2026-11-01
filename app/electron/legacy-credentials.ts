/** Native-only migration of retired credential stores. Never return credential values over IPC. */
import fs from "fs";
import path from "path";
import {randomUUID} from "crypto";
import {AIConnection} from "./ai-vault";
import type {AIConnections} from "./ai-connections";
const browserKeys=["compass-api-key","compass-cloud-token"] as const;
type BrowserRecords=Partial<Record<typeof browserKeys[number],string>>;
export const captureCredentialScript=`(()=>{const result={};for(const key of ${JSON.stringify(browserKeys)}){const value=localStorage.getItem(key);if(value!==null)result[key]=value;}return result;})()`;
export function removeCredentialScript(records:BrowserRecords){
 return `(()=>{const expected=JSON.parse(${JSON.stringify(JSON.stringify(records))});for(const [key,value] of Object.entries(expected))if(localStorage.getItem(key)!==value)return false;try{for(const key of Object.keys(expected))localStorage.removeItem(key);return Object.keys(expected).every(key=>localStorage.getItem(key)===null);}catch{return false;}})()`;
}
export class LegacyCredentials {
 private tail:Promise<unknown>=Promise.resolve();
 constructor(private file:string,private capture:()=>Promise<unknown>,private remove:(records:BrowserRecords)=>Promise<boolean>,private decrypt:(value:Buffer)=>string){ }
 private serial<T>(operation:()=>Promise<T>):Promise<T>{const next=this.tail.then(operation,operation);this.tail=next.catch(()=>{});return next;}
 private async browser():Promise<BrowserRecords>{
  const value=await this.capture();
  if(!value||typeof value!=="object"||Array.isArray(value)||Object.entries(value).some(([key,value])=>!browserKeys.includes(key as any)||typeof value!=="string"||value.length>100_000))throw new Error("Older browser credentials could not be read. They were kept.");
  return value;
 }
 private read():Buffer|null{
  let fd:number|undefined;
  try{
   const before=fs.lstatSync(this.file);if(!before.isFile()||before.isSymbolicLink()||before.size>1_000_000)throw Error();
   fd=fs.openSync(this.file,fs.constants.O_RDONLY|(fs.constants.O_NOFOLLOW||0)|(fs.constants.O_NONBLOCK||0));
   const stat=fs.fstatSync(fd);if(!stat.isFile()||stat.dev!==before.dev||stat.ino!==before.ino||stat.size>1_000_000)throw Error();
   const raw=fs.readFileSync(fd);if(raw.length>1_000_000)throw Error();return raw;
  }
  catch(cause){if((cause as NodeJS.ErrnoException).code==="ENOENT")return null;throw new Error("Older credential file could not be safely read. It was kept.");}
  finally{if(fd!==undefined)fs.closeSync(fd);}
 }
 private parse(raw:Buffer|null):Record<string,string>{
  if(!raw)return {};
  try{const value=JSON.parse(raw.toString());if(!value||typeof value!=="object"||Array.isArray(value)||Object.values(value).some(item=>typeof item!=="string"))throw Error();return value;}
  catch{throw new Error("Older credential file is unreadable. Remove older credential records explicitly before signing out or reconnecting.");}
 }
 private same(raw:Buffer|null){const current=this.read();return raw===null?current===null:current!==null&&raw.equals(current);}
 private replace(raw:Buffer|null,records:Record<string,string>){
  if(!this.same(raw))throw new Error("Older credentials changed. Retry; newer records were kept.");
  const temporary=path.join(path.dirname(this.file),`.legacy-credentials-${randomUUID()}.tmp`);let fd:number|undefined;
  try{fd=fs.openSync(temporary,"wx",0o600);fs.writeFileSync(fd,JSON.stringify(records));fs.fsyncSync(fd);fs.closeSync(fd);fd=undefined;if(!this.same(raw))throw new Error("Older credentials changed. Retry.");fs.renameSync(temporary,this.file);}
  finally{if(fd!==undefined)fs.closeSync(fd);if(fs.existsSync(temporary))fs.unlinkSync(temporary);}
 }
 async status(){
  const browser=await this.browser(),raw=this.read();let nativeRecords:number|null=0,savedClaude=false;
  try{const data=this.parse(raw);nativeRecords=Object.keys(data).length;savedClaude=Object.prototype.hasOwnProperty.call(data,"anthropic-api-key");}catch{nativeRecords=null;}
  return {browserKey:Object.prototype.hasOwnProperty.call(browser,"compass-api-key"),cloudToken:Object.prototype.hasOwnProperty.call(browser,"compass-cloud-token"),nativeRecords,savedClaude,nativeFile:raw!==null};
 }
 migrateBrowser(ai:AIConnections,provider:unknown){
  return this.migrate(ai,provider,"browser");
 }
 importClaude(ai:AIConnections){return this.migrate(ai,"anthropic","native");}
 private async migrate(ai:AIConnections,provider:unknown,source:"browser"|"native"){
  const browser=source==="browser"?await this.browser():{},raw=source==="native"?this.read():null;
  const encrypted=source==="native"?this.parse(raw)["anthropic-api-key"]:undefined;
  let key=browser["compass-api-key"];
  if(source==="native"){
   try{if(!encrypted)throw Error();key=this.decrypt(Buffer.from(encrypted,"base64"));}catch{throw new Error("The older Claude key could not be decrypted. Unlock its original OS keychain or remove older credentials and reconnect.");}
  }
  if(!key)throw new Error("No older API key is available. Connect with your current provider credentials.");
  const verify=async()=>{if(source==="native"?!this.same(raw):(await this.browser())["compass-api-key"]!==key)throw new Error("The older key changed during validation. Retry; no new connection was saved.");};
  return ai.migrateKey(provider,key,verify,()=>this.serial(async()=>{
   await verify();
   if(source==="native"){const records=this.parse(raw);delete records["anthropic-api-key"];this.replace(raw,records);}
   else if(!await this.remove({"compass-api-key":key}))throw new Error("The older browser key could not be removed.");
  }));
 }
 clear(confirm:(summary:Awaited<ReturnType<LegacyCredentials["status"]>>)=>Promise<boolean>){return this.serial(async()=>{
  const browser=await this.browser(),raw=this.read(),summary=await this.status();
  if(!await confirm(summary))return {status:"cancelled" as const};
  if(!this.same(raw))throw new Error("Older native credentials changed. Retry; no records were removed.");
  if(raw!==null)fs.unlinkSync(this.file);
  if(!await this.remove(browser))throw new Error("Older browser credentials changed or could not be removed. Native cleanup may have completed; refresh and retry.");
  const remaining=await this.status();if(remaining.browserKey||remaining.cloudToken||remaining.nativeFile)throw new Error("Older credentials appeared during cleanup. Refresh and review them before retrying.");
  return {status:"cleared" as const};
 });}
 removeMatching(record:AIConnection){return this.serial(async()=>{
  if(!record.accessToken)return;
  const browser=await this.browser(),matches:BrowserRecords={};
  for(const key of browserKeys)if(browser[key]?.trim()===record.accessToken)matches[key]=browser[key];
  const raw=this.read(),data=this.parse(raw);let changed=false;
  const keys=record.provider==="anthropic"?["anthropic-api-key","credential:anthropic","credential:claude"]:[`credential:${record.provider}`];
  for(const key of keys){
   if(!Object.prototype.hasOwnProperty.call(data,key))continue;
   let decoded:string;
   try{decoded=this.decrypt(Buffer.from(data[key],"base64"));}catch{throw new Error("An older credential copy could not be checked. Unlock its OS keychain or remove older credential records before signing out.");}
   let tokens:unknown[]=[decoded];
   if(key.startsWith("credential:")){try{const item=JSON.parse(decoded);tokens=[item.api_key,item.access_token,item.refresh_token];}catch{throw new Error("An older credential record is unreadable. Remove older credential records before signing out.");}}
   if(tokens.some(token=>typeof token==="string"&&[record.accessToken,record.refreshToken].filter(Boolean).includes(token.trim()))){delete data[key];changed=true;}
  }
  if(changed)this.replace(raw,data);
  if(Object.keys(matches).length&&!await this.remove(matches))throw new Error("A matching older browser credential could not be removed. The current connection was kept; retry signing out.");
 });}
}
