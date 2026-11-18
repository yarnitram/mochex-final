import { z } from 'zod';
import { requireOwner,requireOrigin } from '../../../../src/server/api-session';
import { database } from '../../../../src/server/store';
import { readJson,json,errorResponse } from '../../../../src/server/http';
import { marketSnapshot } from '../../../../src/core/market-provider';
import { sampleOwner,monitorSnapshot } from '../../../../src/core/monitor';
import { workbenchSnapshot } from '../../../../src/core/store';
import { normalizeSymbol, } from '../../../../src/core/domain';
import { quoteState } from '../../../../src/core/quotes';
export async function POST(request:Request){
 try{
  requireOrigin(request);const owner=await requireOwner();
  const body=z.strictObject({symbols:z.array(z.string().max(40)).max(100).default([])}).parse(await readJson(request));
  const extra=body.symbols.map(v=>{try{return normalizeSymbol(v);}catch{throw new z.ZodError([{code:'custom',path:['symbols'],message:'Invalid symbol'}]);}});
  let market;
  try{market=await marketSnapshot();}catch{
   await sampleOwner(database(),owner,{instruments:[],quotes:{}});
   return json({error:'MEXC perpetual quotes unavailable; monitoring continuity reset',...await monitorSnapshot(database(),owner)},503);
  }
  const sampled=await sampleOwner(database(),owner,market),workspace=await workbenchSnapshot(database(),owner);
  const symbols=[...new Set([...extra,...workspace.watchlist.map((w:any)=>w.data.symbol),...workspace.trades.filter((t:any)=>!t.closed_at).map((t:any)=>t.data.symbol)])];
  const supported=new Set(market.instruments.map(i=>i.symbol)),now=Date.now();
  const quotes=Object.fromEntries(symbols.map(symbol=>[symbol,{quote:market.quotes[symbol]??null,status:supported.has(symbol)?quoteState(market.quotes[symbol],now):'unsupported'}]));
  return json({exchange:'mexc',market:'perpetual',quotes,receivedAt:new Date(now).toISOString(),...sampled,...await monitorSnapshot(database(),owner)});
 }catch(e){return errorResponse(e);}
}
