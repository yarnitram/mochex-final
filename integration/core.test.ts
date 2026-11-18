import { test,after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { createWatch,openWatch,recordExit,workbenchSnapshot,changeWatch,reviewTrade,createManualTrade } from '../src/core/store.js';
import { withOwner } from '../src/server/store.js';
const db=new Pool({connectionString:process.env.DATABASE_URL!}),admin=new Pool({connectionString:process.env.TEST_ADMIN_DATABASE_URL!});
const a=process.env.FIXTURE_A_ID!,b=process.env.FIXTURE_B_ID!;
const plan={symbol:'BTC_USDT',side:'long',entry:'100',stop:'98',target:'110',trigger:'100',timeframe:'15m',strategy:'Pullback',notes:'Synthetic fixture'};
after(async()=>{await db.end();await admin.end();});
test('C-01/02/03/04: watchlist to partial/full exit to journal persists once',async()=>{
 const requestId=randomUUID(),setup=await createWatch(db,a,{...plan,requestId});
 assert.equal(await createWatch(db,a,{...plan,requestId}),setup);
 const funding={requestId:randomUUID(),margin:'100',leverage:'10',entryFee:'1'};
 const trade=await openWatch(db,a,setup,funding);assert.equal(await openWatch(db,a,setup,funding),trade);
 const first={requestId:randomUUID(),quantity:'5',price:'106',fee:'0.5',note:'TP1'};
 await recordExit(db,a,trade,first);await recordExit(db,a,trade,first);
 await recordExit(db,a,trade,{requestId:randomUUID(),quantity:'5',price:'100',fee:'0.5',note:'BE runner'});
 await reviewTrade(db,a,trade,{review:'Followed the plan'});
 const stored=(await workbenchSnapshot(db,a)).trades.find(t=>t.id===trade)!;
 assert.equal(stored.summary.net,'28');assert.equal(stored.summary.rMultiple,'1.4');assert.equal(stored.exits.length,2);
 assert.ok(stored.closed_at);assert.equal(stored.review,'Followed the plan');
 assert.equal((await workbenchSnapshot(db,b)).trades.some(t=>t.id===trade),false);
});
test('C-01: optimistic edits and reversible archive',async()=>{
 const id=await createWatch(db,a,{...plan,requestId:randomUUID()});
 await changeWatch(db,a,id,{action:'edit',revision:0,plan:{...plan,notes:'Updated thesis'}});
 await assert.rejects(()=>changeWatch(db,a,id,{action:'archive',revision:0}),/refresh/i);
 await changeWatch(db,a,id,{action:'archive',revision:1});await changeWatch(db,a,id,{action:'restore',revision:2});
 assert.equal((await workbenchSnapshot(db,a)).watchlist.find(w=>w.id===id)!.status,'active');
});
test('C-03: concurrent exits cannot overclose or double count',async()=>{
 const id=await createManualTrade(db,a,{...plan,requestId:randomUUID(),margin:'100',leverage:'10',entryFee:'0'});
 const settled=await Promise.allSettled([1,2].map(()=>recordExit(db,a,id,{requestId:randomUUID(),quantity:'10',price:'105',fee:'0'})));
 assert.equal(settled.filter(r=>r.status==='fulfilled').length,1);
 assert.equal((await workbenchSnapshot(db,a)).trades.find(t=>t.id===id)!.summary.net,'50');
 await assert.rejects(()=>recordExit(db,b,id,{requestId:randomUUID(),quantity:'1',price:'105',fee:'0'}),/not found/i);
});
test('C-08: database scope and immutable exits are enforced',async()=>{
 const own=(await workbenchSnapshot(db,a)).trades[0]!;
 await assert.rejects(()=>withOwner(db,b,c=>c.query('insert into core_exits(id,owner_id,trade_id,request_id,data,fingerprint) values($1,$2,$3,$4,$5,$6)',[randomUUID(),b,own.id,randomUUID(),{},'fixture'])),{code:'23503'});
 await assert.rejects(()=>withOwner(db,a,c=>c.query('update core_exits set data=$1',[{}])));
});
test('C-08: failed watchlist transition rolls back its trade insert',async()=>{
 const id=await createWatch(db,a,{...plan,requestId:randomUUID()});
 await admin.query("alter table core_watchlist add constraint core_fault check(status<>'opened') NOT VALID");
 try{
  await assert.rejects(()=>openWatch(db,a,id,{requestId:randomUUID(),margin:'100',leverage:'10',entryFee:'0'}));
  assert.equal((await admin.query('select count(*) from core_trades where watchlist_id=$1',[id])).rows[0].count,'0');
  assert.equal((await workbenchSnapshot(db,a)).watchlist.find(w=>w.id===id)!.status,'active');
 }finally{await admin.query('alter table core_watchlist drop constraint core_fault');}
});
