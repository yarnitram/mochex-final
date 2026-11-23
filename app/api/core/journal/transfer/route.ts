import {requireOwner,requireOrigin} from '../../../../../src/server/api-session';
import {database} from '../../../../../src/server/store';
import {errorResponse,json} from '../../../../../src/server/http';
import {PersistenceError} from '../../../../../src/server/signal-contracts';
import {exportJournal,importJournal} from '../../../../../src/core/journal-transfer';

export async function GET(){
 try{const csv=await exportJournal(database(),await requireOwner());return new Response(csv,{headers:{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="mochex-journal.csv"','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});}
 catch(e){return errorResponse(e);}
}
export async function POST(request:Request){
 try{
  requireOrigin(request);const owner=await requireOwner();
  if(request.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase()!=='text/csv')throw new PersistenceError(415,'CSV content type required');
  if(Number(request.headers.get('content-length')??0)>1048576)throw new PersistenceError(413,'CSV too large');
  if(!request.body)throw new PersistenceError(400,'CSV body required');
  const reader=request.body.getReader(),chunks:Uint8Array[]=[];let size=0;
  try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>1048576){await reader.cancel();throw new PersistenceError(413,'CSV too large');}chunks.push(value);}}finally{reader.releaseLock();}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
  let csv:string;try{csv=new TextDecoder('utf-8',{fatal:true}).decode(bytes);}catch{throw new PersistenceError(400,'CSV must be UTF-8');}
  return json(await importJournal(database(),owner,csv,new URL(request.url).searchParams.get('mode')==='apply'));
 }catch(e){return errorResponse(e);}
}
