import { z } from 'zod';
import { normalizeSymbol } from './domain.js';
export const intervals={ '1m':'Min1','5m':'Min5','15m':'Min15','1h':'Min60','4h':'Hour4','1d':'Day1'} as const;
export type Candle={time:number,open:number,high:number,low:number,close:number,volume:number};
export function marketQuery(symbol:string,tf:string){
 const native=normalizeSymbol(symbol),timeframe=z.enum(['1m','5m','15m','1h','4h','1d']).parse(tf);
 return {symbol:native,timeframe,url:'https://contract.mexc.com/api/v1/contract/kline/'+encodeURIComponent(native)+'?interval='+intervals[timeframe]};
}
export function parseFuturesCandles(input:any):Candle[]{
 if(input?.success!==true||!input.data||!Array.isArray(input.data.time))throw Error('MEXC futures data unavailable');
 const d=input.data;
 if(!['open','high','low','close','vol'].every(k=>Array.isArray(d[k])&&d[k].length===d.time.length))throw Error('Incomplete futures candle arrays');
 const bars:Candle[]=d.time.map((t:unknown,i:number)=>({time:Number(t),open:Number(d.open[i]),high:Number(d.high[i]),low:Number(d.low[i]),close:Number(d.close[i]),volume:Number(d.vol[i])}));
 if(bars.some(b=>!Number.isInteger(b.time)||b.time<946684800||b.time>4102444800||![b.open,b.high,b.low,b.close,b.volume].every(Number.isFinite)||b.low<=0||b.volume<0||b.high<b.low||b.open<b.low||b.open>b.high||b.close<b.low||b.close>b.high))
  throw Error('Invalid futures candles');
 bars.sort((a,b)=>a.time-b.time);
 if(new Set(bars.map(b=>b.time)).size!==bars.length)throw Error('Duplicate futures candle times');
 return bars.slice(-500);
}
