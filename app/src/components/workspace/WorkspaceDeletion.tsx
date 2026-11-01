import {useState} from "react";
import {useWorkspaceManager} from "../../stores/workspaceManager";

export default function WorkspaceDeletion({workspace,pending=false}:{workspace:string;pending?:boolean}){
 const [busy,setBusy]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState("");
 async function remove(){
  setBusy(true);setError("");setNotice("");
  try{
   const result=await window.compass.workspaces.purge(workspace);
   if(result.status==="cancelled"){setNotice("Deletion cancelled. Saved work was kept.");return;}
   sessionStorage.setItem("compass-workspace-deleted",workspace);location.hash="/workspace";location.reload();
  }catch(cause){
   await useWorkspaceManager.getState().loadWorkspaces();
   if(useWorkspaceManager.getState().workspaces.find(item=>item.id===workspace)?.deletion_pending){location.hash="/workspace";location.reload();return;}
   setError(cause instanceof Error?cause.message:"Deletion did not finish. Check the workspace and try again.");
  }finally{setBusy(false);}
 }
 return <section aria-label="Delete managed workspace data" className="border-t border-compass-border pt-6 mt-8 text-sm space-y-3">
  <h2 className="text-lg font-medium">{pending?"Resume interrupted deletion":"Delete Compass data"}</h2>
  {pending&&<p role="alert">Deletion is incomplete. Saved data stays blocked until deletion is resumed.</p>}
  <p className="text-compass-muted">Removes imported evidence and all versions, saved tasks and reviews, job history, migration backups, cached indexes, older saved documents, conversations and feedback. Source connections and approvals are cleared.</p>
  <p className="text-compass-muted">Product details, original sources, separate exports/backups, older browser copies, .compass/output and other workspace files remain. Provider accounts stay connected. This removes managed files; it is not secure disk erasure. Back up or export work you want to keep first.</p>
  <button disabled={busy} className="border border-red-400/60 text-red-300 rounded px-3 py-2 disabled:opacity-50" onClick={()=>void remove()}>{busy?"Deleting Compass data…":pending?"Resume deletion":"Delete Compass data from this workspace"}</button>
  {notice&&<p role="status">{notice}</p>}{busy&&<p role="status">Stopping the engine and removing managed files…</p>}{error&&<p role="alert" className="text-red-400">{error}</p>}
 </section>;
}
