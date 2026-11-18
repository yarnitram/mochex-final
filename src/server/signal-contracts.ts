import { createHash,randomBytes } from 'node:crypto';
import { z } from 'zod';
import { instrumentKey,signalSchema } from '../contracts.js';
export class PersistenceError extends Error{
 constructor(public status:number,message:string){super(message);}
}
export function scannerCredential(){return 'mts_'+randomBytes(32).toString('base64url');}
export function credentialHash(value:string){
 if(!/^mts_[A-Za-z0-9_-]{43}$/.test(value))throw new PersistenceError(401,'Unauthorized scanner');
 return createHash('sha256').update(value).digest('hex');
}
export function stableJson(value:unknown):string{
 if(Array.isArray(value))return '['+value.map(stableJson).join(',')+']';
 if(value!==null&&typeof value==='object')return '{'+Object.entries(value).sort(([a],[b])=>a<b?-1:a>b?1:0).map(([k,v])=>JSON.stringify(k)+':'+stableJson(v)).join(',')+'}';
 return JSON.stringify(value);
}
export function fingerprint(value:unknown){return createHash('sha256').update(stableJson(value)).digest('hex');}
export function normalizedSignal(input:unknown){
 const event=signalSchema.parse(input);
 const tuple=JSON.parse(instrumentKey(event.instrument));
 event.instrument.contractMultiplier=tuple[6];
 return event;
}
export function assertFresh(event:Pick<z.infer<typeof signalSchema>,'emittedAt'|'observedAt'|'expiresAt'|'maxAgeSeconds'>,now:number){
 if(Date.parse(event.emittedAt)>now+5000||Date.parse(event.observedAt)>now+5000)throw new PersistenceError(422,'Future observation');
 if(Date.parse(event.expiresAt)<=now)throw new PersistenceError(422,'Expired signal');
 if(now-Date.parse(event.observedAt)>event.maxAgeSeconds*1000)throw new PersistenceError(422,'Stale signal');
}
