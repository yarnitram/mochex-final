import { z } from 'zod';
import { Money } from '../contracts.js';
import { normalizeSymbol } from './domain.js';
export type Instrument={symbol:string,base:string};
export type Quote={symbol:string,price:string,changePct:string,turnover:string,time:number};
export type Rule={kind:'trigger'|'stop'|'target',direction:'above'|'below',level:string};
export const columns=['direction','price','change','turnover','trigger','levels','rr','added'] as const;
export const preferences=z.strictObject({columns:z.array(z.enum(columns)).max(columns.length).refine(x=>new Set(x).size===x.length),sort:z.enum(['symbol','price','change','turnover']).default('symbol'),descending:z.boolean().default(false)});
export const defaultPreferences={columns:[...columns],sort:'symbol' as const,descending:false};
function rows(input:any):any[]{if(input?.success!==true||!Array.isArray(input.data))throw Error('MEXC market feed unavailable');return input.data;}
function native(s:unknown):s is string {return typeof s==='string'&&/^[A-Z0-9]{1,24}_USDT$/.test(s);}
export function parseCatalogue(input:unknown):Instrument[]{
 const found=new Map<string,Instrument>();
 for(const r of rows(input)){
  if(!r||!native(r.symbol)||r.quoteCoin!=='USDT'||r.settleCoin!=='USDT'||r.state!==0||r.isHidden===true||r.futureType!==1)continue;
  if(found.has(r.symbol))throw Error('Duplicate MEXC instrument');
  found.set(r.symbol,{symbol:r.symbol,base:r.symbol.slice(0,-5)});
 }
 return [...found.values()].sort((a,b)=>a.symbol.localeCompare(b.symbol));
}
function dec(v:unknown):string{
 if(typeof v!=='string'&&typeof v!=='number')throw Error('Invalid price');
 if(typeof v==='number'&&!Number.isFinite(v)||String(v).length>100)throw Error('Invalid price');
 const d=new Money(v);if(!d.isFinite()||d.abs().gte('1e40'))throw Error('Invalid price');return d.toFixed();
}
export function parseTickers(input:unknown):Record<string,Quote>{
 const result:Record<string,Quote>={},seen=new Set<string>();
 for(const r of rows(input)){
  if(!r||!native(r.symbol))continue;
  if(seen.has(r.symbol))throw Error('Duplicate MEXC ticker');seen.add(r.symbol);
  try{
   const price=dec(r.lastPrice),turnover=dec(r.amount24),changePct=new Money(dec(r.riseFallRate)).times(100).toFixed(),time=r.timestamp;
   if(new Money(price).lte(0)||new Money(turnover).lt(0)||!Number.isSafeInteger(time)||time<946684800000||time>4102444800000)continue;
   result[r.symbol]={symbol:r.symbol,price,turnover,changePct,time};
  }catch{/* An invalid quote is missing, never substituted. */}
 }
 return result;
}
export function quoteState(q:Quote|undefined|null,now:number):'missing'|'future'|'stale'|'live'{
 if(!q)return 'missing';if(q.time>now+5000)return 'future';return now-q.time>30000?'stale':'live';
}
export function crossings(rules:Rule[],previous:Quote|null,current:Quote,now:number):Rule['kind'][]{
 if(!previous||previous.symbol!==current.symbol||quoteState(previous,now)!=='live'||quoteState(current,now)!=='live'||current.time<=previous.time||current.time-previous.time>30000)return [];
 return rules.filter(r=>r.direction==='above'?new Money(previous.price).lt(r.level)&&new Money(current.price).gte(r.level):new Money(previous.price).gt(r.level)&&new Money(current.price).lte(r.level)).map(r=>r.kind);
}
export function selectedSymbols(raw:string){return [...new Set(raw.split(',').filter(Boolean).map(normalizeSymbol))].slice(0,100);}
