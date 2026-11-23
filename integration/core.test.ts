import { test,after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { createWatch,openWatch,recordExit,workbenchSnapshot,changeWatch,reviewTrade,createManualTrade } from '../src/core/store.js';
import { withOwner } from '../src/server/store.js';
import {addTradeImage,readTradeImage,removeTradeImage} from '../src/core/journal-images.js';
import {exportJournal,importJournal} from '../src/core/journal-transfer.js';
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
test('J-03: review tags persist and remain owner isolated',async()=>{
 const id=await createManualTrade(db,a,{...plan,requestId:randomUUID(),margin:'100',leverage:'1',entryFee:'0'});
 await recordExit(db,a,id,{requestId:randomUUID(),quantity:'1',price:'105',fee:'0'});
 await reviewTrade(db,a,id,{review:'Followed exit plan',tags:['patience','risk-control']});
 assert.deepEqual((await workbenchSnapshot(db,a)).trades.find(t=>t.id===id)!.tags,['patience','risk-control']);
 await reviewTrade(db,a,id,{review:'Updated from an older client'});
 assert.deepEqual((await workbenchSnapshot(db,a)).trades.find(t=>t.id===id)!.tags,['patience','risk-control']);
 assert.equal((await workbenchSnapshot(db,b)).trades.some(t=>t.id===id),false);
 await assert.rejects(()=>reviewTrade(db,b,id,{review:'spoof',tags:['late']}),/not found/i);
 assert.deepEqual((await workbenchSnapshot(db,a)).trades.find(t=>t.id===id)!.tags,['patience','risk-control']);
});
test('J-05: screenshot bytes are private, bounded and attached only to a closed trade',async()=>{
 const id=await createManualTrade(db,a,{...plan,requestId:randomUUID(),margin:'100',leverage:'1',entryFee:'0'});
 const png=Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000b49444154789c636000020000050001a5f645400000000049454e44ae426082','hex');
 await assert.rejects(()=>addTradeImage(db,a,id,'image/png',png),/closed/i);
 await recordExit(db,a,id,{requestId:randomUUID(),quantity:'1',price:'105',fee:'0'});
 const imageId=await addTradeImage(db,a,id,'image/png',png);
 assert.deepEqual((await readTradeImage(db,a,imageId)).bytes,png);
 await assert.rejects(()=>readTradeImage(db,b,imageId),/not found/i);
 await assert.rejects(()=>addTradeImage(db,a,id,'image/png',Buffer.from('not an image')),/image/i);
 await addTradeImage(db,a,id,'image/png',png);await addTradeImage(db,a,id,'image/png',png);
 await assert.rejects(()=>addTradeImage(db,a,id,'image/png',png),/three screenshots/i);
 await removeTradeImage(db,a,imageId);
 await assert.rejects(()=>readTradeImage(db,a,imageId),/not found/i);
});
test('J-09: EXMOCHEX review import previews, reconciles and never writes ledger events',async()=>{
 const id=await createManualTrade(db,a,{...plan,requestId:randomUUID(),margin:'100',leverage:'1',entryFee:'0'});
 await recordExit(db,a,id,{requestId:randomUUID(),quantity:'1',price:'105',fee:'0'});
 const own=(await workbenchSnapshot(db,a)).trades.find(t=>t.id===id)!;
 const day=new Date(own.closed_at).toISOString().slice(0,10),csv='Date,Symbol,Side,Entry,P&L ($),Tags,Notes,Trade ID\n'+[day,'BTC_USDT','long','100','5','patience','Followed plan',id].join(',')+'\n';
 assert.equal((await importJournal(db,a,csv,false)).rows[0]?.status,'ready');
 assert.equal((await importJournal(db,b,csv,false)).rows[0]?.status,'unmatched');
 const applied=await importJournal(db,a,csv,true);assert.equal(applied.applied,1);assert.equal(applied.rows[0]?.status,'applied');
 assert.equal((await importJournal(db,a,csv,true)).rows[0]?.status,'reviewed');
 const after=(await workbenchSnapshot(db,a)).trades.find(t=>t.id===id)!;
 assert.equal(after.review,'Followed plan');assert.deepEqual(after.tags,['patience']);assert.equal(after.exits.length,1);assert.equal(after.summary.net,'5');
 assert.match(await exportJournal(db,a),/Followed plan/);
 assert.doesNotMatch(await exportJournal(db,b),new RegExp(id));
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
