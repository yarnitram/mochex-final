import { z } from 'zod';
import { Money,decimal } from '../contracts.js';
export const positive=decimal.refine(v=>new Money(v).gt(0));
export const nonnegative=decimal.refine(v=>new Money(v).gte(0));
export function normalizeSymbol(value:string):string{
 const upper=value.trim().toUpperCase().replace('/','_');
 const symbol=upper.includes('_')?upper:upper.replace(/USDT$/,'_USDT');
 if(!/^[A-Z0-9]{1,24}_USDT$/.test(symbol))throw Error('Use a MEXC USDT perpetual symbol, e.g. BTC_USDT');
 return symbol;
}
export const planSchema=z.strictObject({
 symbol:z.string().transform((v,c)=>{try{return normalizeSymbol(v);}catch{c.addIssue({code:'custom',message:'Use a USDT perpetual symbol such as BTC_USDT'});return z.NEVER;}}),side:z.enum(['long','short']),entry:positive,stop:positive,target:positive,
 trigger:positive.optional(),triggerDirection:z.enum(['above','below']).optional(),timeframe:z.enum(['1m','5m','15m','1h','4h','1d']).default('15m'),
 strategy:z.string().max(100).default(''),notes:z.string().max(4000).default(''),
}).superRefine((p,c)=>{
 const long=p.side==='long';
 if(long?!(new Money(p.stop).lt(p.entry)&&new Money(p.target).gt(p.entry)):!(new Money(p.stop).gt(p.entry)&&new Money(p.target).lt(p.entry)))
  c.addIssue({code:'custom',message:'Long: SL < entry < TP. Short: TP < entry < SL.'});
});
export type Plan=z.infer<typeof planSchema>;
export function validatePlan(value:unknown){return planSchema.parse(value);}
export function positionSummary(trade:Plan&{quantity:string,entryFee:string},exits:{quantity:string,price:string,fee:string}[]){
 let remaining=new Money(positive.parse(trade.quantity)),gross=new Money(0),fees=new Money(nonnegative.parse(trade.entryFee));
 for(const exit of exits){
  const qty=new Money(positive.parse(exit.quantity)),price=new Money(positive.parse(exit.price));
  if(qty.gt(remaining))throw Error('Exit quantity exceeds remaining position');
  remaining=remaining.minus(qty);gross=gross.plus(price.minus(trade.entry).times(qty).times(trade.side==='long'?1:-1));
  fees=fees.plus(nonnegative.parse(exit.fee));
 }
 const risk=new Money(trade.entry).minus(trade.stop).abs().times(trade.quantity),net=gross.minus(fees);
 return {remaining:remaining.toFixed(),gross:gross.toFixed(),fees:fees.toFixed(),net:net.toFixed(),
  risk:risk.toFixed(),rMultiple:risk.gt(0)?net.div(risk).toDecimalPlaces(8).toFixed():'0'};
}
