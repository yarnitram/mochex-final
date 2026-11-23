import type {Pool,PoolClient} from 'pg';
import {withOwner} from '../server/store.js';
import {PersistenceError} from '../server/signal-contracts.js';
import {positionSummary} from './domain.js';
import {exportJournalCsv,parseExmochexCsv,reconcileJournalRows,type ImportTrade} from './journal-import.js';

async function closedTrades(c:PoolClient,lock=false):Promise<ImportTrade[]>{
 const sql="SELECT t.id,t.data,t.review,t.tags,t.closed_at,coalesce((SELECT jsonb_agg(e.data ORDER BY e.created_at,e.id) FROM core_exits e WHERE e.trade_id=t.id),'[]'::jsonb) exits FROM core_trades t WHERE t.closed_at IS NOT NULL ORDER BY t.closed_at,t.id LIMIT 5001"+(lock?' FOR UPDATE OF t':'');
 const rows=(await c.query(sql)).rows;
 if(rows.length>5000)throw new PersistenceError(413,'Journal transfer exceeds 5000 closed trades');
 return rows.map(t=>({...t,closed_at:new Date(t.closed_at).toISOString(),summary:positionSummary(t.data,t.exits)}));
}
export async function exportJournal(db:Pool,owner:string){return withOwner(db,owner,async c=>exportJournalCsv(await closedTrades(c)));}
export async function importJournal(db:Pool,owner:string,csv:string,apply:boolean){
 let rows;try{rows=parseExmochexCsv(csv);}catch(e){throw new PersistenceError(400,e instanceof Error?e.message:'Invalid CSV');}
 return withOwner(db,owner,async c=>{
  const matches=reconcileJournalRows(rows,await closedTrades(c,apply));let applied=0;const appliedIds=new Set<string>();
  if(apply)for(const item of matches){if(item.status!=='ready')continue;
   const result=await c.query("UPDATE core_trades SET review=$2,tags=$3 WHERE id=$1 AND review='' AND cardinality(tags)=0 RETURNING id",[item.tradeId,item.row.notes,item.row.tags]);
   if(result.rowCount){applied++;appliedIds.add(item.tradeId!);}
  }
  return {rows:matches.map(m=>({status:appliedIds.has(m.tradeId??'')?'applied':m.status,symbol:m.row.symbol,date:m.row.date,tradeId:m.tradeId??null})),applied};
 });
}
