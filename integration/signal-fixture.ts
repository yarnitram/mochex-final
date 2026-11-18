import { readFileSync } from 'node:fs';
const base=JSON.parse(readFileSync(new URL('../fixtures/contracts-v1.json',import.meta.url),'utf8'));
export function signal(sourceId:string,eventId:string,now=Date.now()){
 const start=Math.floor((now-60000)/60000)*60000;
 return {...base.signal,sourceId,sourceEventId:eventId,
  candleOpenTime:new Date(start).toISOString(),observedAt:new Date(now-1000).toISOString(),
  emittedAt:new Date(now).toISOString(),expiresAt:new Date(now+900000).toISOString()};
}
export const instrument=base.instrument;
