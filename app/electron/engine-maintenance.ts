/** Fence new engine calls, drain accepted requests, then stop before data removal. */
export class EngineMaintenance {
 private active=false;
 private requests=0;
 assertAvailable(){if(this.active)throw new Error("Compass is performing workspace data maintenance. Wait for it to finish.");}
 async request<T>(operation:()=>Promise<T>):Promise<T>{this.assertAvailable();this.requests++;try{return await operation();}finally{this.requests--;}}
 async run<T>(idle:()=>Promise<boolean>,stop:()=>Promise<void>,operation:()=>Promise<T>,restart:()=>Promise<void>):Promise<T>{
  this.assertAvailable();this.active=true;let stopped=false;
  try{
   const deadline=Date.now()+10_000;
   while(this.requests){if(Date.now()>deadline)throw new Error("An engine request is still running. Wait before deleting Compass data.");await new Promise(resolve=>setTimeout(resolve,20));}
   if(!await idle())throw new Error("Finish or cancel active workspace operations before deleting Compass data.");
   await stop();stopped=true;
   return await operation();
  }finally{
   try{if(stopped)await restart();}finally{this.active=false;}
  }
 }
}
