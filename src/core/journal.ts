import {z} from 'zod';
import {Money} from '../contracts.js';

const tag=z.string().trim().toLowerCase().regex(/^[a-z0-9][a-z0-9-]{1,23}$/,'Use 2–24 lowercase letters, numbers or hyphens');
export const reviewSchema=z.strictObject({review:z.string().max(4000),tags:z.array(tag).max(8).refine(a=>new Set(a).size===a.length,'Duplicate tags').optional()});
export function parseReview(raw:unknown){return reviewSchema.parse(raw);}

export type JournalRow={closed_at:string|null,review:string,tags:string[],data:{symbol:string,strategy:string,notes:string},summary:{net:string,rMultiple:string}};
export type JournalFilter={query:string,tag:string,outcome:'all'|'win'|'loss'|'breakeven'};
export function filterJournal<T extends JournalRow>(rows:T[],filter:JournalFilter):T[]{
 const q=filter.query.trim().toLowerCase();
 return rows.filter(r=>r.closed_at&&(
  !q||[r.data.symbol,r.data.strategy,r.data.notes,r.review,...r.tags].join(' ').toLowerCase().includes(q)
 )&&(filter.tag==='all'||r.tags.includes(filter.tag))&&(
  filter.outcome==='all'||(filter.outcome==='win'?new Money(r.summary.net).gt(0):filter.outcome==='loss'?new Money(r.summary.net).lt(0):new Money(r.summary.net).eq(0))
 ));
}
export function journalSummary(rows:JournalRow[]){
 const net=rows.reduce((v,r)=>v.plus(r.summary.net),new Money(0));
 const rSum=rows.reduce((v,r)=>v.plus(r.summary.rMultiple),new Money(0));
 const wins=rows.filter(r=>new Money(r.summary.net).gt(0)).length;
 return {count:rows.length,wins,net:net.toFixed(),averageR:rows.length?rSum.div(rows.length).toDecimalPlaces(2).toFixed():'0',winRate:rows.length?Math.round(wins/rows.length*100):0};
}
export function journalTimeline<T extends JournalRow&{id:string}>(rows:T[]){
 let balance=new Money(0);
 return rows.filter(r=>r.closed_at).sort((a,b)=>a.closed_at!.localeCompare(b.closed_at!)||a.id.localeCompare(b.id)).map(r=>{
  balance=balance.plus(r.summary.net);
  return {id:r.id,day:r.closed_at!.slice(0,10),net:r.summary.net,equity:balance.toFixed()};
 });
}
export function calendarDays<T extends JournalRow&{id:string}>(rows:T[]){
 const days=new Map<string,{day:string,net:InstanceType<typeof Money>,count:number}>();
 for(const item of journalTimeline(rows)){
  const prior=days.get(item.day)??{day:item.day,net:new Money(0),count:0};
  prior.net=prior.net.plus(item.net);prior.count++;days.set(item.day,prior);
 }
 return [...days.values()].map(x=>({day:x.day,net:x.net.toFixed(),count:x.count}));
}
