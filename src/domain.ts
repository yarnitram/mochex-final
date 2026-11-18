import { z } from 'zod';
import { Money, decimal, fillSchema, eventKey, instrumentKey, journalSchema } from './contracts.js';

export function emaClosed(values: number[],period: number): (number|null)[] {
  if(!Number.isSafeInteger(period)||period<1||values.some(v=>!Number.isFinite(v)||v<=0))
    throw new Error('EMA requires a positive integer period and finite positive closes');
  const out:(number|null)[]=Array(values.length).fill(null);
  if(values.length<period)return out;
  let previous=values.slice(0,period).reduce((a,b)=>a+b,0)/period;
  out[period-1]=previous;
  const alpha=2/(period+1);
  for(let i=period;i<values.length;i++) {
    previous=values[i]!*alpha+previous*(1-alpha);out[i]=previous;
  }
  return out;
}
const candleSchema=z.strictObject({
  openTimeMs:z.number().int().min(946684800000).max(4102444800000),
  open:decimal,high:decimal,low:decimal,close:decimal,volume:decimal,
});
export type ClosedCandle=z.infer<typeof candleSchema>;
export function normalizeCandles(input:unknown[],durationMs:number,nowMs:number):ClosedCandle[] {
  if(!Number.isSafeInteger(durationMs)||durationMs<1||!Number.isSafeInteger(nowMs))
    throw new Error('Explicit integer millisecond duration and current time required');
  const rows=new Map<number,ClosedCandle>();
  for(const item of input) {
    const c=candleSchema.parse(item),low=new Money(c.low),high=new Money(c.high);
    if(c.openTimeMs%durationMs!==0 || c.openTimeMs+durationMs>nowMs ||
      low.lte(0)||high.lt(low)||new Money(c.volume).lt(0)||
      [c.open,c.close].some(v=>new Money(v).lt(low)||new Money(v).gt(high)))
      throw new Error('Invalid, unaligned, or unclosed candle');
    const existing=rows.get(c.openTimeMs);
    if(existing && ['open','high','low','close','volume'].some(k=>
      !new Money(existing[k as keyof Omit<ClosedCandle,'openTimeMs'>]).eq(c[k as keyof Omit<ClosedCandle,'openTimeMs'>])))
      throw new Error('Conflicting candle revision');
    rows.set(c.openTimeMs,c);
  }
  const result=[...rows.values()].sort((a,b)=>a.openTimeMs-b.openTimeMs);
  if(result.some((c,i)=>i>0&&c.openTimeMs-result[i-1]!.openTimeMs!==durationMs))
    throw new Error('Missing candle window');
  return result;
}

/** M0 reference: one initial entry, any number of partial exits, base-unit quantities.
 * Linear quote-settled instruments only; no exchange execution or storage here.
 */
export function replayLedger(side:'long'|'short',initialRisk:string,input:unknown[]) {
  if(!['long','short'].includes(side)||!decimal.safeParse(initialRisk).success||new Money(initialRisk).lte(0))
    throw new Error('Positive initial quote risk and explicit side required');
  const unique=new Map<string,ReturnType<typeof fillSchema.parse>>();
  for(const raw of input) {
    const fill=fillSchema.parse(raw),key=eventKey(fill.sourceId,fill.sourceFillId),old=unique.get(key);
    if(old&&JSON.stringify(old)!==JSON.stringify(fill))throw new Error('Conflicting fill identity');
    unique.set(key,fill);
  }
  const fills=[...unique.values()].sort((a,b)=>
    a.occurredAt.localeCompare(b.occurredAt)||eventKey(a.sourceId,a.sourceFillId).localeCompare(eventKey(b.sourceId,b.sourceFillId)));
  const first=fills[0];
  if(!first||first.kind!=='entry')throw new Error('Initial entry required');
  if(first.instrument.market==='perpetual' && first.instrument.settlement!==first.instrument.quote)
    throw new Error('Inverse/foreign-settled ledger unsupported');
  let remaining=new Money(first.quantity),gross=new Money(0),fees=new Money(0);
  const entryPrice=new Money(first.price),identity=instrumentKey(first.instrument);
  for(let i=0;i<fills.length;i++){
    const f=fills[i]!;
    if(f.tradeId!==first.tradeId||f.ownerId!==first.ownerId||
      instrumentKey(f.instrument)!==identity||f.provenance!==first.provenance||
      f.feeCurrency!==first.instrument.quote)throw new Error('Mixed ledger identity or unsupported fee currency');
    if(i>0){
      if(f.kind!=='exit'||f.occurredAt<=first.occurredAt)throw new Error('Only later exits supported after initial entry');
      const qty=new Money(f.quantity);
      if(qty.gt(remaining))throw new Error('Exit exceeds open quantity');
      gross=gross.plus(new Money(f.price).minus(entryPrice).times(qty).times(side==='long'?1:-1));
      remaining=remaining.minus(qty);
    }
    fees=fees.plus(f.fee);
  }
  const net=gross.minus(fees);
  return journalSchema.parse({
    schemaVersion:1,tradeId:first.tradeId,ownerId:first.ownerId,instrument:first.instrument,
    side,provenance:first.provenance,fillKeys:fills.map(f=>eventKey(f.sourceId,f.sourceFillId)),
    remainingQuantity:remaining.toFixed(),grossPnl:gross.toFixed(),fees:fees.toFixed(),
    netPnl:net.toFixed(),initialRisk,rMultiple:net.div(initialRisk).toDecimalPlaces(18).toFixed(),
  });
}
