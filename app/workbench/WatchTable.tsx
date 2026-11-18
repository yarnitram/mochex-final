'use client';
import { quoteState,type Quote } from '../../src/core/quotes';
const price=(s:unknown)=>Number(s).toLocaleString('en-US',{maximumFractionDigits:8});
export const columnLabels={direction:'Direction',price:'Last price',change:'24h change',turnover:'24h turnover',trigger:'Trigger',levels:'Entry / Stop / Target',rr:'Risk : Reward',added:'Added'};
export function EventBadges({events,target,revision}:{events:any[],target:string,revision?:number}){
 const found=events.filter(e=>e.target_key===target&&(revision===undefined||e.revision===revision));
 return <>{found.map(e=><small className="core-crossing" key={e.id}>{e.kind==='trigger'?'Trigger crossed':e.kind==='stop'?'SL crossed':'TP crossed'} · {price(e.data.price)}</small>)}</>;
}
export default function WatchTable({rows,prefs,market,error,busy,onChart,onOpen,onEdit,onArchive}:{rows:any[],prefs:any,market:any,error:string,busy:boolean,onChart:(r:any)=>void,onOpen:(r:any)=>void,onEdit:(r:any)=>void,onArchive:(r:any)=>void}){
 const visible=(name:string)=>prefs.columns.includes(name),now=Date.now();
 return <table><thead><tr><th>Coin / Strategy</th>{Object.entries(columnLabels).filter(([k])=>visible(k)).map(([k,label])=><th key={k}>{label}</th>)}<th>Actions</th></tr></thead><tbody>{rows.map(row=>{
  const p=row.data,item=market.quotes[p.symbol],q:Quote|undefined=item?.quote;
  const state=error?'unavailable':item?.status==='unsupported'?'unsupported':quoteState(q,now),live=state==='live',rr=Math.abs((Number(p.target)-Number(p.entry))/(Number(p.entry)-Number(p.stop)));
  return <tr key={row.id}><td><strong>{p.symbol}</strong><small>{p.strategy||'No strategy label'}</small><p className="core-thesis">{p.notes}</p><EventBadges events={market.events} target={'watch:'+row.id} revision={row.revision}/></td>
   {visible('direction')&&<td><span className={'core-side '+p.side}>{p.side.toUpperCase()}</span></td>}
   {visible('price')&&<td data-testid={'quote-'+p.symbol}>{live?price(q!.price):'—'}<small className={live?'positive':'negative'}>{live?'Live · '+new Date(q!.time).toLocaleTimeString():state}</small></td>}
   {visible('change')&&<td className={live&&Number(q!.changePct)>=0?'positive':'negative'}>{live?(Number(q!.changePct)>=0?'+':'')+Number(q!.changePct).toFixed(2)+'%':'—'}</td>}
   {visible('turnover')&&<td>{live?Number(q!.turnover).toLocaleString('en-US',{notation:'compact',maximumFractionDigits:2}):'—'}<small>USDT</small></td>}
   {visible('trigger')&&<td>{p.trigger?price(p.trigger):'—'}<small>{p.trigger?(p.triggerDirection??(p.side==='long'?'above':'below'))==='above'?'At / above':'At / below':'No trigger'}</small>{p.trigger&&live&&<small>{(Math.abs(Number(q!.price)-Number(p.trigger))/Number(q!.price)*100).toFixed(2)}% away</small>}</td>}
   {visible('levels')&&<td className="core-levels"><span>EP <b>{price(p.entry)}</b></span><span>SL <b>{price(p.stop)}</b></span><span>TP <b>{price(p.target)}</b></span></td>}
   {visible('rr')&&<td>1 : {rr.toFixed(2)}</td>}{visible('added')&&<td>{new Date(row.created_at).toLocaleDateString()}</td>}
   <td><div className="core-row-actions"><button aria-label={'Chart '+p.symbol} onClick={()=>onChart(row)}>Chart ↗</button>{row.status==='active'&&<><button aria-label={'Record trade '+p.symbol} onClick={()=>onOpen(row)}>Record trade</button><button onClick={()=>onEdit(row)}>Edit</button></>}{row.status!=='opened'&&<button disabled={busy} onClick={()=>onArchive(row)}>{row.status==='archived'?'Restore':'Archive'}</button>}</div></td></tr>;
 })}</tbody></table>;
}
