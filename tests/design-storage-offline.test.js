const assert=require('node:assert/strict');
const fs=require('fs');
const vm=require('vm');
function load(env,query){
 const module={exports:{}};
 vm.runInNewContext(fs.readFileSync(require.resolve('../designs'),'utf8'),{module,console,Buffer,process:{env},require(n){if(n==='./db')return {query};if(n==='./design-assets')return {makePublic:async()=>{}};return require(n);}});
 return module.exports;
}
(async()=>{
 const body={title:'Test',canvas:{width:600,height:400},elements:[{id:'one',type:'text',text:'Editable'}]};
 const local=load({},()=>{throw Error('No DB calls expected');});
 assert.equal((await local.saveProject(null,'new',body)).status,401);
 const a=await local.saveProject('alice','new',body),b=await local.saveProject('alice','new',body);
 assert(a.success&&b.success);assert.notEqual(a.project.id,b.project.id);
 assert.equal((await local.saveProject('bob',a.project.id,body)).status,403);
 assert.equal((await local.getProject('bob',a.project.id)).status,404);
 assert.equal((await local.getProject('alice',a.project.id)).project.elements[0].text,'Editable');
 const down=load({DATABASE_URL:'offline-placeholder',NODE_ENV:'production'},async()=>{throw Error('simulated outage');});
 assert.equal((await down.saveProject('alice','new',body)).status,503);
 assert.equal((await down.listProjects('alice')).status,503);
 assert.equal((await down.publishTemplate({id:'alice'},body)).status,503);
 const missing=load({NODE_ENV:'production'},()=>{});
 assert.equal((await missing.saveProject('alice','new',body)).status,503);
 console.log('PASS unique new IDs, save/reopen, owner isolation, outage reporting and no production memory-only success.');
})().catch(e=>{console.error(e);process.exitCode=1;});
