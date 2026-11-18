import { z } from 'zod';
import { Decimal } from 'decimal.js';

export const Money = Decimal.clone({ precision: 80 });
const id = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/);
const asset = z.string().regex(/^[A-Z0-9]{1,32}$/);
export const decimal = z.string().max(30).regex(/^-?(0|[1-9]\d*)(\.\d+)?$/);
const nonNegative = decimal.refine(v => new Money(v).gte(0));
const positive = decimal.refine(v => new Money(v).gt(0));
const timestamp = z.iso.datetime({ precision: 3 });
const version = z.literal(1);

export const instrumentSchema = z.strictObject({
  schemaVersion: version,
  exchange: z.enum(['mexc','binance','bybit','bitget']),
  market: z.enum(['spot','perpetual']),
  nativeSymbol: z.string().min(1).max(64).regex(/^[A-Za-z0-9_:/.-]+$/),
  base: asset, quote: asset, settlement: asset.nullable(),
  contractMultiplier: positive,
}).superRefine((v,c) => {
  if ((v.market==='spot' && (v.settlement!==null || !new Money(v.contractMultiplier).eq(1))) ||
      (v.market==='perpetual' && v.settlement===null)) {
    c.addIssue({code:'custom',message:'Spot requires null settlement and multiplier 1; perpetual requires settlement'});
  }
});
export type InstrumentKey = z.infer<typeof instrumentSchema>;
export function instrumentKey(input: unknown): string {
  const v=instrumentSchema.parse(input);
  return JSON.stringify([v.exchange,v.market,v.nativeSymbol,v.base,v.quote,v.settlement,new Money(v.contractMultiplier).toFixed()]);
}
export function eventKey(source: string, event: string): string {
  // JSON tuple avoids delimiter collisions. Source IDs are bound by ingestion auth in M1.
  return JSON.stringify([z.string().min(1).max(128).parse(source),z.string().min(1).max(128).parse(event)]);
}
export const signalSchema=z.strictObject({
  schemaVersion:version,sourceId:id,sourceEventId:id,instrument:instrumentSchema,
  strategyId:id,strategyVersion:id,configurationVersion:id,
  timeframe:z.enum(['1m','3m','5m','15m','30m','1h','4h','1d','1w','1M']),
  candleOpenTime:timestamp,observedAt:timestamp,emittedAt:timestamp,
  expiresAt:timestamp,maxAgeSeconds:z.number().int().positive().max(86400),
  evidence:z.strictObject({kind:z.enum(['synthetic','closed-candle','intrabar']),reference:id}),
}).superRefine((v,c)=>{
  if(Date.parse(v.candleOpenTime)>Date.parse(v.observedAt) ||
     Date.parse(v.observedAt)>Date.parse(v.emittedAt) ||
     Date.parse(v.expiresAt)<=Date.parse(v.emittedAt)) {
    c.addIssue({code:'custom',message:'Signal timestamps must be chronological'});
  }
});
export const setupSchema=z.strictObject({
  schemaVersion:version,id,ownerId:id,signalKey:z.string().min(1),instrument:instrumentSchema,
  state:z.enum(['detected','watching','armed','entry-ready','invalidated','expired','cancelled']),
  revision:z.number().int().nonnegative(),monitorOwner:z.enum(['terminal','source']),
  updatedAt:timestamp,
});
export const fillSchema=z.strictObject({
  schemaVersion:version,sourceId:id,sourceFillId:id,tradeId:id,ownerId:id,
  instrument:instrumentSchema,provenance:z.enum(['simulated','manually-reported','exchange-confirmed']),
  externalOrderId:id.optional(),kind:z.enum(['entry','exit']),
  quantity:positive,price:positive,fee:nonNegative,feeCurrency:asset,occurredAt:timestamp,
}).superRefine((v,c)=>{
  if(v.provenance==='exchange-confirmed' && !v.externalOrderId)
    c.addIssue({code:'custom',message:'Confirmed fill requires exchange order reference'});
});
export type FillEvent=z.infer<typeof fillSchema>;
export const journalSchema=z.strictObject({
  schemaVersion:version,tradeId:id,ownerId:id,instrument:instrumentSchema,
  side:z.enum(['long','short']),provenance:z.enum(['simulated','manually-reported','exchange-confirmed']),
  fillKeys:z.array(z.string().min(1)).min(1),
  remainingQuantity:nonNegative,grossPnl:decimal,fees:nonNegative,netPnl:decimal,
  initialRisk:positive,rMultiple:decimal,
}).superRefine((v,c)=>{
  if(new Set(v.fillKeys).size!==v.fillKeys.length || !new Money(v.grossPnl).minus(v.fees).eq(v.netPnl))
    c.addIssue({code:'custom',message:'Journal keys must be unique and net equals gross minus fees'});
});
export const deliverySchema=z.strictObject({
  schemaVersion:version,id,eventKey:z.string().min(1),ownerId:id,
  channel:z.enum(['dry-run','discord','telegram','mobile']),attempt:z.number().int().positive(),
  status:z.enum(['queued','retrying','provider-accepted','failed','expired']),
  updatedAt:timestamp,nextAttemptAt:timestamp.optional(),providerReference:id.optional(),
}).superRefine((v,c)=>{
  if((v.status==='provider-accepted' && !v.providerReference) ||
     (v.status==='retrying' && (!v.nextAttemptAt || Date.parse(v.nextAttemptAt)<=Date.parse(v.updatedAt))))
    c.addIssue({code:'custom',message:'Accepted delivery needs provider reference; retry needs future schedule'});
});
export const schemas={
  instrument:instrumentSchema,signal:signalSchema,setup:setupSchema,
  fill:fillSchema,journal:journalSchema,delivery:deliverySchema,
};
