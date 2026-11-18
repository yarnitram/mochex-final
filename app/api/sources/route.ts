import { z } from 'zod';
import { database } from '../../../src/server/store';
import { listSources,registerSource } from '../../../src/server/signals';
import { requireOwner,requireOrigin } from '../../../src/server/api-session';
import { json,errorResponse,readJson } from '../../../src/server/http';
export async function GET(){
 try{return json(await listSources(database(),await requireOwner()));}catch(error){return errorResponse(error);}
}
export async function POST(request:Request){
 try{
  requireOrigin(request);const owner=await requireOwner();
  const {name}=z.strictObject({name:z.string().trim().min(1).max(100)}).parse(await readJson(request));
  return json(await registerSource(database(),owner,name),201);
 }catch(error){return errorResponse(error);}
}
