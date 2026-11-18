import { ZodError } from 'zod';
import { PersistenceError } from './signal-contracts.js';
export function json(body:unknown,status=200){
 return Response.json(body,{status,headers:{'Cache-Control':'no-store','Pragma':'no-cache'}});
}
export function errorResponse(error:unknown){
 if(error instanceof PersistenceError)return json({error:error.message},error.status);
 if(error instanceof ZodError)return json({error:'Invalid request'},400);
 return json({error:'Persistence temporarily unavailable'},503);
}
export async function readJson(request:Request,maxBytes=65536):Promise<unknown>{
 if(request.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase()!=='application/json')
  throw new PersistenceError(415,'JSON content type required');
 if(Number(request.headers.get('content-length')??0)>maxBytes)throw new PersistenceError(413,'Request too large');
 if(!request.body)throw new PersistenceError(400,'Invalid JSON');
 const reader=request.body.getReader(),chunks:Uint8Array[]=[];let size=0;
 try{
  while(true){
   const {value,done}=await reader.read();if(done)break;
   size+=value.byteLength;
   if(size>maxBytes){await reader.cancel();throw new PersistenceError(413,'Request too large');}
   chunks.push(value);
  }
 }finally{reader.releaseLock();}
 const bytes=new Uint8Array(size);let offset=0;
 for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
 try{return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}
 catch{throw new PersistenceError(400,'Invalid JSON');}
}
