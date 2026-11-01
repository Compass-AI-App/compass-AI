import {useEffect,useState} from "react";
const count=(value:number,label:string,plural=label+"s")=>`${value} ${value===1?label:plural}`;
type Summary={records:number;bytes:number;malformed:number;groups:Record<string,number>};
export default function LegacyAppData(){
 const [summary,setSummary]=useState<Summary|null>(null),[busy,setBusy]=useState(""),[notice,setNotice]=useState(""),[error,setError]=useState("");
 useEffect(()=>{let alive=true;window.compass.legacy.status().then(value=>{if(alive)setSummary(value);}).catch(()=>{if(alive)setError("Older app records could not be inspected. They were kept.");});return()=>{alive=false;};},[]);
 async function perform(kind:"export"|"clear"){
  setBusy(kind==="export"?"Exporting older records…":"Clearing older records…");setError("");setNotice("");
  try{const result=await window.compass.legacy[kind]();
   if(result.status==="cleared"){sessionStorage.setItem("compass-legacy-cleared","true");location.hash="/settings";location.reload();return;}
   setNotice(result.status==="saved"?"Older records exported. Nothing was cleared. Keep the file private.":"Cancelled. Older records were kept.");setSummary(await window.compass.legacy.status());
  }catch(cause){setError(cause instanceof Error?cause.message:"The operation did not finish. Refresh the counts and retry.");try{setSummary(await window.compass.legacy.status());}catch{}}
  finally{setBusy("");}
 }
 return <section aria-label="Older app artifacts" className="mb-8 space-y-3 text-sm">
  <h2 className="font-medium">Older app artifacts</h2>
  <p className="text-compass-muted">Older presentations, prototypes, pinned charts, conversations and feedback were stored without reliable workspace ownership. Workspace deletion leaves these copies in place.</p>
  <p className="text-compass-muted">Export preserves their exact stored text, including malformed records, in a private JSON file. It does not run prototype code. Clearing affects all of these records available in this app storage across workspaces; current workspace files, provider credentials and other settings stay intact. This clears saved records, not secure disk erasure.</p>
  {summary&&<p>{count(summary.records,"storage record")} · {summary.bytes.toLocaleString()} bytes. {count(summary.groups.presentations,"presentation")}, {count(summary.groups.prototypes,"prototype")}, {count(summary.groups.charts,"pinned chart")}, {count(summary.groups.conversations,"conversation message")}, {count(summary.groups.feedback,"feedback entry","feedback entries")}.{summary.malformed>0&&` ${count(summary.malformed,"record")} could not be parsed; export preserves the raw text.`}</p>}
  <div className="flex flex-wrap gap-3"><button disabled={!!busy||!summary?.records} className="border border-compass-border rounded px-3 py-2 disabled:opacity-50" onClick={()=>void perform("export")}>Export older app artifacts</button><button disabled={!!busy||!summary?.records} className="border border-red-400/60 text-red-300 rounded px-3 py-2 disabled:opacity-50" onClick={()=>void perform("clear")}>Clear all older app artifacts</button></div>
  {(busy||notice)&&<p role="status">{busy||notice}</p>}{sessionStorage.getItem("compass-legacy-cleared")==="true"&&summary!==null&&!summary.records&&<p role="status">Older app records were cleared. Current workspace files and provider settings remain.</p>}{error&&<p role="alert" className="text-red-400">{error}</p>}
 </section>;
}
