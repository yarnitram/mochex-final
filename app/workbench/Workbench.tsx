'use client';
import { useState } from 'react';
import CoreChart from './CoreChart';
import SymbolPicker from './SymbolPicker';
import WatchTable,{columnLabels,EventBadges} from './WatchTable';
import MarketStatus from './MarketStatus';
import { useMarketMonitor } from './useMarketMonitor';
import { defaultPreferences,quoteState } from '../../src/core/quotes';
import { planSchema,normalizeSymbol } from '../../src/core/domain';
import './core.css';
type View='watchlist'|'trades'|'journal'|'charts';
const labels={watchlist:'Watchlist',trades:'Trades',journal:'Journal',charts:'Charts'};
const emptyPlan={symbol:'BTC_USDT',side:'long',entry:'',stop:'',target:'',trigger:'',triggerDirection:'above',timeframe:'15m',strategy:'',notes:''};
const money=(s:unknown)=>Number(s??0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
const price=(s:unknown)=>Number(s??0).toLocaleString('en-US',{maximumFractionDigits:8});
export default function Workbench({initial,account}:{initial:any,account:{id:string,email:string}}){
 const [data,setData]=useState(initial),[view,setView]=useState<View>('watchlist'),[filter,setFilter]=useState(''),[status,setStatus]=useState('active');
 const [selected,setSelected]=useState<{symbol:string,timeframe:string,levels?:{entry:string,stop:string,target:string}}>({symbol:'BTC_USDT',timeframe:'15m'});
 const [symbolDraft,setSymbolDraft]=useState('BTC_USDT');
 const [chartDirty,setChartDirty]=useState(false);
 const {market,error:marketError,busy:marketBusy,refresh:refreshMarket}=useMarketMonitor([selected.symbol]);
 const prefs=data.preferences??defaultPreferences;
 async function savePrefs(next:any){const previous=prefs;setData((old:any)=>({...old,preferences:next}));setBusy(true);try{await mutate('preferences',next);}catch(e){setData((old:any)=>({...old,preferences:previous}));setError(e instanceof Error?e.message:'Unable to save columns');}finally{setBusy(false);}}
 const [modal,setModal]=useState<any>(null),[form,setForm]=useState<any>({}),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const openTrades=data.trades.filter((t:any)=>!t.closed_at),closed=data.trades.filter((t:any)=>t.closed_at);
 const realized=data.trades.reduce((a:number,t:any)=>a+Number(t.summary.net),0),wins=closed.filter((t:any)=>Number(t.summary.net)>0).length;
 function changeView(v:View){if(view==='charts'&&v!=='charts'&&chartDirty&&!window.confirm('Discard unsaved chart changes?'))return;setChartDirty(false);setView(v);setFilter('');setError('');}
 function chartFor(row:any){const p=row.data;setSymbolDraft(p.symbol);setSelected({symbol:p.symbol,timeframe:p.timeframe,levels:{entry:p.entry,stop:p.stop,target:p.target}});changeView('charts');}
 function show(kind:string,row?:any){
  setError('');setNotice('');setModal({kind,row,requestId:crypto.randomUUID()});
  setForm(kind==='setup'||kind==='manual'?{...emptyPlan,...(kind==='manual'&&view==='charts'?{symbol:selected.symbol,timeframe:selected.timeframe}:{}),...(row?.data??{}),triggerDirection:row?.data?.triggerDirection??(row?.data?.side==='short'?'below':'above'),margin:'100',leverage:'1',entryFee:'0'}:
   kind==='open'?{margin:'100',leverage:'1',entryFee:'0'}:
   kind==='exit'?{quantity:row.summary.remaining,price:'',fee:'0',note:''}:{review:row?.review??''});
 }
 async function mutate(action:string,body:unknown,id?:string){
  const response=await fetch('/api/core/workspace',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action,id,data:body})});
  const result=await response.json();if(!response.ok)throw Error(result.error??'Unable to save');
  const refresh=await fetch('/api/core/workspace',{cache:'no-store'});if(!refresh.ok)throw Error('Saved, but refresh failed. Reload to see your records.');
  setData(await refresh.json());return result;
 }
 async function submit(e:React.FormEvent){
  e.preventDefault();setBusy(true);setError('');
  try{
   const {kind,row,requestId}=modal;
   if(kind==='setup'||kind==='manual'){
    const {margin,leverage,entryFee,...p}=form;if(!p.trigger)delete p.trigger;
    const checked=planSchema.safeParse(p);if(!checked.success)throw Error(checked.error.issues.map(i=>i.message).join('; '));
    if(kind==='manual'){await mutate('trade-create',{...p,margin,leverage,entryFee,requestId});changeView('trades');}
    else if(row)await mutate('watch-change',{action:'edit',revision:row.revision,plan:p},row.id);
    else await mutate('watch-create',{...p,requestId});
   }else if(kind==='open'){await mutate('watch-open',{...form,requestId},row.id);changeView('trades');}
   else if(kind==='exit'){await mutate('trade-exit',{...form,requestId},row.id);}
   else await mutate('trade-review',form,row.id);
   setModal(null);setNotice('Saved to your workspace.');
  }catch(e){setError(e instanceof Error?e.message:'Unable to save');}finally{setBusy(false);}
 }
 async function archive(row:any){
  setBusy(true);try{await mutate('watch-change',{action:row.status==='archived'?'restore':'archive',revision:row.revision},row.id);setNotice('Watchlist updated.');}
  catch(e){setError(e instanceof Error?e.message:'Unable to update');}finally{setBusy(false);}
 }
 const matches=(row:any)=>[row.data.symbol,row.data.strategy,row.data.notes].join(' ').toLowerCase().includes(filter.toLowerCase());
 const quoteValue=(row:any)=>{const item=market.quotes[row.data.symbol];return !marketError&&item?.status!=='unsupported'&&quoteState(item?.quote,Date.now())==='live'?item.quote:null;};
 const watch=data.watchlist.filter((w:any)=>w.status===status&&matches(w)).sort((a:any,b:any)=>{
  const qa=quoteValue(a),qb=quoteValue(b),field=prefs.sort;
  if(field==='symbol')return a.data.symbol.localeCompare(b.data.symbol)*(prefs.descending?-1:1);
  if(!qa||!qb)return qa?-1:qb?1:a.data.symbol.localeCompare(b.data.symbol);
  const key=field==='change'?'changePct':field;
  return (Number(qa[key])-Number(qb[key]))*(prefs.descending?-1:1)||a.data.symbol.localeCompare(b.data.symbol);
 }),trades=(view==='journal'?closed:openTrades).filter(matches);
 const input=(key:string,label:string,type='text')=><label className={key==='notes'||key==='review'?'wide':''} key={key}>{label}{key==='notes'||key==='review'?<textarea aria-label={label} value={form[key]??''} onChange={e=>setForm({...form,[key]:e.target.value})} maxLength={4000}/>:<input aria-label={label} type={type} value={form[key]??''} onChange={e=>setForm({...form,[key]:e.target.value})} required={!['strategy','trigger','note'].includes(key)} maxLength={key==='symbol'?40:100} inputMode={['entry','stop','target','trigger','margin','leverage','quantity','price','fee','entryFee'].includes(key)?'decimal':undefined}/>}</label>;
 return <div className="core-shell">
  <aside className="core-sidebar"><a className="core-brand" href="/workbench">m<span>◈</span>chex<small>TERMINAL</small></a><p className="core-nav-caption">YOUR WORKSPACE</p><nav aria-label="Trading workspace">{(Object.keys(labels) as View[]).map((v,i)=><button key={v} onClick={()=>changeView(v)} aria-current={view===v?'page':undefined}><span>{['◉','⇄','▤','▥'][i]}</span>{labels[v]}<small>{v==='watchlist'?data.watchlist.filter((w:any)=>w.status==='active').length:v==='trades'?openTrades.length:v==='journal'?closed.length:''}</small></button>)}</nav><div className="core-sidebar-foot"><span className="core-mode">MANUAL TRACKING</span><p>Plan. Record. Learn.</p><small>Recorded trades do not place exchange orders.</small></div></aside>
  <div className="core-main"><header className="core-top"><span>Workspace <b>/</b> {labels[view]}</span><div><span>{account.email}</span><form action="/api/auth/logout" method="post"><button>Sign out</button></form></div></header>
  <main><div className="core-page-heading"><div><p className="core-eyebrow">MOCHEX WORKSPACE</p><h1>{view==='watchlist'?'Build your next trade.':view==='trades'?'Manage your recorded trades.':view==='journal'?'Turn each trade into insight.':'Your market, in focus.'}</h1><p>{view==='watchlist'?'Keep your thesis, trigger and risk levels together.':view==='trades'?'Track entries, remaining size and realized results.':view==='journal'?'Review closed trades, execution history and lessons.':'Mochex charting baseline · matching MEXC perpetual data.'}</p></div><button className="core-primary" onClick={()=>show(view==='watchlist'?'setup':'manual')}>{view==='watchlist'?'+ Add setup':'+ Record trade'}</button></div>
  <div className="core-stats"><article><span>Watching</span><strong>{data.watchlist.filter((w:any)=>w.status==='active').length}</strong><small>Planned setups</small></article><article><span>Open trades</span><strong>{openTrades.length}</strong><small>Manually recorded positions</small></article><article><span>Net recorded P&amp;L</span><strong className={realized>=0?'positive':'negative'}>{realized>=0?'+':''}{money(realized)} <em>USDT</em></strong><small>Realized exits less recorded fees</small></article><article><span>Closed win rate</span><strong>{closed.length?Math.round(wins/closed.length*100)+'%':'—'}</strong><small>{closed.length} closed trade{closed.length===1?'':'s'}</small></article></div>
  <MarketStatus market={market} error={marketError} busy={marketBusy} onRefresh={()=>void refreshMarket()}/>
  {!modal&&error&&<p className="core-error" role="alert">{error}</p>}{notice&&<p className="core-notice" role="status">{notice}</p>}
  {view==='charts'?<div className="core-chart-layout"><form className="core-chart-selector" onSubmit={e=>{e.preventDefault();try{const symbol=normalizeSymbol(symbolDraft);if(chartDirty&&!window.confirm('Discard unsaved chart changes and switch symbol?'))return;setChartDirty(false);setSelected({...selected,symbol,levels:undefined});setSymbolDraft(symbol);setError('');}catch(e){setError(e instanceof Error?e.message:'Invalid symbol');}}}><label>Symbol<input aria-label="Chart symbol" value={symbolDraft} onChange={e=>setSymbolDraft(e.target.value.toUpperCase())}/><button className="core-load">Load chart</button></label><span>MEXC USDT perpetual · refreshes every 15 seconds</span></form><CoreChart onDirty={setChartDirty} symbol={selected.symbol} timeframe={selected.timeframe} levels={selected.levels} onTimeframe={timeframe=>setSelected({...selected,timeframe})}/></div>:
  <section className="core-panel"><div className="core-panel-tools"><div className="core-tabs">{view==='watchlist'?['active','opened','archived'].map(s=><button key={s} className={s===status?'chosen':''} onClick={()=>setStatus(s)}>{s==='active'?'Watching':s==='opened'?'Opened':'Archived'}</button>):<h2>{view==='trades'?'Active trades':'Trade journal'} <small>{trades.length}</small></h2>}</div><input className="core-search" aria-label="Search records" placeholder="Search symbol, strategy or thesis…" value={filter} onChange={e=>setFilter(e.target.value)}/></div>
  {view==='watchlist'&&<div className="core-watch-options"><label>Sort<select aria-label="Sort watchlist" disabled={busy} value={prefs.sort+(prefs.descending?':desc':':asc')} onChange={e=>{const [sort,dir]=e.target.value.split(':');void savePrefs({...prefs,sort,descending:dir==='desc'});}}>{[['symbol','Symbol'],['price','Last price'],['change','24h change'],['turnover','24h turnover']].flatMap(([key,label])=>['asc','desc'].map(dir=><option key={key+dir} value={key+':'+dir}>{label} · {dir==='asc'?'low to high':'high to low'}</option>))}</select></label><details><summary>Columns</summary><div>{Object.entries(columnLabels).map(([key,label])=><label key={key}><input type="checkbox" disabled={busy} checked={prefs.columns.includes(key)} onChange={e=>void savePrefs({...prefs,columns:e.target.checked?[...prefs.columns,key]:prefs.columns.filter((x:string)=>x!==key)})}/>{label}</label>)}</div></details></div>}
  <div className="core-table-scroll">{view==='watchlist'?<WatchTable rows={watch} prefs={prefs} market={market} error={marketError} busy={busy} onChart={chartFor} onOpen={row=>show('open',row)} onEdit={row=>show('setup',row)} onArchive={row=>void archive(row)}/>:
  <table><thead><tr><th>Coin / Strategy</th><th>Direction</th><th>Entry / Remaining</th><th>Recorded P&amp;L</th><th>R</th><th>{view==='journal'?'Closed':'Opened'}</th><th>Actions</th></tr></thead><tbody>{trades.map((row:any)=><tr key={row.id}><td><strong>{row.data.symbol}</strong><small>{row.data.strategy||'Manual trade'}</small><p className="core-thesis">{row.data.notes}</p></td><td><span className={'core-side '+row.data.side}>{row.data.side.toUpperCase()}</span></td><td>{price(row.data.entry)}<small>{price(row.summary.remaining)} / {price(row.data.quantity)} base units</small><small>Margin {money(row.data.margin)} · {row.data.leverage}×</small><EventBadges events={market.events} target={'trade:'+row.id}/></td><td className={Number(row.summary.net)>=0?'positive':'negative'}>{Number(row.summary.net)>=0?'+':''}{money(row.summary.net)}<small>Fees {money(row.summary.fees)}</small></td><td>{Number(row.summary.rMultiple).toFixed(2)}R</td><td>{new Date(row.closed_at??row.created_at).toLocaleDateString()}</td><td><div className="core-row-actions"><button onClick={()=>chartFor(row)}>Chart ↗</button>{view==='trades'?<button aria-label={'Record exit '+row.data.symbol} onClick={()=>show('exit',row)}>Record exit</button>:<button aria-label={'Review '+row.data.symbol} onClick={()=>show('review',row)}>Review &amp; history</button>}</div></td></tr>)}</tbody></table>}</div>
  {(view==='watchlist'?watch.length:trades.length)===0&&<div className="core-empty"><span>{view==='journal'?'▤':'⌁'}</span><h3>{view==='watchlist'?'A clear plan starts here.':view==='trades'?'No open trades to track.':'Your next lesson starts with a trade.'}</h3><p>{view==='watchlist'?'Add your first setup with entry, stop, target and a thesis.':view==='trades'?'Record a trade manually, or open one from your watchlist.':'Closed trades and your reviews will appear here.'}</p><button onClick={()=>show(view==='watchlist'?'setup':'manual')}>{view==='watchlist'?'Add setup':'Record a trade'} ↗</button></div>}
  </section>}
  <footer className="core-footer"><span>EXMOCHEX workflow · Mochex Charts engine</span><span>Private records · MEXC perpetuals · Manual tracking</span></footer></main></div>
  {modal&&<div className="core-modal-backdrop"><section className="core-modal" role="dialog" aria-modal="true" aria-labelledby="core-dialog-title"><header><div><p className="core-eyebrow">{modal.row?.data.symbol??'YOUR WORKSPACE'}</p><h2 id="core-dialog-title">{modal.kind==='setup'?(modal.row?'Edit setup':'Add setup'):modal.kind==='manual'?'Record a trade':modal.kind==='open'?'Record trade from setup':modal.kind==='exit'?'Record an exit':'Trade review & history'}</h2></div><button type="button" aria-label="Close dialog" disabled={busy} onClick={()=>{setModal(null);setError('');}}>×</button></header>
  <form onSubmit={submit}><div className="core-form-grid">
  {(modal.kind==='setup'||modal.kind==='manual')&&<><SymbolPicker value={form.symbol} onChange={symbol=>setForm({...form,symbol})}/><label>Direction<select aria-label="Direction" value={form.side} onChange={e=>setForm({...form,side:e.target.value})}><option value="long">Long</option><option value="short">Short</option></select></label>{input('entry','Entry price')}{input('stop','Stop loss')}{input('target','Take profit')}{input('trigger','Trigger price (optional)')}<label>Trigger direction<select aria-label="Trigger direction" value={form.triggerDirection??(form.side==='short'?'below':'above')} onChange={e=>setForm({...form,triggerDirection:e.target.value})}><option value="above">At or above</option><option value="below">At or below</option></select></label><label>Timeframe<select aria-label="Timeframe" value={form.timeframe} onChange={e=>setForm({...form,timeframe:e.target.value})}>{['1m','5m','15m','1h','4h','1d'].map(t=><option key={t}>{t}</option>)}</select></label>{input('strategy','Strategy (optional)')}{input('notes','Trade thesis')}</>}
  {(modal.kind==='open'||modal.kind==='manual')&&<>{input('margin','Margin (USDT)')}{input('leverage','Leverage')}{input('entryFee','Entry fee (USDT)')}<p className="core-form-note wide">Records an entry in your tracker. It does not place an exchange order.</p></>}
  {modal.kind==='exit'&&<>{input('quantity','Exit quantity (base units)')}{input('price','Exit price')}{input('fee','Exit fee (USDT)')}{input('note','Exit note')}<p className="core-form-note wide">Remaining: {modal.row.summary.remaining} base units. A partial exit keeps the rest open.</p></>}
  {modal.kind==='review'&&<><div className="core-exit-history wide"><strong>Execution history</strong><p>Entry {price(modal.row.data.quantity)} @ {price(modal.row.data.entry)}</p>{modal.row.exits.map((x:any,i:number)=><p key={i}>Exit {price(x.data.quantity)} @ {price(x.data.price)} · fee {x.data.fee} {x.data.note&&'· '+x.data.note}</p>)}<b>Net {money(modal.row.summary.net)} USDT · {Number(modal.row.summary.rMultiple).toFixed(2)}R</b></div>{input('review','Post-trade review')}</>}
  </div>{error&&<p className="core-error" role="alert">{error}</p>}<div className="core-modal-actions"><button type="button" onClick={()=>{setModal(null);setError('');}} disabled={busy}>Cancel</button><button className="core-primary" disabled={busy} type="submit">{busy?'Saving…':modal.kind==='setup'?'Save setup':modal.kind==='exit'?'Save exit':modal.kind==='review'?'Save review':'Record trade'}</button></div></form></section></div>}
 </div>;
}
