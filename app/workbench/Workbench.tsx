'use client';
import { useEffect,useRef,useState } from 'react';
import CoreChart from './CoreChart';
import {createInitialMultiChartState,getActivePane,getVisiblePanes,setGridLayoutMode,updateActivePaneSymbol,updateActivePaneResolution,toggleGridSyncOption,toggleMaximizePane,type GridLayoutMode,type MultiChartWorkspaceState} from '../../src/core/chart/grid';
import SymbolPicker from './SymbolPicker';
import WatchTable,{columnLabels,EventBadges} from './WatchTable';
import MarketStatus from './MarketStatus';
import { useMarketMonitor } from './useMarketMonitor';
import { defaultPreferences,quoteState } from '../../src/core/quotes';
import { planSchema,normalizeSymbol } from '../../src/core/domain';
import {filterJournal,journalSummary} from '../../src/core/journal';
import {paginate} from '../../src/core/pagination';
import JournalInsights from './JournalInsights';
import JournalTransfer from './JournalTransfer';
import './core.css';
import './journal.css';
import './chart-grid.css';
import './exmochex-ui.css';
import './mochex-chart-ui.css';
type View='watchlist'|'trades'|'journal'|'charts';
const labels={watchlist:'Watchlist',trades:'Trades',journal:'Journal',charts:'Charts'};
const emptyPlan={symbol:'BTC_USDT',side:'long',entry:'',stop:'',target:'',trigger:'',triggerDirection:'above',timeframe:'15m',strategy:'',notes:''};
const money=(s:unknown)=>Number(s??0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
const price=(s:unknown)=>Number(s??0).toLocaleString('en-US',{maximumFractionDigits:8});
export default function Workbench({initial,account}:{initial:any,account:{id:string,email:string}}){
 const [data,setData]=useState(initial),[view,setView]=useState<View>('watchlist'),[filter,setFilter]=useState(''),[status,setStatus]=useState('active');
 const [tablePage,setTablePage]=useState(0),[pageSize,setPageSize]=useState<number|'all'>(20);
 const [journalTag,setJournalTag]=useState('all'),[journalOutcome,setJournalOutcome]=useState<'all'|'win'|'loss'|'breakeven'>('all');
 const [grid,setGrid]=useState(createInitialMultiChartState);
 const activePane=getActivePane(grid);
 const [levels,setLevels]=useState<{paneId:string,symbol:string,timeframe:string,entry:string,stop:string,target:string}|null>(null);
 const selected={symbol:activePane.symbol,timeframe:activePane.resolution,levels:levels?.paneId===activePane.id&&levels.symbol===activePane.symbol&&levels.timeframe===activePane.resolution?levels:undefined};
 const [symbolDraft,setSymbolDraft]=useState('BTC_USDT');
 const [dirtyPanes,setDirtyPanes]=useState<Record<string,boolean>>({});
 const chartDirty=Object.values(dirtyPanes).some(Boolean);
 const {market,error:marketError,busy:marketBusy,refresh:refreshMarket}=useMarketMonitor([selected.symbol]);
 const prefs=data.preferences??defaultPreferences;
 async function savePrefs(next:any){const previous=prefs;setData((old:any)=>({...old,preferences:next}));setBusy(true);try{await mutate('preferences',next);}catch(e){setData((old:any)=>({...old,preferences:previous}));setError(e instanceof Error?e.message:'Unable to save columns');}finally{setBusy(false);}}
 const [modal,setModal]=useState<any>(null),[form,setForm]=useState<any>({}),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [imageBusy,setImageBusy]=useState(false);
 const modalRef=useRef<HTMLElement>(null),returnFocus=useRef<HTMLElement|null>(null);
 useEffect(()=>{if(!modal)return;const previousOverflow=document.body.style.overflow;document.body.style.overflow='hidden';modalRef.current?.querySelector<HTMLElement>('form input,form select,form textarea')?.focus();const onKey=(event:KeyboardEvent)=>{if(event.key==='Escape'&&!busy&&!imageBusy){event.preventDefault();setModal(null);setError('');return;}if(event.key!=='Tab')return;const controls=[...(modalRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href]')??[])];if(!controls.length)return;const first=controls[0]!,last=controls.at(-1)!;if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}};document.addEventListener('keydown',onKey);return()=>{document.body.style.overflow=previousOverflow;document.removeEventListener('keydown',onKey);};},[modal?.kind,busy,imageBusy]);
 useEffect(()=>{if(!modal)returnFocus.current?.focus();},[modal]);
 const openTrades=data.trades.filter((t:any)=>!t.closed_at),closed=data.trades.filter((t:any)=>t.closed_at);
 const realized=data.trades.reduce((a:number,t:any)=>a+Number(t.summary.net),0),wins=closed.filter((t:any)=>Number(t.summary.net)>0).length;
 function canChange(next:MultiChartWorkspaceState){const changed=grid.panes.filter(p=>{const after=next.panes.find(q=>q.id===p.id);return after&&(after.symbol!==p.symbol||after.resolution!==p.resolution);}).map(p=>p.id);const shown=(state:MultiChartWorkspaceState)=>getVisiblePanes(state).filter(p=>!state.maximizedPaneId||p.id===state.maximizedPaneId);const hidden=shown(grid).filter(p=>!shown(next).some(q=>q.id===p.id)).map(p=>p.id);const affected=[...new Set([...changed,...hidden])];return !affected.some(id=>dirtyPanes[id])||window.confirm('Discard unsaved chart changes in affected panes?');}
 function applyGrid(next:MultiChartWorkspaceState){if(!canChange(next))return false;setGrid(next);setDirtyPanes(old=>{const copy={...old};for(const p of grid.panes){const after=next.panes.find(q=>q.id===p.id);if(!after||after.symbol!==p.symbol||after.resolution!==p.resolution||!getVisiblePanes(next).some(q=>q.id===p.id)||(next.maximizedPaneId&&p.id!==next.maximizedPaneId))delete copy[p.id];}return copy;});setSymbolDraft(getActivePane(next).symbol);return true;}
 function changeView(v:View){if(view==='charts'&&v!=='charts'&&chartDirty&&!window.confirm('Discard unsaved chart changes?'))return;setDirtyPanes({});setView(v);setFilter('');setTablePage(0);setError('');}
 function chartFor(row:any){const p=row.data;const next=updateActivePaneResolution(updateActivePaneSymbol(grid,p.symbol),p.timeframe);if(!applyGrid(next))return;setLevels({paneId:activePane.id,symbol:p.symbol,timeframe:p.timeframe,entry:p.entry,stop:p.stop,target:p.target});changeView('charts');}
 function show(kind:string,row?:any){
  returnFocus.current=document.activeElement instanceof HTMLElement?document.activeElement:null;
  setError('');setNotice('');setModal({kind,row,requestId:crypto.randomUUID()});
  setForm(kind==='setup'||kind==='manual'?{...emptyPlan,...(kind==='manual'&&view==='charts'?{symbol:selected.symbol,timeframe:selected.timeframe}:{}),...(row?.data??{}),triggerDirection:row?.data?.triggerDirection??(row?.data?.side==='short'?'below':'above'),margin:'100',leverage:'1',entryFee:'0'}:
   kind==='open'?{margin:'100',leverage:'1',entryFee:'0'}:
   kind==='exit'?{quantity:row.summary.remaining,price:'',fee:'0',note:''}:{review:row?.review??'',tags:(row?.tags??[]).join(', ')});
 }
 async function mutate(action:string,body:unknown,id?:string){
  const response=await fetch('/api/core/workspace',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action,id,data:body})});
  const result=await response.json();if(!response.ok)throw Error(result.error??'Unable to save');
  const refresh=await fetch('/api/core/workspace',{cache:'no-store'});if(!refresh.ok)throw Error('Saved, but refresh failed. Reload to see your records.');
  setData(await refresh.json());return result;
 }
 async function refreshWorkspace(){
  const response=await fetch('/api/core/workspace',{cache:'no-store'});if(!response.ok)throw Error('Refresh failed');
  const next=await response.json();setData(next);return next;
 }
 async function refreshTradeRow(id:string){
  const next=await refreshWorkspace();setModal((prior:any)=>prior?.row?.id===id?{...prior,row:next.trades.find((t:any)=>t.id===id)??prior.row}:prior);
 }
 async function uploadReviewImage(id:string,file:File){
  setImageBusy(true);setError('');try{
   if(file.size>1048576)throw Error('Screenshot must be at most 1 MB.');
   const response=await fetch('/api/core/journal/images?tradeId='+encodeURIComponent(id),{method:'POST',headers:{'content-type':file.type},body:file});
   if(!response.ok)throw Error((await response.json()).error??'Screenshot upload failed');
   await refreshTradeRow(id);
  }catch(e){setError(e instanceof Error?e.message:'Screenshot upload failed');}finally{setImageBusy(false);}
 }
 async function deleteReviewImage(tradeId:string,imageId:string){
  setImageBusy(true);setError('');try{
   const response=await fetch('/api/core/journal/images/'+imageId,{method:'DELETE'});
   if(!response.ok)throw Error((await response.json()).error??'Screenshot deletion failed');
   await refreshTradeRow(tradeId);
  }catch(e){setError(e instanceof Error?e.message:'Screenshot deletion failed');}finally{setImageBusy(false);}
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
   else await mutate('trade-review',{review:form.review,tags:String(form.tags??'').split(',').map(s=>s.trim()).filter(Boolean)},row.id);
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
 }),trades=view==='journal'?filterJournal(data.trades,{query:filter,tag:journalTag,outcome:journalOutcome}):openTrades.filter(matches);
 const availableTags=[...new Set<string>(closed.flatMap((t:any)=>t.tags??[]))].sort(),journal=journalSummary(trades);
 const tableRows=view==='watchlist'?watch:trades,table=paginate(tableRows,tablePage,pageSize);
 const input=(key:string,label:string,type='text')=><label className={key==='notes'||key==='review'?'wide':''} key={key}>{label}{key==='notes'||key==='review'?<textarea aria-label={label} value={form[key]??''} onChange={e=>setForm({...form,[key]:e.target.value})} maxLength={4000}/>:<input aria-label={label} type={type} value={form[key]??''} onChange={e=>setForm({...form,[key]:e.target.value})} required={!['strategy','trigger','note'].includes(key)} maxLength={key==='symbol'?40:100} inputMode={['entry','stop','target','trigger','margin','leverage','quantity','price','fee','entryFee'].includes(key)?'decimal':undefined}/>}</label>;
 return <div className="core-shell">
  <aside className="core-sidebar"><a className="core-brand" href="/workbench">MOCHEX<small>TERMINAL</small></a><p className="core-nav-caption">YOUR WORKSPACE</p><nav aria-label="Trading workspace">{(Object.keys(labels) as View[]).map((v,i)=><button key={v} onClick={()=>changeView(v)} aria-current={view===v?'page':undefined}><span>{['◉','⇄','▤','▥'][i]}</span>{labels[v]}<small>{v==='watchlist'?data.watchlist.filter((w:any)=>w.status==='active').length:v==='trades'?openTrades.length:v==='journal'?closed.length:''}</small></button>)}</nav><div className="core-sidebar-foot"><span className="core-mode">MANUAL TRACKING</span><p>Plan. Record. Learn.</p><small>Recorded trades do not place exchange orders.</small></div></aside>
  <div className="core-main"><header className="core-top"><span>Workspace <b>/</b> {labels[view]}</span><div><span>{account.email}</span><form action="/api/auth/logout" method="post"><button>Sign out</button></form></div></header>
  <main><div className="core-page-heading"><div><p className="core-eyebrow">MOCHEX WORKSPACE</p><h1>{view==='watchlist'?'Build your next trade.':view==='trades'?'Manage your recorded trades.':view==='journal'?'Turn each trade into insight.':'Your market, in focus.'}</h1><p>{view==='watchlist'?'Keep your thesis, trigger and risk levels together.':view==='trades'?'Track entries, remaining size and realized results.':view==='journal'?'Review closed trades, execution history and lessons.':'Mochex charting baseline · matching MEXC perpetual data.'}</p></div><button className="core-primary" onClick={()=>show(view==='watchlist'?'setup':'manual')}>{view==='watchlist'?'+ Add setup':'+ Record trade'}</button></div>
  {view!=='charts'&&<div className="core-stats"><article><span>Watching</span><strong>{data.watchlist.filter((w:any)=>w.status==='active').length}</strong><small>Planned setups</small></article><article><span>Open trades</span><strong>{openTrades.length}</strong><small>Manually recorded positions</small></article><article><span>Net recorded P&amp;L</span><strong className={realized>=0?'positive':'negative'}>{realized>=0?'+':''}{money(realized)} <em>USDT</em></strong><small>Realized exits less recorded fees</small></article><article><span>Closed win rate</span><strong>{closed.length?Math.round(wins/closed.length*100)+'%':'—'}</strong><small>{closed.length} closed trade{closed.length===1?'':'s'}</small></article></div>}
  {view!=='charts'&&<MarketStatus market={market} error={marketError} busy={marketBusy} onRefresh={()=>void refreshMarket()}/>}
  {!modal&&error&&<p className="core-error" role="alert">{error}</p>}{notice&&<p className="core-notice" role="status">{notice}</p>}
  {view==='charts'?<div className="core-chart-layout"><div className="core-grid-toolbar" aria-label="Chart workspace"><div className="core-grid-presets">{(['1x1','2x1','1x2','2x2'] as GridLayoutMode[]).map(mode=><button key={mode} aria-label={'Chart layout '+mode} aria-pressed={grid.layoutMode===mode} onClick={()=>applyGrid(setGridLayoutMode(grid,mode))}>{mode}</button>)}</div><div className="core-grid-sync"><button aria-pressed={grid.sync.syncSymbol} onClick={()=>applyGrid(toggleGridSyncOption(grid,'syncSymbol'))}>Sync symbols</button><button aria-pressed={grid.sync.syncInterval} onClick={()=>applyGrid(toggleGridSyncOption(grid,'syncInterval'))}>Sync timeframes</button></div></div><form className="core-chart-selector" onSubmit={e=>{e.preventDefault();try{const symbol=normalizeSymbol(symbolDraft);if(applyGrid(updateActivePaneSymbol(grid,symbol))){setLevels(null);setError('');}}catch(e){setError(e instanceof Error?e.message:'Invalid symbol');}}}><label>Active pane symbol<input aria-label="Chart symbol" value={symbolDraft} onChange={e=>setSymbolDraft(e.target.value.toUpperCase())}/><button className="core-load">Load chart</button></label><span>MEXC USDT perpetual · refreshes every 15 seconds</span></form><div className={'core-grid core-grid-'+grid.layoutMode.replace('x','-')+(grid.maximizedPaneId?' is-maximized':'')}>{getVisiblePanes(grid).filter(p=>!grid.maximizedPaneId||p.id===grid.maximizedPaneId).map((pane,i)=><div className={'core-grid-pane'+(pane.id===activePane.id?' is-active':'')} key={pane.id}><div className="core-grid-pane-head"><button aria-pressed={pane.id===activePane.id} onClick={()=>{setGrid({...grid,activePaneId:pane.id});setSymbolDraft(pane.symbol);}}>{'Pane '+(Number(pane.id.split('-')[1])+1)+' · '+pane.symbol+' · '+pane.resolution}</button>{grid.layoutMode!=='1x1'&&<button aria-label={(grid.maximizedPaneId?'Restore':'Maximize')+' '+pane.id} onClick={()=>applyGrid(toggleMaximizePane(grid,pane.id))}>{grid.maximizedPaneId?'Restore':'Maximize'}</button>}</div><CoreChart onDirty={dirty=>setDirtyPanes(old=>old[pane.id]===dirty?old:{...old,[pane.id]:dirty})} symbol={pane.symbol} timeframe={pane.resolution} levels={pane.id===activePane.id?selected.levels:undefined} onTimeframe={timeframe=>applyGrid(updateActivePaneResolution(grid,timeframe,pane.id))}/></div>)}</div></div>:
  <section className="core-panel"><div className="core-panel-tools"><div className="core-tabs">{view==='watchlist'?['active','opened','archived'].map(s=><button key={s} className={s===status?'chosen':''} onClick={()=>{setStatus(s);setTablePage(0);}}>{s==='active'?'Watching':s==='opened'?'Opened':'Archived'}</button>):<h2>{view==='trades'?'Active trades':'Trade journal'} <small>{trades.length}</small></h2>}</div><label className="core-search-label">Search <input className="core-search" aria-label="Search records" placeholder="Symbol, strategy or thesis…" value={filter} onChange={e=>{setFilter(e.target.value);setTablePage(0);}}/></label></div>
  {view==='journal'&&<div className="core-journal-tools"><label>Tag<select aria-label="Filter journal by tag" value={journalTag} onChange={e=>{setJournalTag(e.target.value);setTablePage(0);}}><option value="all">All tags</option>{availableTags.map(tag=><option key={tag} value={tag}>{tag}</option>)}</select></label><label>Outcome<select aria-label="Filter journal by outcome" value={journalOutcome} onChange={e=>{setJournalOutcome(e.target.value as typeof journalOutcome);setTablePage(0);}}><option value="all">All outcomes</option><option value="win">Wins</option><option value="loss">Losses</option><option value="breakeven">Breakeven</option></select></label><div className="core-journal-summary"><span>{journal.count} closed</span><span>Net <b>{money(journal.net)} USDT</b></span><span>Win rate <b>{journal.count?journal.winRate+'%':'—'}</b></span><span>Average <b>{journal.count?journal.averageR+'R':'—'}</b></span></div></div>}
  {view==='journal'&&<JournalInsights rows={trades}/>}
  {view==='journal'&&<JournalTransfer onApplied={refreshWorkspace}/>}
  {view==='watchlist'&&<div className="core-watch-options"><label>Sort<select aria-label="Sort watchlist" disabled={busy} value={prefs.sort+(prefs.descending?':desc':':asc')} onChange={e=>{const [sort,dir]=e.target.value.split(':');void savePrefs({...prefs,sort,descending:dir==='desc'});}}>{[['symbol','Symbol'],['price','Last price'],['change','24h change'],['turnover','24h turnover']].flatMap(([key,label])=>['asc','desc'].map(dir=><option key={key+dir} value={key+':'+dir}>{label} · {dir==='asc'?'low to high':'high to low'}</option>))}</select></label><details><summary>Columns</summary><div>{Object.entries(columnLabels).map(([key,label])=><label key={key}><input type="checkbox" disabled={busy} checked={prefs.columns.includes(key)} onChange={e=>void savePrefs({...prefs,columns:e.target.checked?[...prefs.columns,key]:prefs.columns.filter((x:string)=>x!==key)})}/>{label}</label>)}</div></details></div>}
  <div className="core-table-scroll">{view==='watchlist'?<WatchTable rows={table.items} prefs={prefs} market={market} error={marketError} busy={busy} onChart={chartFor} onOpen={row=>show('open',row)} onEdit={row=>show('setup',row)} onArchive={row=>void archive(row)}/>:
  <table><thead><tr><th>Coin / Strategy</th><th>Direction</th><th>Entry / Remaining</th><th>Recorded P&amp;L</th><th>R</th><th>{view==='journal'?'Closed':'Opened'}</th><th>Actions</th></tr></thead><tbody>{table.items.map((row:any)=><tr key={row.id}><td><strong>{row.data.symbol}</strong><small>{row.data.strategy||'Manual trade'}</small>{view==='journal'&&row.tags?.length>0&&<span className="core-journal-tags">{row.tags.map((tag:string)=><em key={tag}>{tag}</em>)}</span>}<p className="core-thesis">{row.data.notes}</p></td><td><span className={'core-side '+row.data.side}>{row.data.side.toUpperCase()}</span></td><td>{price(row.data.entry)}<small>{price(row.summary.remaining)} / {price(row.data.quantity)} base units</small><small>Margin {money(row.data.margin)} · {row.data.leverage}×</small><EventBadges events={market.events} target={'trade:'+row.id}/></td><td className={Number(row.summary.net)>=0?'positive':'negative'}>{Number(row.summary.net)>=0?'+':''}{money(row.summary.net)}<small>Fees {money(row.summary.fees)}</small></td><td>{Number(row.summary.rMultiple).toFixed(2)}R</td><td>{new Date(row.closed_at??row.created_at).toLocaleDateString()}</td><td><div className="core-row-actions"><button onClick={()=>chartFor(row)}>Chart ↗</button>{view==='trades'?<button aria-label={'Record exit '+row.data.symbol} onClick={()=>show('exit',row)}>Record exit</button>:<button aria-label={'Review '+row.data.symbol} onClick={()=>show('review',row)}>Review &amp; history</button>}</div></td></tr>)}</tbody></table>}</div>
  {table.total>0&&<div className="core-pagination"><span>{pageSize==='all'?`Showing all ${table.total}`:`Showing ${table.page*pageSize+1}–${Math.min((table.page+1)*pageSize,table.total)} of ${table.total}`}</span><div><label>Rows<select aria-label="Rows per page" value={pageSize} onChange={e=>{setPageSize(e.target.value==='all'?'all':Number(e.target.value));setTablePage(0);}}><option value={20}>20</option><option value={50}>50</option><option value="all">All</option></select></label><button disabled={table.page===0} onClick={()=>setTablePage(table.page-1)}>← Prev</button><span>Page {table.page+1} of {table.pageCount}</span><button disabled={table.page>=table.pageCount-1} onClick={()=>setTablePage(table.page+1)}>Next →</button></div></div>}
  {(view==='watchlist'?watch.length:trades.length)===0&&<div className="core-empty"><span>{view==='journal'?'▤':'⌁'}</span><h3>{view==='watchlist'?'A clear plan starts here.':view==='trades'?'No open trades to track.':'Your next lesson starts with a trade.'}</h3><p>{view==='watchlist'?'Add your first setup with entry, stop, target and a thesis.':view==='trades'?'Record a trade manually, or open one from your watchlist.':'Closed trades and your reviews will appear here.'}</p><button onClick={()=>show(view==='watchlist'?'setup':'manual')}>{view==='watchlist'?'Add setup':'Record a trade'} ↗</button></div>}
  </section>}
  <footer className="core-footer"><span>EXMOCHEX workflow · Mochex Charts engine</span><span>Private records · MEXC perpetuals · Manual tracking</span></footer></main></div>
  {modal&&<div className="core-modal-backdrop"><section className="core-modal" ref={modalRef} role="dialog" aria-modal="true" aria-labelledby="core-dialog-title"><header><div><p className="core-eyebrow">{modal.row?.data.symbol??'YOUR WORKSPACE'}</p><h2 id="core-dialog-title">{modal.kind==='setup'?(modal.row?'Edit setup':'Add setup'):modal.kind==='manual'?'Record a trade':modal.kind==='open'?'Record trade from setup':modal.kind==='exit'?'Record an exit':'Trade review & history'}</h2></div><button type="button" aria-label="Close dialog" disabled={busy} onClick={()=>{setModal(null);setError('');}}>×</button></header>
  <form onSubmit={submit}><div className="core-form-grid">
  {(modal.kind==='setup'||modal.kind==='manual')&&<><SymbolPicker value={form.symbol} onChange={symbol=>setForm({...form,symbol})}/><label>Direction<select aria-label="Direction" value={form.side} onChange={e=>setForm({...form,side:e.target.value})}><option value="long">Long</option><option value="short">Short</option></select></label>{input('entry','Entry price')}{input('stop','Stop loss')}{input('target','Take profit')}{input('trigger','Trigger price (optional)')}<label>Trigger direction<select aria-label="Trigger direction" value={form.triggerDirection??(form.side==='short'?'below':'above')} onChange={e=>setForm({...form,triggerDirection:e.target.value})}><option value="above">At or above</option><option value="below">At or below</option></select></label><label>Timeframe<select aria-label="Timeframe" value={form.timeframe} onChange={e=>setForm({...form,timeframe:e.target.value})}>{['1m','5m','15m','1h','4h','1d'].map(t=><option key={t}>{t}</option>)}</select></label>{input('strategy','Strategy (optional)')}{input('notes','Trade thesis')}</>}
  {(modal.kind==='open'||modal.kind==='manual')&&<>{input('margin','Margin (USDT)')}{input('leverage','Leverage')}{input('entryFee','Entry fee (USDT)')}<p className="core-form-note wide">Records an entry in your tracker. It does not place an exchange order.</p></>}
  {modal.kind==='exit'&&<>{input('quantity','Exit quantity (base units)')}{input('price','Exit price')}{input('fee','Exit fee (USDT)')}{input('note','Exit note')}<p className="core-form-note wide">Remaining: {modal.row.summary.remaining} base units. A partial exit keeps the rest open.</p></>}
  {modal.kind==='review'&&<><div className="core-exit-history wide"><strong>Execution history</strong><p>Entry {price(modal.row.data.quantity)} @ {price(modal.row.data.entry)}</p>{modal.row.exits.map((x:any,i:number)=><p key={i}>Exit {price(x.data.quantity)} @ {price(x.data.price)} · fee {x.data.fee} {x.data.note&&'· '+x.data.note}</p>)}<b>Net {money(modal.row.summary.net)} USDT · {Number(modal.row.summary.rMultiple).toFixed(2)}R</b></div>{input('review','Post-trade review')}<label className="wide">Review tags (comma separated)<input aria-label="Review tags" value={form.tags??''} onChange={e=>setForm({...form,tags:e.target.value})} placeholder="patience, risk-control" maxLength={240}/><small>Up to 8 tags, 2–24 letters, numbers or hyphens each.</small></label><div className="journal-images wide"><strong>Screenshots ({modal.row.images?.length??0}/3)</strong><div>{(modal.row.images??[]).map((item:any)=><figure key={item.id}><a href={'/api/core/journal/images/'+item.id} target="_blank" rel="noreferrer"><img src={'/api/core/journal/images/'+item.id} alt="Trade screenshot"/></a><button type="button" disabled={imageBusy} aria-label="Delete screenshot" onClick={()=>void deleteReviewImage(modal.row.id,item.id)}>Delete</button></figure>)}</div><label>Attach PNG, JPEG or WebP (up to 1 MB)<input aria-label="Attach trade screenshot" type="file" accept="image/png,image/jpeg,image/webp" disabled={imageBusy||(modal.row.images?.length??0)>=3} onChange={e=>{const file=e.target.files?.[0];if(file)void uploadReviewImage(modal.row.id,file);e.target.value='';}}/></label></div></>}
  </div>{error&&<p className="core-error" role="alert">{error}</p>}<div className="core-modal-actions"><button type="button" onClick={()=>{setModal(null);setError('');}} disabled={busy||imageBusy}>Cancel</button><button className="core-primary" disabled={busy||imageBusy} type="submit">{busy?'Saving…':modal.kind==='setup'?'Save setup':modal.kind==='exit'?'Save exit':modal.kind==='review'?'Save review':'Record trade'}</button></div></form></section></div>}
 </div>;
}
