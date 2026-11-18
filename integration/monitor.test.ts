import { test,after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { sampleOwner,monitorSnapshot } from '../src/core/monitor.js';
import { createWatch,changeWatch,createManualTrade,recordExit,workbenchSnapshot,savePreferences } from '../src/core/store.js';
import { withOwner } from '../src/server/store.js';
const db=new Pool({connectionString:process.env.DATABASE_URL!}),admin=new Pool({connectionString:process.env.TEST_ADMIN_DATABASE_URL!});
const a=process.env.FIXTURE_A_ID!,b=process.env.FIXTURE_B_ID!;
const plan={symbol:'QTEST_USDT',side:'long',entry:'100',stop:'98',target:'110',trigger:'100',triggerDirection:'above',timeframe:'15m',strategy:'Core2 test',notes:''};
const market=(price:string,time:number)=>({instruments:[{symbol:'QTEST_USDT',base:'QTEST'}],quotes:{QTEST_USDT:{symbol:'QTEST_USDT',price,time,changePct:'0',turnover:'0'}}});
const events=async(id:string)=>(await monitorSnapshot(db,a)).events.filter(e=>e.target_key===id);
after(async()=>{await db.end();await admin.end();});
test('Q-04/06: short SL/TP directions and an independent above trigger are preserved',async()=>{
 const p={...plan,symbol:'QSHORT_USDT',side:'short',stop:'102',target:'90',trigger:'101',triggerDirection:'above'};
 const setup=await createWatch(db,a,{...p,requestId:randomUUID()});
 const trade=await createManualTrade(db,a,{...p,requestId:randomUUID(),margin:'100',leverage:'10'});
 const now=Date.now(),m=(price:string,time:number)=>({instruments:[{symbol:p.symbol,base:'QSHORT'}],quotes:{[p.symbol]:{symbol:p.symbol,price,time,changePct:'0',turnover:'0'}}});
 await sampleOwner(db,a,m('100',now),now);
 await sampleOwner(db,a,m('102',now+1000),now+1000);
 await sampleOwner(db,a,m('90',now+2000),now+2000);
 assert.deepEqual((await events('watch:'+setup)).map(e=>e.kind),['trigger']);
 assert.deepEqual((await events('trade:'+trade)).map(e=>e.kind).sort(),['stop','target']);
 assert.equal((await workbenchSnapshot(db,a)).trades.find(t=>t.id===trade)!.summary.remaining,'10');
 await changeWatch(db,a,setup,{action:'archive',revision:0});
});
test('Q-04/05/06: concurrent trigger crossing emits once, revision resets and ledger unchanged',async()=>{
 const id=await createWatch(db,a,{...plan,requestId:randomUUID()}),key='watch:'+id,now=Date.now();
 await sampleOwner(db,a,market('99',now),now);
 await Promise.all(Array.from({length:8},()=>sampleOwner(db,a,market('100',now+1000),now+1000)));
 assert.equal((await events(key)).length,1);
 await sampleOwner(db,a,market('99',now+2000),now+2000);await sampleOwner(db,a,market('101',now+3000),now+3000);
 assert.equal((await events(key)).length,1);
 await changeWatch(db,a,id,{action:'edit',revision:0,plan:{...plan,notes:'revised'}});
 await sampleOwner(db,a,market('101',now+4000),now+4000);assert.equal((await events(key)).length,1);
 await sampleOwner(db,a,market('99',now+5000),now+5000);await sampleOwner(db,a,market('100',now+6000),now+6000);
 assert.equal((await events(key)).length,2);
 assert.equal((await workbenchSnapshot(db,a)).trades.some(t=>t.watchlist_id===id),false);
 await changeWatch(db,a,id,{action:'archive',revision:1});
 await sampleOwner(db,a,market('99',now+7000),now+7000);await sampleOwner(db,a,market('101',now+8000),now+8000);
 assert.equal((await events(key)).length,2);
});
test('Q-05: stale/missing/unsupported/gap samples reset continuity; late samples never rewind',async()=>{
 const id=await createWatch(db,a,{...plan,requestId:randomUUID()}),key='watch:'+id,now=Date.now();
 await sampleOwner(db,a,market('99',now),now);
 await sampleOwner(db,a,{instruments:[],quotes:{}},now+1000);
 await sampleOwner(db,a,market('101',now+2000),now+2000);assert.equal((await events(key)).length,0);
 await sampleOwner(db,a,market('99',now+1000),now+2500);
 await sampleOwner(db,a,market('102',now+3000),now+3000);assert.equal((await events(key)).length,0);
 await sampleOwner(db,a,market('99',now+4000),now+4000);
 await sampleOwner(db,a,market('101',now+35000),now+35000);assert.equal((await events(key)).length,0);
 await sampleOwner(db,a,market('99',now+36000),now+70000);
 await sampleOwner(db,a,market('101',now+71000),now+71000);assert.equal((await events(key)).length,0);
});
test('Q-06: SL/TP crossings keep partial trade open and record remaining size',async()=>{
 const id=await createManualTrade(db,a,{...plan,requestId:randomUUID(),margin:'100',leverage:'10'}),key='trade:'+id,now=Date.now();
 await recordExit(db,a,id,{requestId:randomUUID(),quantity:'5',price:'106',fee:'0'});
 await sampleOwner(db,a,market('100',now),now);
 await sampleOwner(db,a,market('98',now+1000),now+1000);
 await sampleOwner(db,a,market('110',now+2000),now+2000);
 assert.deepEqual((await events(key)).map(e=>e.kind).sort(),['stop','target']);
 assert.ok((await events(key)).every(e=>e.data.remaining==='5'));
 const stored=(await workbenchSnapshot(db,a)).trades.find(t=>t.id===id)!;
 assert.equal(stored.summary.remaining,'5');assert.equal(stored.exits.length,1);assert.equal(stored.closed_at,null);
 await recordExit(db,a,id,{requestId:randomUUID(),quantity:'5',price:'100',fee:'0'});
 await sampleOwner(db,a,market('90',now+3000),now+3000);assert.equal((await events(key)).length,2);
});
test('Q-03/08: preferences and monitoring are owner isolated; event ledger is immutable',async()=>{
 await savePreferences(db,a,{columns:['price','trigger'],sort:'price',descending:true});
 assert.equal((await workbenchSnapshot(db,a)).preferences.sort,'price');
 assert.equal((await workbenchSnapshot(db,b)).preferences.sort,'symbol');
 assert.equal((await monitorSnapshot(db,b)).events.length,0);
 await assert.rejects(()=>withOwner(db,a,c=>c.query('UPDATE core_monitor_events SET kind=$1',['target'])));
 await assert.rejects(()=>savePreferences(db,a,{columns:['bad'],sort:'price'}));
 await withOwner(db,b,async c=>{assert.equal((await c.query('SELECT * FROM core_preferences WHERE owner_id=$1',[a])).rowCount,0);});
 await savePreferences(db,a,{columns:['direction','price','change','turnover','trigger','levels','rr','added'],sort:'symbol',descending:false});
});
test('Q-06/08: failed event insert rolls back baseline; retry can emit once',async()=>{
 const id=await createWatch(db,a,{...plan,symbol:'FAULT_USDT',requestId:randomUUID()}),key='watch:'+id,now=Date.now();
 const m=(price:string,time:number)=>({instruments:[{symbol:'FAULT_USDT',base:'FAULT'}],quotes:{FAULT_USDT:{symbol:'FAULT_USDT',price,time,changePct:'0',turnover:'0'}}});
 await sampleOwner(db,a,m('99',now),now);
 await admin.query("ALTER TABLE core_monitor_events ADD CONSTRAINT monitor_fault CHECK(kind<>'trigger') NOT VALID");
 try{await assert.rejects(()=>sampleOwner(db,a,m('101',now+1000),now+1000));}
 finally{await admin.query('ALTER TABLE core_monitor_events DROP CONSTRAINT monitor_fault');}
 await sampleOwner(db,a,m('101',now+1000),now+1000);assert.equal((await events(key)).length,1);
});
