import { readFileSync } from 'node:fs';
const original=JSON.parse(readFileSync(new URL('./mochbot-mod01e.json',import.meta.url),'utf8'));
const fixtureClock=Date.now();
export function observation(sourceId=original.sourceId,revision=0,state='armed',now=fixtureClock){
 const value=structuredClone(original),ts=Math.floor(now/60000)*60;
 const confirmed=Math.floor(ts/900)*900;
 value.sourceId=sourceId;value.revision=revision;value.capturedAt=new Date(ts*1000+1000).toISOString();
 value.snapshot.ts=ts;value.snapshot.setupId='BTC_USDT:01E:LONG:'+(confirmed-900);
 value.snapshot.limitContext.confirmedAt=confirmed;value.snapshot.expiresAt=confirmed+5400;
 if(state==='entry-ready'){value.snapshot.stage='ENTRY_READY';value.snapshot.orderStatus='TOUCHED';delete value.snapshot.expiresAt;}
 if(state==='expired'||state==='invalidated'){
  value.snapshot.stage='IDLE';value.snapshot.orderStatus=state==='expired'?'EXPIRED':'INVALIDATED';
  value.snapshot.direction=null;value.snapshot.entry=null;value.snapshot.sl=null;value.snapshot.tp1=null;value.snapshot.tp2=null;value.snapshot.orderType=null;
  if(state==='expired'){value.snapshot.ts=confirmed+5400;value.capturedAt=new Date(value.snapshot.ts*1000+1000).toISOString();}
 }
 return value;
}
