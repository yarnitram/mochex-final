import {requireOwner,requireOrigin} from '../../../../src/server/api-session';
import {database} from '../../../../src/server/store';
import {json,errorResponse,readJson} from '../../../../src/server/http';
import {readLayout,saveLayout} from '../../../../src/core/chart-store';
export async function GET(request:Request){
 try{const p=new URL(request.url).searchParams;return json(await readLayout(database(),await requireOwner(),{symbol:p.get('symbol'),timeframe:p.get('timeframe')}));}catch(e){return errorResponse(e);}
}
export async function POST(request:Request){
 try{requireOrigin(request);const owner=await requireOwner();return json(await saveLayout(database(),owner,await readJson(request)));}catch(e){return errorResponse(e);}
}
