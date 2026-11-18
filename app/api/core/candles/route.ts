import { requireOwner } from '../../../../src/server/api-session';
import { json,errorResponse } from '../../../../src/server/http';
import { marketQuery,parseFuturesCandles } from '../../../../src/core/market';
export async function GET(request:Request){
 try{
  await requireOwner();const params=new URL(request.url).searchParams;
  let query;try{query=marketQuery(params.get('symbol')??'BTC_USDT',params.get('timeframe')??'15m');}catch{return json({error:'Invalid symbol or timeframe'},400);}
  const res=await fetch(query.url,{cache:'no-store',signal:AbortSignal.timeout(10000)});
  if(!res.ok)return json({error:'MEXC futures feed unavailable'},502);
  const candles=parseFuturesCandles(await res.json());
  const duration=({'1m':60,'5m':300,'15m':900,'1h':3600,'4h':14400,'1d':86400} as Record<string,number>)[query.timeframe]!;
  const latest=candles.at(-1)?.time,stale=latest===undefined||Date.now()/1000-latest>duration*2;
  if(latest&&latest>Date.now()/1000+5)return json({error:'MEXC candle timestamp is in the future'},502);
  return json({exchange:'mexc',market:'perpetual',symbol:query.symbol,timeframe:query.timeframe,updatedAt:new Date().toISOString(),latestCandleAt:latest?new Date(latest*1000).toISOString():null,stale,candles});
 }catch(e){
  if(e instanceof Error&&(/MEXC|candles|futures/.test(e.message)))return json({error:'MEXC futures feed unavailable'},502);
  return errorResponse(e);
 }
}
