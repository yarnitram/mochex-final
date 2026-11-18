import { database } from '../../../../src/server/store';
import { ingestMochbot } from '../../../../src/server/observations';
import { credentialHash,PersistenceError } from '../../../../src/server/signal-contracts';
import { readJson,json,errorResponse } from '../../../../src/server/http';
export async function POST(request:Request){
 try{
  const authorization=request.headers.get('authorization');
  if(!authorization?.startsWith('Bearer '))throw new PersistenceError(401,'Unauthorized scanner');
  const credential=authorization.slice(7);credentialHash(credential);
  const result=await ingestMochbot(database(),credential,await readJson(request));
  return json(result,result.kind==='rejected'?(result.status??409):result.kind==='created'||result.kind==='applied'?202:200);
 }catch(error){return errorResponse(error);}
}
