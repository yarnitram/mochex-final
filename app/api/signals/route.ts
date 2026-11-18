import { database } from '../../../src/server/store';
import { listSignals } from '../../../src/server/signals';
import { requireOwner } from '../../../src/server/api-session';
import { json,errorResponse } from '../../../src/server/http';
export async function GET(){
 try{return json(await listSignals(database(),await requireOwner()));}catch(error){return errorResponse(error);}
}
