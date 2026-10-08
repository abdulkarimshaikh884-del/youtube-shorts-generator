"use strict";
// Real credits module + transactional memory storage. No configured DB/provider.
const fs=require("node:fs"),vm=require("node:vm"),path=require("node:path"),assert=require("node:assert/strict");
const day=new Date().toISOString().slice(0,10);
let state={balance:{key:"u:qa",day,plan:"free",left_credits:5,spent:0,since:day},ledger:[]};
let queue=Promise.resolve(); const queries=[];
function client(draft) { return {async query(raw,p=[]){
 const sql=raw.replace(/\s+/g," ").trim();queries.push(sql);
 const rows=v=>({rows:v?[structuredClone(v)]:[]});
 if(sql.includes("pg_advisory_xact_lock"))return rows(null);
 if(sql.startsWith("select * from public.credits"))return rows(draft.balance);
 if(sql.includes("from public.credit_transactions where idempotency_key"))return rows(draft.ledger.find(l=>l.idempotency_key===p[0]));
 if(sql.startsWith("select metadata from public.credit_transactions"))return rows(draft.ledger.find(l=>l.id===p[0]));
 if(sql.startsWith("update public.credits")){
   if(sql.includes("spent = greatest")){draft.balance.left_credits=Math.min(p[1],draft.balance.left_credits+p[2]);draft.balance.spent=Math.max(0,draft.balance.spent-p[2]);}
   else if(sql.includes("spent = spent +")){draft.balance.left_credits-=p[1];draft.balance.spent+=p[1];}
   else draft.balance.left_credits=p[1];
   return rows(draft.balance);
 }
 if(sql.startsWith("insert into public.credit_transactions")){
   const refund=sql.includes("'refund'");
   const record={id:"tx-"+draft.ledger.length,kind:refund?"refund":p[2],amount:refund?p[2]:p[3],balance_after:refund?p[3]:p[4],idempotency_key:refund?p[4]:p[5],metadata:JSON.parse(refund?p[5]:p[6])};
   draft.ledger.push(record);return rows(record);
 }
 throw Error("Unexpected isolated query: "+sql);
}}; }
const db={query:(...args)=>client(state).query(...args),tx(fn){
 const run=queue.then(async()=>{const draft=structuredClone(state);const result=await fn(client(draft));state=draft;return result;});queue=run.catch(()=>{});return run;
}};
const target={exports:{}};
vm.runInNewContext(fs.readFileSync(path.resolve(__dirname,"../credits.js"),"utf8"),{
 module:target,exports:target.exports,console,Buffer,process:{env:{}},require:n=>n==="./db"?db:require(n)
});
const credits=target.exports;
const request=(key,body,path="/api/export")=>({user:{id:"qa",plan:"free"},credits:{key:"u:qa"},path,body,get:()=>key});
(async()=>{
 const key="same-client-key-20261007", body={tpl:"first-template",props:{b:2,a:1}},first=request(key,body);
 assert.equal((await credits.charge(first,"export")).charged,1);
 assert.match(state.ledger[0].metadata.operationFingerprint,/^[a-f0-9]{64}$/);
 assert(queries[0].includes("pg_advisory_xact_lock"),"Operation locks precede duplicate lookup");
 const duplicate=await credits.charge(request(key,{props:{a:1,b:2},tpl:"first-template",idempotencyKey:key}),"export");
 assert.equal(duplicate.ok,false);assert.equal(duplicate.status,409);assert.equal(duplicate.code,"CREDIT_OPERATION_REPLAY");
 assert.equal(duplicate.charged,0);assert.equal(state.balance.left_credits,4);
 for(let i=0;i<7;i++){
   const changed=await credits.charge(request(key,{tpl:"changed-template-"+i}),"export");
   assert.equal(changed.ok,false);assert.equal(changed.code,"CREDIT_IDEMPOTENCY_CONFLICT");
 }
 await Promise.all(Array.from({length:6},()=>credits.refund(first,"export")));
 assert.equal(state.balance.left_credits,5);assert.equal(state.ledger.filter(l=>l.kind==="refund").length,1);
 const refunded=await credits.charge(request(key,body),"export");
 assert.equal(refunded.ok,false);assert.equal(refunded.code,"CREDIT_OPERATION_REFUNDED");
 assert.equal(refunded.left,5,"Replay response reports the current post-refund balance");
 assert.equal(state.balance.left_credits,5,"Refunded replay cannot create free work");
 const newAttempt=await credits.charge(request("new-client-key-20261007",body),"export");
 assert.equal(newAttempt.ok,true);assert.equal(newAttempt.charged,1);assert.equal(state.balance.left_credits,4,"Fresh retry after refund pays once net");
 const concurrent=await Promise.all(Array.from({length:8},()=>credits.charge(request("race-client-key-20261007",body),"export")));
 assert.equal(concurrent.filter(r=>r.ok).length,1);assert.equal(concurrent.filter(r=>r.status===409&&r.charged===0).length,7);
 assert.equal(state.balance.left_credits,3,"Concurrent duplicates cannot charge or run twice");
 const oldReplay=await credits.charge(request(key,body),"export");
 assert.equal(oldReplay.left,3,"An old replay never reports a stale ledger snapshot");
 const structured=await credits.charge(request("types-client-key-20261007",{props:{x:1}}),"export");assert(structured.ok);
 const wrongType=await credits.charge(request("types-client-key-20261007",{props:[["x",1]]}),"export");
 assert.equal(wrongType.code,"CREDIT_IDEMPOTENCY_CONFLICT","Canonical object and array types stay distinct");
 const legacyKey="credit:u:qa:export:legacy-key-20261007";
 state.ledger.push({id:"legacy",idempotency_key:legacyKey,balance_after:2,metadata:{}});
 assert.equal((await credits.charge(request("legacy-key-20261007",body),"export")).code,"CREDIT_OPERATION_REPLAY","Legacy records fail closed without fingerprints");
 console.log("PASS credit replay guards: stable payload binding, changed/type conflicts, duplicate409/no double charge, concurrent single admission, refunded-key rejection, fresh retry after refund and legacy fail-closed (isolated).");
})().catch(e=>{console.error(e);process.exitCode=1;});
