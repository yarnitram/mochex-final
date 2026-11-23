import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import type {Pool} from 'pg';
import {withOwner} from '../server/store.js';
import {PersistenceError} from '../server/signal-contracts.js';

export const MAX_IMAGE_BYTES=1048576;
const kind=z.enum(['image/png','image/jpeg','image/webp']);
export function validImage(mime:string,bytes:Buffer):boolean{
 if(bytes.length<16||bytes.length>MAX_IMAGE_BYTES||!kind.safeParse(mime).success)return false;
 if(mime==='image/png')return bytes.subarray(0,8).equals(Buffer.from('89504e470d0a1a0a','hex'));
 if(mime==='image/jpeg')return bytes[0]===255&&bytes[1]===216&&bytes[2]===255&&bytes.at(-2)===255&&bytes.at(-1)===217;
 return bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP';
}
export async function addTradeImage(db:Pool,owner:string,tradeId:string,mime:string,bytes:Buffer):Promise<string>{
 z.uuid().parse(tradeId);
 if(!validImage(mime,bytes))throw new PersistenceError(422,'Invalid or oversized image');
 return withOwner(db,owner,async c=>{
  const trade=(await c.query('SELECT closed_at FROM core_trades WHERE id=$1 FOR UPDATE',[tradeId])).rows[0];
  if(!trade)throw new PersistenceError(404,'Trade not found');
  if(!trade.closed_at)throw new PersistenceError(409,'Screenshot requires a closed trade');
  const count=Number((await c.query('SELECT count(*) FROM core_trade_images WHERE trade_id=$1',[tradeId])).rows[0].count);
  if(count>=3)throw new PersistenceError(409,'Trade supports up to three screenshots');
  const id=randomUUID();await c.query('INSERT INTO core_trade_images(id,owner_id,trade_id,mime,bytes) VALUES($1,$2,$3,$4,$5)',[id,owner,tradeId,mime,bytes]);return id;
 });
}
export async function readTradeImage(db:Pool,owner:string,id:string):Promise<{mime:string,bytes:Buffer}>{
 z.uuid().parse(id);
 return withOwner(db,owner,async c=>{
  const row=(await c.query('SELECT mime,bytes FROM core_trade_images WHERE id=$1',[id])).rows[0];
  if(!row)throw new PersistenceError(404,'Image not found');
  return {mime:row.mime,bytes:row.bytes};
 });
}
export async function removeTradeImage(db:Pool,owner:string,id:string):Promise<void>{
 z.uuid().parse(id);
 await withOwner(db,owner,async c=>{
  if(!(await c.query('DELETE FROM core_trade_images WHERE id=$1 RETURNING id',[id])).rowCount)throw new PersistenceError(404,'Image not found');
 });
}
