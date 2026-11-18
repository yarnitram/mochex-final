import { database } from '../../../../src/server/store';
import { getSetup } from '../../../../src/server/signals';
import { requireOwner } from '../../../../src/server/api-session';
import { json,errorResponse } from '../../../../src/server/http';
export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){
 try{return json(await getSetup(database(),await requireOwner(),(await params).id));}catch(error){return errorResponse(error);}
}
