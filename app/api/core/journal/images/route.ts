import {requireOwner,requireOrigin} from '../../../../../src/server/api-session';
import {database} from '../../../../../src/server/store';
import {json,errorResponse} from '../../../../../src/server/http';
import {PersistenceError} from '../../../../../src/server/signal-contracts';
import {addTradeImage,MAX_IMAGE_BYTES} from '../../../../../src/core/journal-images';

export async function POST(request:Request){
 try{
  requireOrigin(request);const owner=await requireOwner();
  const tradeId=new URL(request.url).searchParams.get('tradeId')??'',mime=request.headers.get('content-type')??'';
  if(Number(request.headers.get('content-length')??0)>MAX_IMAGE_BYTES)throw new PersistenceError(413,'Image too large');
  if(!request.body)throw new PersistenceError(400,'Image body required');
  const reader=request.body.getReader(),chunks:Uint8Array[]=[];let size=0;
  try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>MAX_IMAGE_BYTES){await reader.cancel();throw new PersistenceError(413,'Image too large');}chunks.push(value);}}finally{reader.releaseLock();}
  const bytes=Buffer.concat(chunks.map(c=>Buffer.from(c)),size);
  return json({id:await addTradeImage(database(),owner,tradeId,mime,bytes)},201);
 }catch(e){return errorResponse(e);}
}
