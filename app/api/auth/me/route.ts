import { NextResponse } from 'next/server';
import { viewer } from '../../../../src/server/session';
export async function GET(){
 const account=await viewer();
 return NextResponse.json(account??{error:'Unauthorized'},{status:account?200:401,headers:{'Cache-Control':'no-store'}});
}
