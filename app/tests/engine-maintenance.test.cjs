const {test}=require('node:test');
const assert=require('node:assert/strict');
const {EngineMaintenance}=require('../dist-electron/engine-maintenance.js');

test('maintenance drains accepted requests, fences new calls and stops before deleting',async()=>{
 const gate=new EngineMaintenance();let release;const running=gate.request(()=>new Promise(resolve=>release=resolve));
 const events=[];const operation=gate.run(async()=>{events.push('idle');return true;},async()=>events.push('stop'),async()=>{events.push('delete');assert.throws(()=>gate.assertAvailable(),/maintenance/);return 'deleted';},async()=>events.push('restart'));
 await assert.rejects(gate.request(async()=>{}),/maintenance/);assert.deepEqual(events,[]);
 release();await running;assert.equal(await operation,'deleted');assert.deepEqual(events,['idle','stop','delete','restart']);gate.assertAvailable();
});
test('active jobs reject deletion without stopping or restarting the engine',async()=>{
 const gate=new EngineMaintenance();let changed=false;
 await assert.rejects(gate.run(async()=>false,async()=>{changed=true;},async()=>{changed=true;},async()=>{changed=true;}),/Finish or cancel/);
 assert.equal(changed,false);gate.assertAvailable();
});
test('worker failure restarts a stopped engine before releasing the maintenance fence',async()=>{
 const gate=new EngineMaintenance();const events=[];
 await assert.rejects(gate.run(async()=>true,async()=>events.push('stop'),async()=>{throw Error('Fictional partial failure');},async()=>{assert.throws(()=>gate.assertAvailable(),/maintenance/);events.push('restart');}),/partial failure/);
 assert.deepEqual(events,['stop','restart']);gate.assertAvailable();
});
