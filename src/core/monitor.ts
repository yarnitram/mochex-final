import type { Pool } from 'pg';
import { randomUUID } from 'node:crypto';
import { withOwner } from '../server/store.js';
import { crossings,quoteState,type Quote,type Rule } from './quotes.js';
import type { MarketSnapshot } from './market-provider.js';
import { validatePlan } from './domain.js';
export async function sampleOwner(db:Pool,owner:string,market:MarketSnapshot,now=Date.now()){
 return withOwner(db,owner,async c=>{
  await c.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",[owner+':core-monitor']);
  const watch=(await c.query("SELECT id,data,revision FROM core_watchlist WHERE status='active' ORDER BY id FOR UPDATE")).rows;
  const trades=(await c.query("SELECT id,data FROM core_trades WHERE closed_at IS NULL ORDER BY id FOR UPDATE")).rows;
  const supported=new Set(market.instruments.map(i=>i.symbol));let emitted=0;
  for(const row of [...watch.map(r=>({...r,type:'watch'})),...trades.map(r=>({...r,type:'trade',revision:0}))]){
   const {margin,leverage,entryFee,quantity,provenance,...plan}=row.data;
   const p=validatePlan(plan),key=row.type+':'+row.id;
   const previous=(await c.query('SELECT last_sample,revision FROM core_monitor_state WHERE target_key=$1',[key])).rows[0];
   const raw=market.quotes[p.symbol],q=supported.has(p.symbol)&&raw?.symbol===p.symbol&&quoteState(raw,now)==='live'?raw:null;
   const rules:Rule[]=row.type==='watch'?(p.trigger?[{kind:'trigger',direction:p.triggerDirection??(p.side==='long'?'above':'below'),level:p.trigger}]:[]):
    [{kind:'stop',direction:p.side==='long'?'below':'above',level:p.stop},{kind:'target',direction:p.side==='long'?'above':'below',level:p.target}];
   const baseline:Quote|null=previous?.revision===row.revision?previous.last_sample:null;
   // Late/duplicate provider observations never rewind or replace a newer sample.
   if(q&&baseline&&q.time<=baseline.time)continue;
   const kinds=q?crossings(rules,baseline,q,now):[];
   await c.query("INSERT INTO core_monitor_state(owner_id,target_key,watchlist_id,trade_id,revision,last_sample,sampled_at) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(owner_id,target_key) DO UPDATE SET revision=excluded.revision,last_sample=excluded.last_sample,sampled_at=excluded.sampled_at",[owner,key,row.type==='watch'?row.id:null,row.type==='trade'?row.id:null,row.revision,q,new Date(now)]);
   let remaining:string|undefined;
   if(row.type==='trade'&&kinds.length){remaining=(await c.query("SELECT ($2::numeric-coalesce(sum((data->>'quantity')::numeric),0))::text remaining FROM core_exits WHERE trade_id=$1",[row.id,row.data.quantity])).rows[0].remaining;}
   for(const kind of kinds){
    const level=rules.find(r=>r.kind===kind)!.level;
    const result=await c.query("INSERT INTO core_monitor_events(id,owner_id,target_key,revision,kind,data) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(owner_id,target_key,revision,kind) DO NOTHING",[randomUUID(),owner,key,row.revision,kind,{symbol:p.symbol,side:p.side,price:q!.price,level,observedAt:new Date(q!.time).toISOString(),previousPrice:baseline!.price,remaining,provenance:'observed-last-price-crossing'}]);
    emitted+=result.rowCount??0;
   }
  }
  return {emitted,sampledAt:new Date(now).toISOString()};
 });
}
export async function monitorSnapshot(db:Pool,owner:string){
 return withOwner(db,owner,async c=>({
  events:(await c.query('SELECT id,target_key,revision,kind,data,created_at FROM core_monitor_events ORDER BY created_at DESC,id LIMIT 100')).rows,
  sampledAt:(await c.query('SELECT max(sampled_at) time FROM core_monitor_state')).rows[0].time,
 }));
}
