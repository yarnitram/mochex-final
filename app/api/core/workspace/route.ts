import { database } from '../../../../src/server/store';
import { z } from 'zod';
import { requireOwner,requireOrigin } from '../../../../src/server/api-session';
import { readJson,json,errorResponse } from '../../../../src/server/http';
import { createWatch,changeWatch,openWatch,createManualTrade,recordExit,reviewTrade,workbenchSnapshot,savePreferences } from '../../../../src/core/store';
export async function GET(){
 try{return json(await workbenchSnapshot(database(),await requireOwner()));}catch(e){return errorResponse(e);}
}
export async function POST(request:Request){
 try{
  requireOrigin(request);const owner=await requireOwner();
  const raw=z.strictObject({action:z.enum(['watch-create','watch-change','watch-open','trade-create','trade-exit','trade-review','preferences']),id:z.uuid().optional(),data:z.unknown()}).parse(await readJson(request));
  const db=database();
  switch(raw.action){
   case 'preferences':await savePreferences(db,owner,raw.data);return json({ok:true});
   case 'watch-create':return json({id:await createWatch(db,owner,raw.data)},201);
   case 'watch-change':await changeWatch(db,owner,raw.id!,raw.data);return json({ok:true});
   case 'watch-open':return json({id:await openWatch(db,owner,raw.id!,raw.data)},201);
   case 'trade-create':return json({id:await createManualTrade(db,owner,raw.data)},201);
   case 'trade-exit':await recordExit(db,owner,raw.id!,raw.data);return json({ok:true});
   case 'trade-review':await reviewTrade(db,owner,raw.id!,raw.data);return json({ok:true});
   default:return json({error:'Unknown workspace action'},400);
  }
 }catch(e){return errorResponse(e);}
}
