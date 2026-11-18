import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { database,logout } from '../../../../src/server/store';
import { validOrigin } from '../../../../src/server/auth';
import { appOrigin,SESSION_COOKIE,sessionCookieOptions } from '../../../../src/server/session';
export async function POST(request:Request){
 const origin=appOrigin();
 if(!validOrigin(request.headers.get('origin'),origin))return NextResponse.json({error:'Forbidden'},{status:403});
 await logout(database(),(await cookies()).get(SESSION_COOKIE)?.value);
 const response=NextResponse.redirect(new URL('/login',origin),303);
 response.cookies.set(SESSION_COOKIE,'',{...sessionCookieOptions(),maxAge:0});
 response.headers.set('Cache-Control','no-store');
 return response;
}
