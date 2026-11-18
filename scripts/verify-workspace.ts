import { execFileSync, spawn } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import { createServer } from 'node:net';
import { fileURLToPath } from 'node:url';
import { Pool } from 'pg';
import { migrate } from '../src/server/migrations.js';
import { provisionUser } from '../src/server/store.js';
const name='mochex-terminal-m1-'+randomBytes(6).toString('hex');
const password=randomBytes(24).toString('base64url');
const runtimePassword=randomBytes(24).toString('base64url');
const image='postgres:17.12-alpine@sha256:a77aa70e641402a21411b92b721c58d10f23b50ae5fdd2333efd22d166e1e5f7';
const docker=(args:string[])=>execFileSync('docker',args,{encoding:'utf8',windowsHide:true,stdio:['ignore','pipe','pipe']}).trim();
let admin:Pool|undefined,web:ReturnType<typeof spawn>|undefined,fixture:ReturnType<typeof spawn>|undefined,started=false;
const pause=(ms:number)=>new Promise(r=>setTimeout(r,ms));
try{
 docker(['run','--detach','--name',name,'--label','mochex-terminal.test=m1','--env','POSTGRES_PASSWORD='+password,'--env','POSTGRES_DB=terminal','--publish','127.0.0.1::5432',image]);started=true;
 const port=docker(['port',name,'5432/tcp']).split(':').at(-1)!;
 const adminUrl='postgresql://postgres:'+password+'@127.0.0.1:'+port+'/terminal';
 admin=new Pool({connectionString:adminUrl,connectionTimeoutMillis:1000});
 let ready=false;
 for(let i=0;i<40;i++){try{await admin.query('SELECT 1');ready=true;break;}catch{await pause(250);}}
 if(!ready)throw new Error('Isolated PostgreSQL did not become ready');
 await migrate(admin,1);
 await admin.query("CREATE ROLE terminal_login LOGIN PASSWORD '"+runtimePassword+"' IN ROLE terminal_runtime");
 const aPassword=randomBytes(24).toString('base64url'),bPassword=randomBytes(24).toString('base64url');
 const a=await provisionUser(admin,'alice@example.test',aPassword),b=await provisionUser(admin,'bob@example.test',bPassword);
 await provisionUser(admin,'limited@example.test',aPassword);
 const aItem=randomUUID(),bItem=randomUUID();
 await admin.query('INSERT INTO workspace_items(id,owner_id,title) VALUES($1,$2,$3),($4,$5,$6)',[aItem,a.id,'Alice private workspace',bItem,b.id,'Bob private workspace']);
 await migrate(admin);await migrate(admin);
 const dbUrl='postgresql://terminal_login:'+runtimePassword+'@127.0.0.1:'+port+'/terminal';
 const env={...process.env,DATABASE_URL:dbUrl,TEST_ADMIN_DATABASE_URL:adminUrl,FIXTURE_A_ID:a.id,FIXTURE_B_ID:b.id,FIXTURE_A_ITEM:aItem,FIXTURE_B_ITEM:bItem,FIXTURE_A_PASSWORD:aPassword,FIXTURE_B_PASSWORD:bPassword,NEXT_TELEMETRY_DISABLED:'1'};
 execFileSync(process.execPath,['--import','tsx','--test','integration/workspace.test.ts','integration/signals.test.ts','integration/observations.test.ts','integration/core.test.ts','integration/monitor.test.ts','integration/chart.test.ts'],{env,stdio:'inherit',windowsHide:true});
 const portFinder=createServer();
 const webPort=await new Promise<number>((resolve,reject)=>{portFinder.once('error',reject);portFinder.listen(0,'127.0.0.1',()=>{const address=portFinder.address();if(!address||typeof address==='string')return reject(Error('No local port'));portFinder.close(()=>resolve(address.port));});});
 const origin='http://127.0.0.1:'+webPort;
 fixture=spawn(process.execPath,['fixtures/market-server.cjs'],{windowsHide:true,stdio:['ignore','pipe','pipe']});
 const fixtureOrigin=await new Promise<string>((resolve,reject)=>{
  const timeout=setTimeout(()=>reject(Error('Market fixture did not start')),5000);
  fixture!.once('exit',()=>{clearTimeout(timeout);reject(Error('Market fixture exited early'));});
  fixture!.stdout!.once('data',chunk=>{clearTimeout(timeout);resolve(String(chunk).trim());});
 });
 const webEnv={...env,APP_ORIGIN:origin,TERMINAL_TEST_MARKET_ORIGIN:fixtureOrigin};
 let output='';
 web=spawn(process.execPath,['--require',fileURLToPath(new URL('../fixtures/market-fetch.cjs',import.meta.url)),'node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port',String(webPort)],{env:webEnv,windowsHide:true,stdio:['ignore','pipe','pipe']});
 web.stdout?.on('data',chunk=>{output+=chunk;});web.stderr?.on('data',chunk=>{output+=chunk;});
 let online=false;
 for(let i=0;i<80;i++){
  if(web.exitCode!==null)throw Error('Web process exited: '+output.slice(-2000));
  try{const r=await fetch(origin+'/login');if(r.status===200){online=true;break;}}catch{}
  await pause(250);
 }
 if(!online)throw Error('Local web startup failed: '+output.slice(-2000));
 execFileSync(process.execPath,['node_modules/@playwright/test/cli.js','test'],{env:webEnv,stdio:'inherit',windowsHide:true});
 execFileSync(process.execPath,['--require',fileURLToPath(new URL('../fixtures/market-fetch.cjs',import.meta.url)),'--import','tsx','scripts/monitor-core.ts','--once'],{env:{...webEnv,TERMINAL_MONITOR_OWNER_ID:a.id},stdio:'inherit',windowsHide:true});
 console.log('M1 local verification passed: PostgreSQL integration + browser/API workflows; test resources will be removed.');
}finally{
 if(web&&web.exitCode===null){const stopped=new Promise<void>(r=>web!.once('exit',()=>r()));web.kill();await Promise.race([stopped,pause(3000)]);}
 if(fixture&&fixture.exitCode===null){const stopped=new Promise<void>(r=>fixture!.once('exit',()=>r()));fixture.kill();await Promise.race([stopped,pause(3000)]);}
 if(admin)await admin.end();
 if(started){docker(['rm','--force',name]);console.log('Removed disposable M1 PostgreSQL container; no data volume was created.');}
}
