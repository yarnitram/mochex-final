import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { database,login } from '../../../../src/server/store';
import { validOrigin } from '../../../../src/server/auth';
import { appOrigin,SESSION_COOKIE,sessionCookieOptions } from '../../../../src/server/session';
export async function POST(request:Request){
 const origin=appOrigin();
 if(!validOrigin(request.headers.get('origin'),origin))return NextResponse.json({error:'Forbidden'},{status:403});
 if(Number(request.headers.get('content-length')??0)>8192)return NextResponse.json({error:'Request too large'},{status:413});
 const data=await request.formData(),email=data.get('email'),password=data.get('password');
 if(typeof email!=='string'||typeof password!=='string')return NextResponse.json({error:'Invalid request'},{status:400});
 const token=await login(database(),email,password,(await cookies()).get(SESSION_COOKIE)?.value);
 const response=NextResponse.redirect(new URL(token?'/workbench':'/login?error=invalid',origin),303);
 response.headers.set('Cache-Control','no-store');
 if(token)response.cookies.set(SESSION_COOKIE,token,sessionCookieOptions());
 return response;
}
