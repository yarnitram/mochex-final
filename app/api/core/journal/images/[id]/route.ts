import {requireOwner,requireOrigin} from '../../../../../../src/server/api-session';
import {database} from '../../../../../../src/server/store';
import {errorResponse,json} from '../../../../../../src/server/http';
import {readTradeImage,removeTradeImage} from '../../../../../../src/core/journal-images';

export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){
 try{
  const {id}=await params,{mime,bytes}=await readTradeImage(database(),await requireOwner(),id);
  return new Response(new Uint8Array(bytes),{headers:{'Content-Type':mime,'Content-Length':String(bytes.length),'X-Content-Type-Options':'nosniff','Cache-Control':'private, no-store'}});
 }catch(e){return errorResponse(e);}
}
export async function DELETE(request:Request,{params}:{params:Promise<{id:string}>}){
 try{requireOrigin(request);const {id}=await params;await removeTradeImage(database(),await requireOwner(),id);return json({ok:true});}
 catch(e){return errorResponse(e);}
}
