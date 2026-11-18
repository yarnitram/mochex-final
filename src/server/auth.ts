import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
function derive(password:string,salt:Buffer):Promise<Buffer>{
 return new Promise((resolve,reject)=>scrypt(password,salt,64,{N:32768,r:8,p:1,maxmem:64*1024*1024},(error,key)=>error?reject(error):resolve(key)));
}
export async function hashPassword(password:string):Promise<string>{
 if(password.length<12||password.length>128)throw new Error('Password must contain 12 to 128 characters');
 const salt=randomBytes(16),hash=await derive(password,salt);
 return 's1$'+salt.toString('base64url')+'$'+hash.toString('base64url');
}
export async function verifyPassword(password:string,encoded:string):Promise<boolean>{
 if(password.length>128)return false;
 const parts=encoded.split('$');
 if(parts.length!==3||parts[0]!=='s1'||!parts[1]||!parts[2]||
   !/^[A-Za-z0-9_-]{22}$/.test(parts[1])||!/^[A-Za-z0-9_-]{86}$/.test(parts[2]))return false;
 const actual=await derive(password,Buffer.from(parts[1],'base64url'));
 return timingSafeEqual(actual,Buffer.from(parts[2],'base64url'));
}
export function newSessionToken():string{return randomBytes(32).toString('base64url');}
export function hashToken(token:string):string{
 if(!/^[A-Za-z0-9_-]{43}$/.test(token))throw new Error('Malformed session token');
 return createHash('sha256').update(token).digest('hex');
}
export function validOrigin(origin:string|null,expected:string):boolean{
 try{return origin!==null&&new URL(origin).origin===expected&&origin===expected;}
 catch{return false;}
}
