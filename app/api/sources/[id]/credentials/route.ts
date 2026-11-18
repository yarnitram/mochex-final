import { database } from '../../../../../src/server/store';
import { rotateCredential,revokeCredentials } from '../../../../../src/server/signals';
import { requireOwner,requireOrigin } from '../../../../../src/server/api-session';
import { json,errorResponse } from '../../../../../src/server/http';
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
 try{
  requireOrigin(request);const owner=await requireOwner(),{id}=await params;
  return json({credential:await rotateCredential(database(),owner,id)});
 }catch(error){return errorResponse(error);}
}
export async function DELETE(request:Request,{params}:{params:Promise<{id:string}>}){
 try{
  requireOrigin(request);const owner=await requireOwner(),{id}=await params;
  await revokeCredentials(database(),owner,id);return json({revoked:true});
 }catch(error){return errorResponse(error);}
}
