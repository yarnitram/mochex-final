import { z } from 'zod';
import { database } from '../../../../src/server/store';
import { setSourceEnabled } from '../../../../src/server/signals';
import { requireOwner,requireOrigin } from '../../../../src/server/api-session';
import { json,errorResponse,readJson } from '../../../../src/server/http';
export async function PATCH(request:Request,{params}:{params:Promise<{id:string}>}){
 try{
  requireOrigin(request);const owner=await requireOwner(),{id}=await params;
  const {enabled}=z.strictObject({enabled:z.boolean()}).parse(await readJson(request));
  await setSourceEnabled(database(),owner,id,enabled);return json({enabled});
 }catch(error){return errorResponse(error);}
}
