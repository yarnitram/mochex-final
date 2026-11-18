import type { Pool,PoolClient } from 'pg';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { Money,decimal,fillSchema,instrumentKey,eventKey } from '../contracts.js';
import { replayLedger } from '../domain.js';
import { withOwner } from './store.js';
import { PersistenceError,scannerCredential,credentialHash,fingerprint,normalizedSignal,assertFresh } from './signal-contracts.js';

async function issueCredential(c:PoolClient,ownerId:string,sourceId:string){
 const credential=scannerCredential();
 await c.query("INSERT INTO terminal_source_credentials(id,owner_id,source_id,token_hash,expires_at) VALUES($1,$2,$3,$4,now()+interval '90 days')",[randomUUID(),ownerId,sourceId,credentialHash(credential)]);
 return credential;
}
async function lockedSource(c:PoolClient,id:string){
 z.uuid().parse(id);
 const result=await c.query('SELECT id,name,enabled,created_at FROM terminal_sources WHERE id=$1 FOR UPDATE',[id]);
 if(!result.rowCount)throw new PersistenceError(404,'Source not found');
 return result.rows[0];
}
export async function registerSource(db:Pool,ownerId:string,name:string){
 name=z.string().trim().min(1).max(100).parse(name);
 return withOwner(db,ownerId,async c=>{
  const id=randomUUID();
  await c.query('INSERT INTO terminal_sources(id,owner_id,name) VALUES($1,$2,$3)',[id,ownerId,name]);
  return {id,name,credential:await issueCredential(c,ownerId,id)};
 });
}
export function listSources(db:Pool,ownerId:string){
 return withOwner(db,ownerId,c=>c.query('SELECT id,name,enabled,created_at FROM terminal_sources ORDER BY created_at DESC LIMIT 200')).then(r=>r.rows);
}
export async function setSourceEnabled(db:Pool,ownerId:string,id:string,enabled:boolean){
 z.boolean().parse(enabled);
 await withOwner(db,ownerId,async c=>{
  await lockedSource(c,id);
  await c.query('UPDATE terminal_sources SET enabled=$2 WHERE id=$1',[id,enabled]);
 });
}
export async function rotateCredential(db:Pool,ownerId:string,id:string){
 return withOwner(db,ownerId,async c=>{
  await lockedSource(c,id);
  await c.query('UPDATE terminal_source_credentials SET revoked_at=now() WHERE source_id=$1 AND revoked_at IS NULL',[id]);
  return issueCredential(c,ownerId,id);
 });
}
export async function revokeCredentials(db:Pool,ownerId:string,id:string){
 await withOwner(db,ownerId,async c=>{
  await lockedSource(c,id);
  await c.query('UPDATE terminal_source_credentials SET revoked_at=now() WHERE source_id=$1 AND revoked_at IS NULL',[id]);
 });
}
export async function scannerTransaction<T>(db:Pool,credential:string,work:(c:PoolClient,source:{id:string,ownerId:string})=>Promise<T>):Promise<T>{
 const hash=credentialHash(credential),c=await db.connect();
 try{
  await c.query('BEGIN');
  await c.query("SELECT set_config('terminal.credential_hash',$1,true)",[hash]);
  const candidate=await c.query('SELECT owner_id,source_id FROM terminal_source_credentials WHERE token_hash=$1 AND revoked_at IS NULL AND expires_at>now()',[hash]);
  if(!candidate.rowCount)throw new PersistenceError(401,'Unauthorized scanner');
  const {owner_id:ownerId,source_id:id}=candidate.rows[0];
  await c.query("SELECT set_config('terminal.owner_id',$1,true)",[ownerId]);
  // Same lock order as revoke/rotate: source first, credential second.
  const source=await c.query('SELECT id FROM terminal_sources WHERE id=$1 AND enabled FOR SHARE',[id]);
  if(!source.rowCount)throw new PersistenceError(401,'Unauthorized scanner');
  const key=await c.query('SELECT id FROM terminal_source_credentials WHERE token_hash=$1 AND revoked_at IS NULL AND expires_at>now() FOR SHARE',[hash]);
  if(!key.rowCount)throw new PersistenceError(401,'Unauthorized scanner');
  const result=await work(c,{id,ownerId});await c.query('COMMIT');return result;
 }catch(error){await c.query('ROLLBACK');throw error;}finally{c.release();}
}
export async function registerInstrument(c:PoolClient,input:Parameters<typeof instrumentKey>[0]){
 const identity=instrumentKey(input),tuple=JSON.parse(identity);
 const payload={...(input as object),contractMultiplier:tuple[6]};
 await c.query('INSERT INTO terminal_instruments(id,identity,payload) VALUES($1,$2,$3) ON CONFLICT(identity) DO NOTHING',[randomUUID(),identity,payload]);
 return (await c.query('SELECT id FROM terminal_instruments WHERE identity=$1',[identity])).rows[0].id as string;
}
export type IngestResult={kind:'created'|'duplicate'|'conflict',signalId:string,setupId:string,outboxId:string};
export async function ingestSignal(db:Pool,credential:string,input:unknown,options:{now?:number,mode?:'shadow'|'dry-run'}={}):Promise<IngestResult>{
 credentialHash(credential);
 const event=normalizedSignal(input),digest=fingerprint(event);
 const mode=options.mode??'dry-run';
 if(!['shadow','dry-run'].includes(mode))throw new PersistenceError(400,'Invalid ingestion mode');
 return scannerTransaction(db,credential,async(c,source)=>{
  if(event.sourceId!==source.id)throw new PersistenceError(403,'Source identity does not match credential');
  await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[eventKey(source.id,event.sourceEventId)]);
  const existing=await c.query('SELECT s.id,s.fingerprint,u.id setup_id,o.id outbox_id FROM terminal_signals s JOIN terminal_setups u ON u.signal_id=s.id JOIN terminal_outbox o ON o.signal_id=s.id WHERE s.source_id=$1 AND s.source_event_id=$2',[source.id,event.sourceEventId]);
  if(existing.rowCount){
   const old=existing.rows[0];
   if(old.fingerprint!==digest){
    await c.query('INSERT INTO terminal_ingest_conflicts(id,owner_id,source_id,source_event_id,incoming_fingerprint,signal_id) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(source_id,source_event_id,incoming_fingerprint) DO NOTHING',[randomUUID(),source.ownerId,source.id,event.sourceEventId,digest,old.id]);
   }
   return {kind:old.fingerprint===digest?'duplicate':'conflict',signalId:old.id,setupId:old.setup_id,outboxId:old.outbox_id};
  }
  assertFresh(event,options.now??Date.now());
  const instrumentId=await registerInstrument(c,event.instrument),signalId=randomUUID(),setupId=randomUUID(),outboxId=randomUUID();
  await c.query('INSERT INTO terminal_signals(id,owner_id,source_id,source_event_id,instrument_id,payload,fingerprint) VALUES($1,$2,$3,$4,$5,$6,$7)',[signalId,source.ownerId,source.id,event.sourceEventId,instrumentId,event,digest]);
  await c.query('INSERT INTO terminal_setups(id,owner_id,source_id,signal_id,instrument_id) VALUES($1,$2,$3,$4,$5)',[setupId,source.ownerId,source.id,signalId,instrumentId]);
  await c.query('INSERT INTO terminal_outbox(id,owner_id,source_id,signal_id,status,payload,expires_at) VALUES($1,$2,$3,$4,$5,$6,$7)',[outboxId,source.ownerId,source.id,signalId,mode==='shadow'?'held':'queued',{sourceEventId:event.sourceEventId,eventKey:eventKey(source.id,event.sourceEventId)},event.expiresAt]);
  return {kind:'created',signalId,setupId,outboxId};
 });
}
export function listSignals(db:Pool,ownerId:string){
 return withOwner(db,ownerId,c=>c.query('SELECT s.id,s.source_id,s.payload,s.created_at,u.id setup_id,u.state FROM terminal_signals s LEFT JOIN terminal_setups initial ON initial.signal_id=s.id LEFT JOIN terminal_setup_observations h ON h.signal_id=s.id JOIN terminal_setups u ON u.id=coalesce(h.setup_id,initial.id) ORDER BY s.created_at DESC LIMIT 100')).then(r=>r.rows);
}
export async function getSetup(db:Pool,ownerId:string,id:string){
 z.uuid().parse(id);
 return withOwner(db,ownerId,async c=>{
  const result=await c.query('SELECT u.id,u.state,u.revision,u.geometry,u.configuration_version,u.last_observed_at,s.payload FROM terminal_setups u JOIN terminal_signals s ON s.id=u.signal_id WHERE u.id=$1 FOR SHARE OF u',[id]);
  if(!result.rowCount)throw new PersistenceError(404,'Setup not found');
  const history=await c.query('SELECT h.revision,h.state,h.observed_at,s.payload FROM terminal_setup_observations h JOIN terminal_signals s ON s.id=h.signal_id WHERE h.setup_id=$1 ORDER BY h.revision LIMIT 200',[id]);
  const reconciliation=await c.query('SELECT r.reason,r.revision,r.created_at FROM terminal_reconciliation_events r JOIN terminal_setup_bindings b ON b.source_id=r.source_id AND b.external_setup_id=r.external_setup_id AND b.configuration_version=r.configuration_version WHERE b.setup_id=$1 ORDER BY r.created_at DESC LIMIT 100',[id]);
  return {...result.rows[0],history:history.rows,reconciliation:reconciliation.rows};
 });
}
const tradeOptions=z.strictObject({side:z.enum(['long','short']),initialRisk:decimal.refine(v=>new Money(v).gt(0))});
export async function createPaperTrade(db:Pool,ownerId:string,setupId:string,input:z.infer<typeof tradeOptions>){
 z.uuid().parse(setupId);const options=tradeOptions.parse(input);
 return withOwner(db,ownerId,async c=>{
  const setup=await c.query('SELECT * FROM terminal_setups WHERE id=$1 FOR UPDATE',[setupId]);
  if(!setup.rowCount)throw new PersistenceError(404,'Setup not found');
  const old=await c.query('SELECT id,side,initial_risk FROM terminal_trades WHERE setup_id=$1',[setupId]);
  if(old.rowCount){
   if(old.rows[0].side!==options.side||!new Money(old.rows[0].initial_risk).eq(options.initialRisk))throw new PersistenceError(409,'Trade conflict');
   return {id:old.rows[0].id as string};
  }
  const row=setup.rows[0],id=randomUUID();
  await c.query('INSERT INTO terminal_trades(id,owner_id,source_id,setup_id,instrument_id,side,initial_risk) VALUES($1,$2,$3,$4,$5,$6,$7)',[id,ownerId,row.source_id,setupId,row.instrument_id,options.side,options.initialRisk]);
  return {id};
 });
}
export async function appendFill(db:Pool,ownerId:string,input:unknown){
 const fill=fillSchema.parse(input),digest=fingerprint(fill);
 if(fill.ownerId!==ownerId||fill.provenance==='exchange-confirmed')throw new PersistenceError(403,'Invalid fill owner or provenance');
 return withOwner(db,ownerId,async c=>{
  await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[eventKey('fill:'+fill.sourceId,fill.sourceFillId)]);
  const result=await c.query('SELECT t.*,i.identity FROM terminal_trades t JOIN terminal_instruments i ON i.id=t.instrument_id WHERE t.id=$1 FOR UPDATE OF t',[z.uuid().parse(fill.tradeId)]);
  if(!result.rowCount)throw new PersistenceError(404,'Trade not found');
  const trade=result.rows[0];
  if(trade.source_id!==fill.sourceId||trade.identity!==instrumentKey(fill.instrument))throw new PersistenceError(403,'Fill source/instrument mismatch');
  const old=await c.query('SELECT fingerprint,trade_id FROM terminal_fills WHERE source_id=$1 AND source_fill_id=$2',[fill.sourceId,fill.sourceFillId]);
  if(old.rowCount){
   if(old.rows[0].fingerprint!==digest||old.rows[0].trade_id!==fill.tradeId)throw new PersistenceError(409,'Fill identity conflict');
   return {duplicate:true,ledger:trade.ledger as ReturnType<typeof replayLedger>};
  }
  const rows=await c.query('SELECT payload FROM terminal_fills WHERE trade_id=$1',[fill.tradeId]);
  const ledger=replayLedger(trade.side,trade.initial_risk,[...rows.rows.map(r=>r.payload),fill]);
  await c.query('INSERT INTO terminal_fills(id,owner_id,source_id,source_fill_id,trade_id,payload,fingerprint) VALUES($1,$2,$3,$4,$5,$6,$7)',[randomUUID(),ownerId,fill.sourceId,fill.sourceFillId,fill.tradeId,fill,digest]);
  await c.query('UPDATE terminal_trades SET ledger=$2,status=$3 WHERE id=$1',[fill.tradeId,ledger,new Money(ledger.remainingQuantity).eq(0)?'closed':'open']);
  return {duplicate:false,ledger};
 });
}
