import { test,after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { registerSource,getSetup,ingestSignal } from '../src/server/signals.js';
import { signal } from './signal-fixture.js';
import { withOwner } from '../src/server/store.js';
import { ingestMochbot } from '../src/server/observations.js';
import { observation } from '../fixtures/mochbot-observation.js';
const db=new Pool({connectionString:process.env.DATABASE_URL!,max:20});
const admin=new Pool({connectionString:process.env.TEST_ADMIN_DATABASE_URL!});
const a=process.env.FIXTURE_A_ID!,b=process.env.FIXTURE_B_ID!;
after(async()=>{await db.end();await admin.end();});
test('S3-06: concurrent revision applies once to one setup, holds outbox and creates no fill',async()=>{
 const source=await registerSource(db,a,'MOD-01E shadow');
 const root=observation(source.id),created=await ingestMochbot(db,source.credential,root);
 assert.equal(created.kind,'created');
 const next=observation(source.id,1,'entry-ready');
 const results=await Promise.all(Array.from({length:12},()=>ingestMochbot(db,source.credential,next)));
 assert.equal(results.filter(r=>r.kind==='applied').length,1);assert.equal(new Set(results.map(r=>r.setupId)).size,1);
 const setup=await getSetup(db,a,created.setupId!);
 assert.equal(setup.state,'entry-ready');assert.equal(setup.revision,1);assert.equal(setup.geometry.levels.entry,'103.82');
 assert.equal(setup.history.length,2);
 assert.equal((await admin.query('select count(*) from terminal_setups where source_id=$1',[source.id])).rows[0].count,'1');
 assert.equal((await admin.query("select count(*) from terminal_outbox where source_id=$1 and status='held'",[source.id])).rows[0].count,'2');
 assert.equal((await admin.query('select count(*) from terminal_fills where source_id=$1',[source.id])).rows[0].count,'0');
 assert.equal((await ingestMochbot(db,source.credential,next,{now:Date.now()+86400000})).kind,'duplicate');
});
test('S3-04: gaps/conflicts/backwards observations are auditable and do not regress state',async()=>{
 const source=await registerSource(db,a,'Revision rejection');
 const created=await ingestMochbot(db,source.credential,observation(source.id));
 const gap=await ingestMochbot(db,source.credential,observation(source.id,2,'entry-ready'));
 assert.equal(gap.reason,'revision-gap');
 await ingestMochbot(db,source.credential,observation(source.id,1,'entry-ready'));
 const backwards=await ingestMochbot(db,source.credential,observation(source.id,2,'armed'));
 assert.equal(backwards.reason,'invalid-transition');
 const changed=observation(source.id,0);changed.capturedAt=new Date(Date.parse(changed.capturedAt)+1).toISOString();
 assert.equal((await ingestMochbot(db,source.credential,changed)).reason,'conflict');
 const setup=await getSetup(db,a,created.setupId!);assert.equal(setup.state,'entry-ready');assert.equal(setup.revision,1);
 assert.ok(setup.reconciliation.length>=3);
});
test('S3-05: expiry, stale history and terminal reopening are guarded',async()=>{
 const source=await registerSource(db,a,'Expiry');
 const root=observation(source.id);const created=await ingestMochbot(db,source.credential,root);
 const expired=observation(source.id,1,'expired');
 assert.equal((await ingestMochbot(db,source.credential,expired,{now:expired.snapshot.ts*1000+1000})).kind,'applied');
 const reopened=observation(source.id,2,'armed');
 assert.equal((await ingestMochbot(db,source.credential,reopened)).reason,'terminal-state');
 assert.equal((await getSetup(db,a,created.setupId!)).state,'expired');
 const staleSource=await registerSource(db,a,'Stale');
 const stale=observation(staleSource.id);
 assert.equal((await ingestMochbot(db,staleSource.credential,stale,{now:stale.snapshot.ts*1000+181000})).kind,'rejected');
 assert.equal((await admin.query('select count(*) from terminal_setups where source_id=$1',[staleSource.id])).rows[0].count,'0');
});
test('S3-06: actual history insert failure rolls back revision/signal/outbox',async()=>{
 const source=await registerSource(db,a,'Atomic revision'),created=await ingestMochbot(db,source.credential,observation(source.id));
 await admin.query('alter table terminal_setup_observations add constraint s3_failure check (revision<>1) NOT VALID');
 try{
  await assert.rejects(()=>ingestMochbot(db,source.credential,observation(source.id,1,'entry-ready')));
  const setup=await getSetup(db,a,created.setupId!);assert.equal(setup.revision,0);assert.equal(setup.state,'armed');
  for(const table of ['terminal_signals','terminal_outbox'])assert.equal((await admin.query('select count(*) from '+table+' where source_id=$1',[source.id])).rows[0].count,'1');
 }finally{await admin.query('alter table terminal_setup_observations drop constraint s3_failure');}
});
test('S3-07/09: ignored snapshots still authenticate; new records are owner isolated and immutable',async()=>{
 const source=await registerSource(db,a,'Private observations');
 const raw=observation(source.id);raw.snapshot.stage='WATCH';
 await assert.rejects(()=>ingestMochbot(db,'invalid',raw));
 assert.equal((await ingestMochbot(db,source.credential,raw)).kind,'ignored');
 const created=await ingestMochbot(db,source.credential,observation(source.id));
 await assert.rejects(()=>getSetup(db,b,created.setupId!),/not found/i);
 for(const table of ['terminal_setup_bindings','terminal_setup_observations','terminal_reconciliation_events'])
  assert.equal((await withOwner(db,b,c=>c.query('select count(*) from '+table+' where owner_id=$1',[a]))).rows[0].count,'0');
 const otherSource=await registerSource(db,b,'Other owner fixture');
 const otherSignal=await ingestSignal(db,otherSource.credential,signal(otherSource.id,'owned-v1'));
 await assert.rejects(()=>withOwner(db,b,c=>c.query('insert into terminal_setup_observations(id,owner_id,source_id,setup_id,signal_id,revision,state,observed_at) values($1,$2,$3,$4,$5,5,$6,now())',[randomUUID(),b,otherSource.id,created.setupId,otherSignal.signalId,'armed'])),{code:'23503'});
 await assert.rejects(()=>withOwner(db,a,c=>c.query('update terminal_setup_observations set state=$1',['expired'])));
});
