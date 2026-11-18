import { parseCatalogue,parseTickers,type Instrument,type Quote } from './quotes.js';
type Entry<T>={value?:T,error?:Error,until:number,pending?:Promise<T>};
export function cachedLoader<T>(load:()=>Promise<T>,ttl:number,clock=Date.now){
 const state:Entry<T>={until:0};
 return async():Promise<T>=>{
  if(state.pending)return state.pending;
  if(clock()<state.until){if(state.error)throw state.error;return state.value!;}
  state.pending=load().then(value=>{state.value=value;state.error=undefined;state.until=clock()+ttl;return value;}).catch(e=>{state.error=e instanceof Error?e:Error('MEXC unavailable');state.until=clock()+5000;throw state.error;}).finally(()=>{state.pending=undefined;});
  return state.pending;
 };
}
async function request(path:'detail'|'ticker'){
 try{
  const r=await fetch('https://contract.mexc.com/api/v1/contract/'+path,{cache:'no-store',signal:AbortSignal.timeout(10000)});
  if(!r.ok)throw Error('MEXC HTTP '+r.status);return await r.json();
 }catch{throw Error('MEXC perpetual market feed unavailable');}
}
export const catalogue=cachedLoader(()=>request('detail').then(parseCatalogue),300000);
export const tickers=cachedLoader(()=>request('ticker').then(parseTickers),5000);
export type MarketSnapshot={instruments:Instrument[],quotes:Record<string,Quote>};
export async function marketSnapshot():Promise<MarketSnapshot>{
 const [instruments,all]=await Promise.all([catalogue(),tickers()]);
 return {instruments,quotes:Object.fromEntries(instruments.flatMap(i=>all[i.symbol]?[[i.symbol,all[i.symbol]!]]:[]))};
}
