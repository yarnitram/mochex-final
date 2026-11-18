import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import type { Pool,PoolClient } from 'pg';
import { Money } from '../contracts.js';
import { validatePlan,positionSummary,positive,nonnegative } from './domain.js';
import { withOwner } from '../server/store.js';
import { preferences,defaultPreferences } from './quotes.js';
import { fingerprint,PersistenceError } from '../server/signal-contracts.js';
import {parseReview} from './journal.js';
const funding=z.strictObject({requestId:z.uuid(),margin:positive,leverage:positive.refine(v=>new Money(v).lte(1000)),entryFee:nonnegative.default('0')});
const exitInput=z.strictObject({requestId:z.uuid(),quantity:positive,price:positive,fee:nonnegative.default('0'),note:z.string().max(2000).default('')});
async function rows(c:PoolClient,tradeId:string){return (await c.query('SELECT data,created_at FROM core_exits WHERE trade_id=$1 ORDER BY created_at,id',[tradeId])).rows;}
async function insertTrade(c:PoolClient,owner:string,plan:ReturnType<typeof validatePlan>,raw:z.infer<typeof funding>,watchlistId?:string){
 const quantity=new Money(raw.margin).times(raw.leverage).div(plan.entry).toDecimalPlaces(18).toFixed();positive.parse(quantity);
 const data={...plan,margin:raw.margin,leverage:raw.leverage,entryFee:raw.entryFee,quantity,provenance:'manually-reported'};
 const hash=fingerprint(data);
 const old=await c.query('SELECT id,fingerprint,watchlist_id FROM core_trades WHERE request_id=$1',[raw.requestId]);
 if(old.rowCount){if(old.rows[0].fingerprint!==hash||(old.rows[0].watchlist_id??null)!==(watchlistId??null))throw new PersistenceError(409,'Trade request changed');return old.rows[0].id as string;}
 const id=randomUUID();await c.query('INSERT INTO core_trades(id,owner_id,request_id,watchlist_id,data,fingerprint) VALUES($1,$2,$3,$4,$5,$6)',[id,owner,raw.requestId,watchlistId??null,data,hash]);
 return id;
}
export async function createWatch(db:Pool,owner:string,raw:unknown){
 const {requestId,...body}=z.object({requestId:z.uuid()}).passthrough().parse(raw),plan=validatePlan(body);
 return withOwner(db,owner,async c=>{
  await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[owner+':watch:'+requestId]);
  const old=await c.query('SELECT id,fingerprint FROM core_watchlist WHERE request_id=$1',[requestId]),hash=fingerprint(plan);
  if(old.rowCount){if(old.rows[0].fingerprint!==hash)throw new PersistenceError(409,'Setup request changed');return old.rows[0].id as string;}
  const id=randomUUID();await c.query('INSERT INTO core_watchlist(id,owner_id,request_id,data,fingerprint) VALUES($1,$2,$3,$4,$5)',[id,owner,requestId,plan,hash]);return id;
 });
}
export async function changeWatch(db:Pool,owner:string,id:string,raw:unknown){
 z.uuid().parse(id);
 const input=z.discriminatedUnion('action',[
  z.strictObject({action:z.literal('edit'),revision:z.number().int().nonnegative(),plan:z.unknown()}),
  z.strictObject({action:z.enum(['archive','restore']),revision:z.number().int().nonnegative()}),
 ]).parse(raw);
 return withOwner(db,owner,async c=>{
  const result=await c.query('SELECT * FROM core_watchlist WHERE id=$1 FOR UPDATE',[id]);const row=result.rows[0];
  if(!row)throw new PersistenceError(404,'Setup not found');if(row.revision!==input.revision)throw new PersistenceError(409,'Setup changed; refresh first');
  if(row.status==='opened')throw new PersistenceError(409,'Setup already has a recorded trade');
  const data=input.action==='edit'?validatePlan(input.plan):row.data,status=input.action==='archive'?'archived':input.action==='restore'?'active':row.status;
  await c.query('UPDATE core_watchlist SET data=$2,fingerprint=$3,status=$4,revision=revision+1 WHERE id=$1',[id,data,fingerprint(data),status]);
 });
}
export async function openWatch(db:Pool,owner:string,id:string,raw:unknown){
 z.uuid().parse(id);const input=funding.parse(raw);
 return withOwner(db,owner,async c=>{
  const row=(await c.query('SELECT * FROM core_watchlist WHERE id=$1 FOR UPDATE',[id])).rows[0];
  if(!row)throw new PersistenceError(404,'Setup not found');
  const old=(await c.query('SELECT id FROM core_trades WHERE watchlist_id=$1',[id])).rows[0];if(old)return old.id as string;
  if(row.status!=='active')throw new PersistenceError(409,'Restore the archived setup before opening');
  await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[owner+':trade:'+input.requestId]);
  const tradeId=await insertTrade(c,owner,validatePlan(row.data),input,id);
  await c.query("UPDATE core_watchlist SET status='opened',revision=revision+1 WHERE id=$1",[id]);return tradeId;
 });
}
export async function createManualTrade(db:Pool,owner:string,raw:unknown){
 const {requestId,margin,leverage,entryFee,...plan}=z.object({requestId:z.uuid(),margin:positive,leverage:positive,entryFee:nonnegative.default('0')}).passthrough().parse(raw);
 const input=funding.parse({requestId,margin,leverage,entryFee}),valid=validatePlan(plan);
 return withOwner(db,owner,async c=>{
  await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[owner+':trade:'+requestId]);
  return insertTrade(c,owner,valid,input);
 });
}
export async function recordExit(db:Pool,owner:string,id:string,raw:unknown){
 z.uuid().parse(id);const input=exitInput.parse(raw);
 return withOwner(db,owner,async c=>{
  const trade=(await c.query('SELECT * FROM core_trades WHERE id=$1 FOR UPDATE',[id])).rows[0];
  if(!trade)throw new PersistenceError(404,'Trade not found');
  const old=(await c.query('SELECT fingerprint FROM core_exits WHERE trade_id=$1 AND request_id=$2',[id,input.requestId])).rows[0],hash=fingerprint(input);
  if(old){if(old.fingerprint!==hash)throw new PersistenceError(409,'Exit request changed');return;}
  const previous=await rows(c,id);
  if(new Money(input.quantity).gt(positionSummary(trade.data,previous.map(r=>r.data)).remaining))throw new PersistenceError(422,'Exit quantity exceeds remaining position');
  const summary=positionSummary(trade.data,[...previous.map(r=>r.data),input]);
  await c.query('INSERT INTO core_exits(id,owner_id,trade_id,request_id,data,fingerprint) VALUES($1,$2,$3,$4,$5,$6)',[randomUUID(),owner,id,input.requestId,input,hash]);
  if(summary.remaining==='0')await c.query('UPDATE core_trades SET closed_at=now() WHERE id=$1',[id]);
 });
}
export async function reviewTrade(db:Pool,owner:string,id:string,raw:unknown){
 z.uuid().parse(id);const {review,tags}=parseReview(raw);
 await withOwner(db,owner,async c=>{
  const result=tags===undefined?await c.query('UPDATE core_trades SET review=$2 WHERE id=$1 RETURNING id',[id,review]):await c.query('UPDATE core_trades SET review=$2,tags=$3 WHERE id=$1 RETURNING id',[id,review,tags]);
  if(!result.rowCount)throw new PersistenceError(404,'Trade not found');
 });
}
export async function workbenchSnapshot(db:Pool,owner:string){
 return withOwner(db,owner,async c=>{
  const watchlist=(await c.query('SELECT id,data,status,revision,created_at FROM core_watchlist ORDER BY created_at DESC LIMIT 500')).rows;
  const trades=(await c.query("SELECT t.id,t.data,t.review,t.tags,t.watchlist_id,t.created_at,t.closed_at,coalesce((SELECT jsonb_agg(jsonb_build_object('data',e.data,'created_at',e.created_at) ORDER BY e.created_at,e.id) FROM core_exits e WHERE e.trade_id=t.id),'[]'::jsonb) exits FROM core_trades t ORDER BY t.created_at DESC LIMIT 500")).rows;
  const prefs=(await c.query('SELECT data FROM core_preferences')).rows[0]?.data??defaultPreferences;
  return {watchlist,preferences:prefs,trades:trades.map(t=>({...t,summary:positionSummary(t.data,t.exits.map((e:any)=>e.data))}))};
 });
}
export async function savePreferences(db:Pool,owner:string,raw:unknown){
 const data=preferences.parse(raw);
 await withOwner(db,owner,c=>c.query('INSERT INTO core_preferences(owner_id,data) VALUES($1,$2) ON CONFLICT(owner_id) DO UPDATE SET data=excluded.data',[owner,data]));
}
