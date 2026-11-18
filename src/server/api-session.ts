import { viewer,appOrigin } from './session.js';
import { validOrigin } from './auth.js';
import { PersistenceError } from './signal-contracts.js';
export async function requireOwner(){
 const account=await viewer();if(!account)throw new PersistenceError(401,'Unauthorized');
 return account.id;
}
export function requireOrigin(request:Request){
 if(!validOrigin(request.headers.get('origin'),appOrigin()))throw new PersistenceError(403,'Forbidden');
}
