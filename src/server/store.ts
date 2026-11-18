import { Pool, type PoolClient } from 'pg';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { hashPassword, verifyPassword, hashToken, newSessionToken } from './auth.js';
let pool:Pool|undefined;
export function database():Pool{
 if(!process.env.DATABASE_URL)throw new Error('DATABASE_URL is required');
 return pool??=new Pool({connectionString:process.env.DATABASE_URL,max:8});
}
export type Viewer={id:string,email:string};
export async function provisionUser(admin:Pool,email:string,password:string):Promise<Viewer>{
 const normalized=z.email().parse(email.trim().toLowerCase());
 const id=randomUUID(),digest=await hashPassword(password);
 await admin.query('INSERT INTO terminal_users(id,email,password_digest) VALUES($1,$2,$3)',[id,normalized,digest]);
 return {id,email:normalized};
}
export async function login(db:Pool,email:string,password:string,previous?:string):Promise<string|null>{
 email=email.trim().toLowerCase();
 if(!z.email().max(254).safeParse(email).success||password.length>128)return null;
 const limit=await db.query(`INSERT INTO terminal_login_limits(email,failures,window_start) VALUES($1,1,now())
 ON CONFLICT(email) DO UPDATE SET
 failures=CASE WHEN terminal_login_limits.window_start<now()-interval '15 minutes' THEN 1 ELSE terminal_login_limits.failures+1 END,
 window_start=CASE WHEN terminal_login_limits.window_start<now()-interval '15 minutes' THEN now() ELSE terminal_login_limits.window_start END RETURNING failures`,[email]);
 if(limit.rows[0].failures>5)return null;
 const users=await db.query('SELECT id,email,password_digest FROM terminal_users WHERE email=$1',[email]);
 const user=users.rows[0];
 const dummy='s1$'+Buffer.alloc(16).toString('base64url')+'$'+Buffer.alloc(64).toString('base64url');
 const valid=await verifyPassword(password,user?.password_digest??dummy);
 if(!valid||!user)return null;
 const token=newSessionToken(),client=await db.connect();
 try{
  await client.query('BEGIN');
  if(previous&&/^[A-Za-z0-9_-]{43}$/.test(previous))await client.query('DELETE FROM terminal_sessions WHERE token_hash=$1',[hashToken(previous)]);
  await client.query("INSERT INTO terminal_sessions(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval '8 hours')",[hashToken(token),user.id]);
  await client.query('DELETE FROM terminal_login_limits WHERE email=$1',[email]);
  await client.query('COMMIT');
 }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
 return token;
}
export async function viewerForToken(db:Pool,token:string|undefined):Promise<Viewer|null>{
 if(!token||!/^[A-Za-z0-9_-]{43}$/.test(token))return null;
 const rows=await db.query('SELECT u.id,u.email FROM terminal_sessions s JOIN terminal_users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>now()',[hashToken(token)]);
 return rows.rows[0]??null;
}
export async function logout(db:Pool,token:string|undefined):Promise<void>{
 if(token&&/^[A-Za-z0-9_-]{43}$/.test(token))await db.query('DELETE FROM terminal_sessions WHERE token_hash=$1',[hashToken(token)]);
}
export async function withOwner<T>(db:Pool,ownerId:string,work:(client:PoolClient)=>Promise<T>):Promise<T>{
 z.uuid().parse(ownerId);
 const client=await db.connect();
 try{
  await client.query('BEGIN');
  await client.query("SELECT set_config('terminal.owner_id',$1,true)",[ownerId]);
  const result=await work(client);await client.query('COMMIT');return result;
 }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
}
