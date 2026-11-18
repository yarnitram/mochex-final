import type { Pool,PoolClient } from 'pg';
import { randomUUID } from 'node:crypto';
import { instrumentKey } from '../contracts.js';
import { adaptMochbot,transitionDecision,type Observation } from '../adapters/mochbot.js';
import { scannerTransaction,registerInstrument } from './signals.js';
import { assertFresh,fingerprint,PersistenceError } from './signal-contracts.js';

type Result={kind:'created'|'applied'|'duplicate'|'rejected'|'ignored',reason?:string,status?:number,setupId?:string,signalId?:string,outboxId?:string};
async function reject(c:PoolClient,ownerId:string,event:Observation,reason:string,setupId?:string,status=409):Promise<Result>{
 await c.query('INSERT INTO terminal_reconciliation_events(id,owner_id,source_id,external_setup_id,configuration_version,revision,fingerprint,reason,payload) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT(source_id,external_setup_id,configuration_version,revision,fingerprint,reason) DO NOTHING',
  [randomUUID(),ownerId,event.sourceId,event.externalSetupId,event.configurationVersion,event.revision,fingerprint(event),reason,event]);
 return {kind:'rejected',reason,status,setupId};
}
export async function ingestMochbot(db:Pool,credential:string,input:unknown,options:{now?:number}={}):Promise<Result>{
 const adapted=adaptMochbot(input);
 return scannerTransaction(db,credential,async(c,source)=>{
  const claimed=adapted.kind==='ignored'?adapted.sourceId:adapted.event.sourceId;
  if(claimed!==source.id)throw new PersistenceError(403,'Source identity does not match credential');
  if(adapted.kind==='ignored')return {kind:'ignored',reason:adapted.reason};
  const e=adapted.event;
  const bindingKey=JSON.stringify(['mochbot',source.id,e.externalSetupId,e.configurationVersion]);
  await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[bindingKey]);
  const bound=await c.query('SELECT u.*,i.identity instrument_identity FROM terminal_setup_bindings b JOIN terminal_setups u ON u.id=b.setup_id JOIN terminal_instruments i ON i.id=u.instrument_id WHERE b.source_id=$1 AND b.external_setup_id=$2 AND b.configuration_version=$3 FOR UPDATE OF u',[source.id,e.externalSetupId,e.configurationVersion]);
  const current=bound.rows[0];
  const existing=await c.query('SELECT s.id,s.fingerprint,h.setup_id,o.id outbox_id FROM terminal_signals s JOIN terminal_setup_observations h ON h.signal_id=s.id JOIN terminal_outbox o ON o.signal_id=s.id WHERE s.source_id=$1 AND s.source_event_id=$2',[source.id,e.sourceEventId]);
  if(existing.rowCount){
   const old=existing.rows[0];
   if(old.fingerprint!==fingerprint(e))return reject(c,source.ownerId,e,'conflict',old.setup_id);
   return {kind:'duplicate',setupId:old.setup_id,signalId:old.id,outboxId:old.outbox_id};
  }
  const stored=current?{revision:current.revision,state:current.state,observedAt:current.last_observed_at.toISOString(),plan:current.geometry}:null;
  const decision=transitionDecision(stored,e);
  if(decision!=='apply')return reject(c,source.ownerId,e,decision,current?.id);
  try{assertFresh(e,options.now??Date.now());}
  catch(error){
   if(error instanceof PersistenceError)return reject(c,source.ownerId,e,error.message,current?.id,error.status);
   throw error;
  }
  if(current&&current.instrument_identity!==instrumentKey(e.instrument))return reject(c,source.ownerId,e,'instrument-change',current.id);
  const instrumentId=current?.instrument_id??await registerInstrument(c,e.instrument);
  const signalId=randomUUID(),setupId=current?.id??randomUUID(),outboxId=randomUUID();
  await c.query('INSERT INTO terminal_signals(id,owner_id,source_id,source_event_id,instrument_id,payload,fingerprint) VALUES($1,$2,$3,$4,$5,$6,$7)',[signalId,source.ownerId,source.id,e.sourceEventId,instrumentId,e,fingerprint(e)]);
  if(!current){
   await c.query('INSERT INTO terminal_setups(id,owner_id,source_id,signal_id,instrument_id,state,revision,geometry,configuration_version,last_observed_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',
    [setupId,source.ownerId,source.id,signalId,instrumentId,e.proposedState,e.revision,e.plan,e.configurationVersion,e.observedAt]);
   await c.query('INSERT INTO terminal_setup_bindings(source_id,owner_id,external_setup_id,configuration_version,setup_id) VALUES($1,$2,$3,$4,$5)',[source.id,source.ownerId,e.externalSetupId,e.configurationVersion,setupId]);
  }else{
   await c.query('UPDATE terminal_setups SET state=$2,revision=$3,last_observed_at=$4,updated_at=now() WHERE id=$1',[setupId,e.proposedState,e.revision,e.observedAt]);
  }
  await c.query("INSERT INTO terminal_outbox(id,owner_id,source_id,signal_id,status,payload,expires_at) VALUES($1,$2,$3,$4,'held',$5,$6)",
   [outboxId,source.ownerId,source.id,signalId,{sourceEventId:e.sourceEventId,setupId,revision:e.revision,proposedState:e.proposedState},e.expiresAt]);
  await c.query('INSERT INTO terminal_setup_observations(id,owner_id,source_id,setup_id,signal_id,revision,state,observed_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',
   [randomUUID(),source.ownerId,source.id,setupId,signalId,e.revision,e.proposedState,e.observedAt]);
  return {kind:current?'applied':'created',setupId,signalId,outboxId};
 });
}
