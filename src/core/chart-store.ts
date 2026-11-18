import {z} from 'zod';
import type {Pool} from 'pg';
import {withOwner} from '../server/store.js';
import {fingerprint,PersistenceError} from '../server/signal-contracts.js';
import {layoutSchema,defaultLayout} from './chart/workspace.js';
import {normalizeSymbol} from './domain.js';
const symbol=z.string().max(40).transform((v,c)=>{try{return normalizeSymbol(v);}catch{c.addIssue({code:'custom',message:'Invalid symbol'});return z.NEVER;}});
export const chartContext=z.strictObject({symbol,timeframe:z.enum(['1m','5m','15m','1h','4h','1d'])});
export const saveLayoutInput=chartContext.extend({revision:z.number().int().nonnegative(),requestId:z.uuid(),document:layoutSchema});
export async function readLayout(db:Pool,owner:string,raw:unknown){
 const q=chartContext.parse(raw);
 return withOwner(db,owner,async c=>{
  const row=(await c.query('SELECT revision,document FROM core_chart_layouts WHERE symbol=$1 AND timeframe=$2',[q.symbol,q.timeframe])).rows[0];
  return {...q,revision:row?.revision??0,document:row?.document??defaultLayout};
 });
}
export async function saveLayout(db:Pool,owner:string,raw:unknown){
 const q=saveLayoutInput.parse(raw),hash=fingerprint(q.document);
 return withOwner(db,owner,async c=>{
  await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[owner+':chart:'+q.symbol+':'+q.timeframe]);
  const old=(await c.query('SELECT * FROM core_chart_layouts WHERE symbol=$1 AND timeframe=$2 FOR UPDATE',[q.symbol,q.timeframe])).rows[0];
  if(old?.last_request===q.requestId){
   if(old.fingerprint!==hash)throw new PersistenceError(409,'Layout retry changed');
   return {revision:old.revision};
  }
  if((old?.revision??0)!==q.revision)throw new PersistenceError(409,'Layout changed elsewhere. Your draft is preserved; reload saved layout to review.');
  const revision=q.revision+1;
  await c.query('INSERT INTO core_chart_layouts(owner_id,symbol,timeframe,revision,document,last_request,fingerprint) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(owner_id,symbol,timeframe) DO UPDATE SET revision=excluded.revision,document=excluded.document,last_request=excluded.last_request,fingerprint=excluded.fingerprint,updated_at=now()',[owner,q.symbol,q.timeframe,revision,q.document,q.requestId,hash]);
  return {revision};
 });
}
