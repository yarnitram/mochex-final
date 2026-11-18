import { cookies } from 'next/headers';
import { database,viewerForToken } from './store.js';
export const SESSION_COOKIE='terminal_session';
export function appOrigin():string{
 const value=process.env.APP_ORIGIN;
 if(!value||new URL(value).origin!==value)throw new Error('APP_ORIGIN must be a canonical origin');
 return value;
}
export async function viewer(){
 const token=(await cookies()).get(SESSION_COOKIE)?.value;
 return viewerForToken(database(),token);
}
export function sessionCookieOptions(){
 return {httpOnly:true,sameSite:'lax' as const,secure:new URL(appOrigin()).protocol==='https:',path:'/',maxAge:8*60*60};
}
