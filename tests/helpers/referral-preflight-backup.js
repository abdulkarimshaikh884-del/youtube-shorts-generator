"use strict";
// Explicit read-only live snapshot of ONLY the two existing tables modified by
// referral DDL. This is not a full Postgres disaster-recovery backup.
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),crypto=require("node:crypto"),{Pool}=require("pg");
assert(process.argv.includes("--live-read-only"),"Explicit live read-only invocation required");
require("./isolated-postgres").assertIsolatedPostgres();
const env=require("dotenv").parse(fs.readFileSync(path.resolve(__dirname,"../../.env")));
const target=new URL(env.DATABASE_URL);
assert(decodeURIComponent(target.username).endsWith(".mqsimdmogbycrbizrrsm"),"Inspected ShortsCraft project required");
const live=new Pool({connectionString:env.DATABASE_URL,ssl:{rejectUnauthorized:false},connectionTimeoutMillis:10000,max:1});
const local=new Pool({connectionString:"postgresql://postgres:local-qa-only-not-production@127.0.0.1:55437/shortscraft_qa",ssl:false,max:1});
const quote=value=>{assert(/^[a-z_][a-z0-9_]*$/.test(value));return '"'+value+'"';};
const stable=value=>JSON.stringify(value,(_,v)=>v&&typeof v==="object"&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v);
const digest=value=>crypto.createHash("sha256").update(stable(value)).digest("hex");
const normalizeRow=row=>Object.fromEntries(Object.entries(row).map(([key,value])=>[key,Buffer.isBuffer(value)?"\\x"+value.toString("hex"):value]));
(async()=>{
  const client=await live.connect(),snapshot={project:"mqsimdmogbycrbizrrsm",capturedAt:new Date().toISOString(),tables:[]};
  try{
    await client.query("begin isolation level repeatable read read only");
    await client.query("set local statement_timeout='30s'");
    for(const name of ["users","credits"]){
      const definition=(await client.query("select a.attname as name,format_type(a.atttypid,a.atttypmod) as type from pg_attribute a where a.attrelid=$1::regclass and a.attnum>0 and not a.attisdropped order by a.attnum",["public."+name])).rows;
      const columns=definition.map(r=>r.name);
      const count=Number((await client.query('select count(*) as total from public.'+quote(name))).rows[0].total);assert(count<=10000,"Snapshot limit exceeded");
      const rows=(await client.query('select '+columns.map(quote).join(',')+' from public.'+quote(name)+' order by '+quote(name==="users"?"id":"key"))).rows.map(normalizeRow);
      const primary=name==="users"?"id":"key";rows.sort((a,b)=>String(a[primary])<String(b[primary])?-1:String(a[primary])>String(b[primary])?1:0);
      snapshot.tables.push({name,columns,definition,rows,digest:digest(rows)});
    }
    await client.query("commit");
  }catch(error){await client.query("rollback");throw error;}finally{client.release();}
  const directory=fs.mkdtempSync(path.join(require("node:os").tmpdir(),"shortscraft-referral-readonly-backup-"));
  const key=crypto.randomBytes(32),iv=crypto.randomBytes(12),cipher=crypto.createCipheriv("aes-256-gcm",key,iv);
  const encrypted=Buffer.concat([iv,cipher.update(JSON.stringify(snapshot)),cipher.final(),cipher.getAuthTag()]);
  const file=path.join(directory,"users-credits.aes-gcm"),keyFile=path.join(directory,"restore.key");
  fs.writeFileSync(file,encrypted,{flag:"wx"});fs.writeFileSync(keyFile,key,{flag:"wx",mode:0o600});
  // Restore from the actual saved encrypted archive, into a new private LOCAL
  // schema; never merge a live user's credentials into the interactive QA app.
  const archive=fs.readFileSync(file),decipher=crypto.createDecipheriv("aes-256-gcm",fs.readFileSync(keyFile),archive.subarray(0,12));
  decipher.setAuthTag(archive.subarray(-16));const restored=JSON.parse(Buffer.concat([decipher.update(archive.subarray(12,-16)),decipher.final()]).toString());
  const schema="referral_restore_"+crypto.randomBytes(6).toString("hex");
  await local.query("begin");
  try{
    await local.query("create schema "+quote(schema));
    for(const table of restored.tables){
      const relation=quote(schema)+'.'+quote(table.name),columns=table.columns.map(quote).join(',');
      const fields=table.definition.map(field=>{assert(/^[a-z0-9_\s\[\](),]+$/.test(field.type),"Supported native column type required");return quote(field.name)+" "+field.type;}).join(',');
      await local.query("create table "+relation+" ("+fields+")");
      await local.query("insert into "+relation+" ("+columns+") select "+columns+" from jsonb_populate_recordset(null::"+relation+",$1::jsonb)",[JSON.stringify(table.rows)]);
      const rows=(await local.query("select "+columns+" from "+relation+" order by "+quote(table.name==="users"?"id":"key"))).rows.map(normalizeRow);
      const primary=table.name==="users"?"id":"key";rows.sort((a,b)=>String(a[primary])<String(b[primary])?-1:String(a[primary])>String(b[primary])?1:0);
      if (digest(rows)!==table.digest) {
        const differences=new Set();
        rows.forEach((row,index)=>Object.keys(row).forEach(column=>{if(stable(row[column])!==stable(table.rows[index]?.[column]))differences.add(column+":"+typeof table.rows[index]?.[column]+"->"+typeof row[column]);}));
        console.error("Restore field/type differences (no data values):",table.name,[...differences].join(","));
      }
      assert.equal(digest(rows),table.digest,"Restored row contents must exactly match snapshot");
    }
    await local.query("commit");
  }catch(error){await local.query("rollback");throw error;}
  console.log(JSON.stringify({archive:file,localRestoreSchema:schema,tables:restored.tables.map(t=>({name:t.name,rows:t.rows.length,contentMatches:true})),boundary:"Read-only encrypted users+credits pre-DDL snapshot with local restore proof. Not a full production backup or production restore test."}));
})().catch(error=>{console.error("Referral snapshot failed:",error.code||error.name, error.code === "ERR_ASSERTION" ? error.message.split("\n")[0] : "Database/backup step unavailable");process.exitCode=1;}).finally(async()=>{await live.end();await local.end();});
