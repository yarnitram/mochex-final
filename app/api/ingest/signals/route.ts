import { database } from '../../../../src/server/store';
import { ingestSignal } from '../../../../src/server/signals';
import { credentialHash,PersistenceError } from '../../../../src/server/signal-contracts';
import { json,errorResponse,readJson } from '../../../../src/server/http';
export async function POST(request:Request){
 try{
  const authorization=request.headers.get('authorization');
  if(!authorization?.startsWith('Bearer '))throw new PersistenceError(401,'Unauthorized scanner');
  const token=authorization.slice(7);credentialHash(token);
  const mode=process.env.TERMINAL_INGEST_MODE??'shadow';
  if(mode!=='shadow'&&mode!=='dry-run')throw Error('Invalid server ingestion mode');
  const result=await ingestSignal(database(),token,await readJson(request),{mode});
  return json(result,result.kind==='created'?202:result.kind==='conflict'?409:200);
 }catch(error){return errorResponse(error);}
}
