import { NextResponse } from 'next/server';
import { z } from 'zod';
import { viewer } from '../../../../../src/server/session';
import { database,withOwner } from '../../../../../src/server/store';
export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){
 const account=await viewer();
 if(!account)return NextResponse.json({error:'Unauthorized'},{status:401});
 const {id}=await params;
 if(!z.uuid().safeParse(id).success)return NextResponse.json({error:'Not found'},{status:404});
 const result=await withOwner(database(),account.id,c=>c.query('SELECT id,title FROM workspace_items WHERE id=$1',[id]));
 return NextResponse.json(result.rows[0]??{error:'Not found'},{status:result.rowCount?200:404,headers:{'Cache-Control':'no-store'}});
}
