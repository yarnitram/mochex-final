import type { Pool } from 'pg';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const migrations=['001_workspace.sql','002_signals.sql','003_observations.sql','004_core_workspace.sql','005_core_market.sql','006_chart_layout.sql'];
export async function migrate(pool:Pool,throughVersion=migrations.length):Promise<void>{
 if(!Number.isInteger(throughVersion)||throughVersion<1||throughVersion>migrations.length)throw Error('Unknown migration target');
 const client=await pool.connect();
 try{
  await client.query('BEGIN');
  await client.query('SELECT pg_advisory_xact_lock(842197001)');
  await client.query('CREATE TABLE IF NOT EXISTS terminal_migrations(version integer PRIMARY KEY, digest text NOT NULL)');
  for(let i=0;i<throughVersion;i++){
   const sql=await readFile(new URL('../../db/'+migrations[i],import.meta.url),'utf8');
   const digest=createHash('sha256').update(sql).digest('hex'),version=i+1;
   const existing=await client.query('SELECT digest FROM terminal_migrations WHERE version=$1',[version]);
   if(existing.rowCount){
    if(existing.rows[0].digest!==digest)throw new Error('Applied migration checksum differs: '+version);
   }else{
    await client.query(sql);
    await client.query('INSERT INTO terminal_migrations VALUES($1,$2)',[version,digest]);
   }
  }
  await client.query('COMMIT');
 }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
}
