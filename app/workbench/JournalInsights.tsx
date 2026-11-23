'use client';
import {useState} from 'react';
import {calendarDays,journalTimeline,type JournalRow} from '../../src/core/journal';

export default function JournalInsights({rows}:{rows:(JournalRow&{id:string})[]}){
 const days=calendarDays(rows),timeline=journalTimeline(rows),latest=days.at(-1)?.day.slice(0,7)??new Date().toISOString().slice(0,7);
 const [chosen,setChosen]=useState<string|null>(null),month=chosen??latest;
 const [year,m]=month.split('-').map(Number),first=new Date(Date.UTC(year!,m!-1,1)).getUTCDay(),length=new Date(Date.UTC(year!,m!,0)).getUTCDate();
 const byDay=new Map(days.map(d=>[d.day,d]));
 const shift=(amount:number)=>setChosen(new Date(Date.UTC(year!,m!-1+amount,1)).toISOString().slice(0,7));
 const numbers=timeline.map(t=>Number(t.equity)),low=Math.min(0,...numbers),high=Math.max(0,...numbers),span=high-low||1;
 const points=timeline.map((t,i)=>`${timeline.length===1?100:12+i*176/(timeline.length-1)},${108-(Number(t.equity)-low)*88/span}`).join(' ');
 return <div className="journal-insights"><section aria-label="Journal calendar"><header><h3>Closed trade calendar · UTC</h3><div><button type="button" aria-label="Previous journal month" onClick={()=>shift(-1)}>←</button><strong>{month}</strong><button type="button" aria-label="Next journal month" onClick={()=>shift(1)}>→</button></div></header><div className="journal-calendar" role="grid" aria-label={'Closed trades for '+month}>{['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d=><span key={d} className="weekday">{d}</span>)}{Array.from({length:first},(_,i)=><span key={'gap'+i}/>)}{Array.from({length},(_,i)=>{const date=month+'-'+String(i+1).padStart(2,'0'),day=byDay.get(date);return <div key={date} role="gridcell" aria-label={date+(day?' '+day.count+' closed, '+day.net+' USDT':' no closed trades')} className={day?(Number(day.net)>=0?'gain':'loss'):''}><b>{i+1}</b>{day&&<small>{Number(day.net)>=0?'+':''}{Number(day.net).toFixed(2)}</small>}</div>;})}</div></section><section aria-label="Journal equity"><header><h3>Recorded equity · closed trades</h3><small>Cumulative net P&amp;L, starting at zero</small></header>{timeline.length?<><svg viewBox="0 0 200 120" role="img" aria-label="Recorded closed trade equity curve" preserveAspectRatio="none"><line x1="0" y1={108-(0-low)*88/span} x2="200" y2={108-(0-low)*88/span} stroke="#354e61" strokeDasharray="3 3"/><polyline points={points} fill="none" stroke="#58d6af" strokeWidth="2" vectorEffect="non-scaling-stroke"/></svg><p>First {timeline[0]!.day} · latest {timeline.at(-1)!.day} · {Number(timeline.at(-1)!.equity).toFixed(2)} USDT</p></>:<p>No closed trades match these filters.</p>}</section></div>;
}
