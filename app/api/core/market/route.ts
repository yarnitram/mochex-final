import { z } from 'zod';
import { requireOwner } from '../../../../src/server/api-session';
import { json,errorResponse } from '../../../../src/server/http';
import { catalogue } from '../../../../src/core/market-provider';
export async function GET(request:Request){
 try{
  await requireOwner();const search=z.string().max(40).parse(new URL(request.url).searchParams.get('search')??'').trim().toUpperCase().replace('/','_');
  const all=await catalogue(),matching=all.filter(i=>i.symbol.includes(search));
  return json({exchange:'mexc',market:'perpetual',instruments:matching.slice(0,40),total:matching.length});
 }catch(e){if(e instanceof Error&&/MEXC/.test(e.message))return json({error:'MEXC contract discovery unavailable'},503);return errorResponse(e);}
}
