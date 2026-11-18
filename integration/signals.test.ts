import { test,after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { withOwner } from '../src/server/store.js';
import { migrate } from '../src/server/migrations.js';
import { registerSource, listSources, setSourceEnabled, rotateCredential, revokeCredentials, ingestSignal, createPaperTrade, appendFill } from '../src/server/signals.js';
import { signal,instrument } from './signal-fixture.js';
const admin=new Pool({connectionString:process.env.TEST_ADMIN_DATABASE_URL!});
const db=new Pool({connectionString:process.env.DATABASE_URL!,max:20});
const a=process.env.FIXTURE_A_ID!,b=process.env.FIXTURE_B_ID!;
after(async()=>{await db.end();await admin.end();});
test('S2-01: ordered migrations preserve S1 rows and have stable checksums',async()=>{
 const rows=await admin.query('select version,digest from terminal_migrations order by version');
 assert.deepEqual(rows.rows.map(r=>r.version),[1,2,3,4,5,6,7]);
 assert.ok(rows.rows.every(r=>r.digest.length===64));
 assert.equal((await admin.query('select count(*) from workspace_items')).rows[0].count,'2');
});
test('S2-02/03: credential lifecycle and strict source binding',async()=>{
 const source=await registerSource(db,a,'Mochbot fixture');
 const listed=await listSources(db,a);
 assert.equal(JSON.stringify(listed).includes(source.credential),false);
 assert.equal(JSON.stringify(listed).includes('token_hash'),false);
 assert.equal((await listSources(db,b)).some((s:any)=>s.id===source.id),false);
 await assert.rejects(()=>rotateCredential(db,b,source.id),/not found/i);
 await assert.rejects(()=>ingestSignal(db,'invalid',signal(source.id,'bad-token')),/unauthorized/i);
 await assert.rejects(()=>ingestSignal(db,source.credential,{...signal(source.id,'body-owner'),ownerId:b}),/unrecognized|invalid/i);
 await assert.rejects(()=>ingestSignal(db,source.credential,signal(randomUUID(),'wrong-source')),/source/i);
 await setSourceEnabled(db,a,source.id,false);
 await assert.rejects(()=>ingestSignal(db,source.credential,signal(source.id,'disabled')),/unauthorized/i);
 await setSourceEnabled(db,a,source.id,true);
 const rotated=await rotateCredential(db,a,source.id);
 await assert.rejects(()=>ingestSignal(db,source.credential,signal(source.id,'old-key')),/unauthorized/i);
 assert.equal((await ingestSignal(db,rotated,signal(source.id,'new-key'))).kind,'created');
 await revokeCredentials(db,a,source.id);
 await assert.rejects(()=>ingestSignal(db,rotated,signal(source.id,'revoked')),/unauthorized/i);
 const expiring=await registerSource(db,a,'Expiry fixture');
 await admin.query("update terminal_source_credentials set expires_at=now()-interval '1 second' where source_id=$1",[expiring.id]);
 await assert.rejects(()=>ingestSignal(db,expiring.credential,signal(expiring.id,'expired-key')),/unauthorized/i);
});
test('S2-01: modified applied checksum is rejected before changing schema',async()=>{
 const original=(await admin.query('select digest from terminal_migrations where version=2')).rows[0].digest;
 try{
  await admin.query("update terminal_migrations set digest='tampered-fixture' where version=2");
  await assert.rejects(()=>migrate(admin),/checksum differs/i);
 }finally{await admin.query('update terminal_migrations set digest=$1 where version=2',[original]);}
});
test('S2-04/05: 20 concurrent identical signals produce one setup/outbox and preserve exact IDs',async()=>{
 const source=await registerSource(db,a,'Concurrent fixture'),payload=signal(source.id,'duplicate');
 const all=await Promise.all(Array.from({length:20},()=>ingestSignal(db,source.credential,payload)));
 assert.equal(all.filter(r=>r.kind==='created').length,1);
 assert.equal(new Set(all.map(r=>r.signalId)).size,1);assert.equal(new Set(all.map(r=>r.setupId)).size,1);
 for(const table of ['terminal_signals','terminal_setups','terminal_outbox']){
  assert.equal((await admin.query('select count(*) from '+table+' where source_id=$1',[source.id])).rows[0].count,'1');
 }
 const result=await ingestSignal(db,source.credential,{...payload,strategyVersion:'changed'});
 assert.equal(result.kind,'conflict');
 assert.equal((await ingestSignal(db,source.credential,{...payload,strategyVersion:'changed'})).kind,'conflict');
 assert.equal((await admin.query('select count(*) from terminal_ingest_conflicts where source_id=$1',[source.id])).rows[0].count,'1');
 assert.equal((await admin.query('select payload from terminal_signals where id=$1',[all[0]!.signalId])).rows[0].payload.strategyVersion,payload.strategyVersion);
 // Simulate passage of time without changing the persisted event bytes.
 assert.equal((await ingestSignal(db,source.credential,payload,{now:Date.now()+86400000})).kind,'duplicate');
 const reconnect=new Pool({connectionString:process.env.DATABASE_URL!});
 try{assert.equal((await withOwner(reconnect,a,c=>c.query('select id from terminal_signals where id=$1',[all[0]!.signalId]))).rowCount,1);}
 finally{await reconnect.end();}
});
test('S2-04/09: stale, expired, future and shadow ingestion',async()=>{
 const source=await registerSource(db,a,'Freshness fixture');
 await assert.rejects(()=>ingestSignal(db,source.credential,signal(source.id,'stale',Date.now()-300000)),/stale|expired/i);
 await assert.rejects(()=>ingestSignal(db,source.credential,signal(source.id,'future',Date.now()+300000)),/future/i);
 const expired=signal(source.id,'expired',Date.now()-10000);expired.expiresAt=new Date(Date.now()-1000).toISOString();
 await assert.rejects(()=>ingestSignal(db,source.credential,expired),/expired/i);
 const held=await ingestSignal(db,source.credential,signal(source.id,'shadow'),{mode:'shadow'});
 assert.equal((await admin.query('select status from terminal_outbox where signal_id=$1',[held.signalId])).rows[0].status,'held');
});
test('S2-06: actual outbox constraint failure rolls back signal/setup/instrument',async()=>{
 const source=await registerSource(db,a,'Rollback fixture');
 await admin.query("alter table terminal_outbox add constraint s2_injected_failure check ((payload->>'sourceEventId') <> 'rollback-case')");
 try{
  const payload={...signal(source.id,'rollback-case'),instrument:{...instrument,nativeSymbol:'ROLLBACK_USDT',base:'ROLLBACK'}};
  await assert.rejects(()=>ingestSignal(db,source.credential,payload));
  for(const table of ['terminal_signals','terminal_setups','terminal_outbox'])
   assert.equal((await admin.query('select count(*) from '+table+' where source_id=$1',[source.id])).rows[0].count,'0');
  assert.equal((await admin.query("select count(*) from terminal_instruments where payload->>'base'='ROLLBACK'")).rows[0].count,'0');
 }finally{await admin.query('alter table terminal_outbox drop constraint s2_injected_failure');}
});
test('S2-07: forced RLS and composite FKs reject cross-owner links',async()=>{
 const source=await registerSource(db,a,'Private fixture');
 const result=await ingestSignal(db,source.credential,signal(source.id,'private'));
 for(const table of ['terminal_sources','terminal_source_credentials','terminal_signals','terminal_setups','terminal_outbox','terminal_ingest_conflicts','terminal_trades','terminal_fills','terminal_delivery_attempts']){
  assert.equal((await withOwner(db,b,c=>c.query('select count(*) from '+table+' where owner_id=$1',[a]))).rows[0].count,'0');
 }
 await assert.rejects(()=>withOwner(db,b,c=>c.query("insert into terminal_source_credentials(id,owner_id,source_id,token_hash,expires_at) values($1,$2,$3,$4,now()+interval '1 day')",[randomUUID(),b,source.id,'f'.repeat(64)])),{code:'23503'});
 const outbox=(await admin.query('select * from terminal_outbox where signal_id=$1',[result.signalId])).rows[0];
 await assert.rejects(()=>withOwner(db,b,c=>c.query("insert into terminal_delivery_attempts(id,owner_id,outbox_id,attempt,status) values($1,$2,$3,1,'failed')",[randomUUID(),b,outbox.id])),{code:'23503'});
 await withOwner(db,a,c=>c.query("insert into terminal_delivery_attempts(id,owner_id,outbox_id,attempt,status) values($1,$2,$3,1,'failed')",[randomUUID(),a,outbox.id]));
 await assert.rejects(()=>withOwner(db,a,c=>c.query("insert into terminal_delivery_attempts(id,owner_id,outbox_id,attempt,status) values($1,$2,$3,1,'failed')",[randomUUID(),a,outbox.id])));
 await assert.rejects(()=>withOwner(db,a,c=>c.query("update terminal_delivery_attempts set status='provider-accepted'")));
});
test('S2-08: exact paper fills preserve partial exits and reject duplicates/conflicts/overfills',async()=>{
 const source=await registerSource(db,a,'Fill fixture');
 const setup=await ingestSignal(db,source.credential,signal(source.id,'fill-setup'));
 const trade=await createPaperTrade(db,a,setup.setupId,{side:'long',initialRisk:'20'});
 const base={schemaVersion:1,sourceId:source.id,tradeId:trade.id,ownerId:a,instrument,provenance:'simulated',fee:'0',feeCurrency:'USDT'};
 const entry={...base,sourceFillId:'entry',kind:'entry',quantity:'10',price:'100',occurredAt:'2026-11-18T00:01:00.000Z'};
 const tp1={...base,sourceFillId:'tp1',kind:'exit',quantity:'5',price:'106',occurredAt:'2026-11-18T00:02:00.000Z'};
 const be={...base,sourceFillId:'be',kind:'exit',quantity:'5',price:'100',occurredAt:'2026-11-18T00:03:00.000Z'};
 await appendFill(db,a,entry);await appendFill(db,a,tp1);
 const finals=await Promise.all(Array.from({length:5},()=>appendFill(db,a,be)));
 assert.ok(finals.every(r=>r.ledger.netPnl==='30'&&r.ledger.remainingQuantity==='0'));
 assert.equal((await admin.query('select count(*) from terminal_fills where trade_id=$1',[trade.id])).rows[0].count,'3');
 await assert.rejects(()=>appendFill(db,a,{...be,price:'101'}),/conflict/i);
 await assert.rejects(()=>appendFill(db,a,{...be,sourceFillId:'overfill',quantity:'1'}));
 await assert.rejects(()=>appendFill(db,b,be));
 await assert.rejects(()=>appendFill(db,a,{...be,sourceFillId:'actual',provenance:'exchange-confirmed',externalOrderId:'ref'}));
 await assert.rejects(()=>createPaperTrade(db,b,setup.setupId,{side:'long',initialRisk:'20'}),/not found/i);
});
test('S2-08: concurrent source fill identity reuse across trades reports conflict',async()=>{
 const source=await registerSource(db,a,'Fill race fixture');
 const one=await ingestSignal(db,source.credential,signal(source.id,'race-one'));
 const two=await ingestSignal(db,source.credential,signal(source.id,'race-two'));
 const t1=await createPaperTrade(db,a,one.setupId,{side:'long',initialRisk:'20'});
 const t2=await createPaperTrade(db,a,two.setupId,{side:'long',initialRisk:'20'});
 const base={schemaVersion:1,sourceId:source.id,sourceFillId:'same-entry',ownerId:a,instrument,provenance:'simulated',kind:'entry',quantity:'10',price:'100',fee:'0',feeCurrency:'USDT',occurredAt:'2026-11-18T00:01:00.000Z'};
 const results=await Promise.allSettled([appendFill(db,a,{...base,tradeId:t1.id}),appendFill(db,a,{...base,tradeId:t2.id})]);
 assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
 const failure=results.find(r=>r.status==='rejected') as PromiseRejectedResult;
 assert.equal(failure.reason.status,409);
});
