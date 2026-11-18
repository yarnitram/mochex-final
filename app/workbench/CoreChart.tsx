'use client';
import {useEffect,useRef,useState} from 'react';
import {createChart,CandlestickSeries,HistogramSeries,LineSeries,ColorType,CrosshairMode,LineStyle,type UTCTimestamp,type ISeriesApi,type IChartApi,type AutoscaleInfo} from 'lightweight-charts';
import {calculateEma,type EmaPeriod} from '../../src/core/chart/ema';
import {calculatePricePrecision} from '../../src/core/chart/price-precision';
import {drawingSchema,calculateFibLevels,extrapolateCoordinateToTime,extrapolateTimeToCoordinate,sma,rsi,hitDrawing,moveDrawing,type Drawing} from '../../src/core/chart/workspace';
import type {Candle} from '../../src/core/market';
import {useChartLayout} from './useChartLayout';
import ChartObjects from './ChartObjects';
type Tool='cursor'|Drawing['type'];
const toolNames:Record<Tool,string>={cursor:'Cursor',horizontal_line:'Horizontal line',trendline:'Trend line',rectangle:'Rectangle',fib:'Fibonacci'};
export default function CoreChart({symbol,timeframe,onTimeframe,levels,onDirty}:{symbol:string,timeframe:string,onTimeframe:(v:string)=>void,levels?:{entry:string,stop:string,target:string},onDirty?:(dirty:boolean)=>void}){
 const mount=useRef<HTMLDivElement>(null),section=useRef<HTMLElement>(null),overlay=useRef<HTMLCanvasElement>(null);
 const api=useRef<IChartApi|null>(null),emaRefs=useRef<Record<number,ISeriesApi<'Line'>>>({}),smaRefs=useRef<Record<number,ISeriesApi<'Line'>>>({}),rsiRef=useRef<ISeriesApi<'Line'>|null>(null),volumeRef=useRef<ISeriesApi<'Histogram'>|null>(null),barsRef=useRef<Candle[]>([]);
 const layout=useChartLayout(symbol,timeframe),doc=layout.document;
 const [tool,setTool]=useState<Tool>('cursor'),[start,setStart]=useState<{time:number,price:number}|null>(null),[selected,setSelected]=useState<string|null>(null);
 const [error,setError]=useState(''),[feed,setFeed]=useState<{close:number,time:string}|null>(null),[loading,setLoading]=useState(true);
 const drag=useRef<{id:string,start:{x:number,y:number,time:number,price:number},original:Drawing,moved:boolean}|null>(null);
 const current=useRef({doc,tool,start,selected,layout});current.current={doc,tool,start,selected,layout};
 useEffect(()=>{onDirty?.(layout.dirty);},[layout.dirty,onDirty]);
 useEffect(()=>{setTool('cursor');setStart(null);setSelected(null);},[symbol,timeframe]);
 useEffect(()=>{
  const target=mount.current;if(!target||!layout.loaded)return;
  setFeed(null);setError('');setLoading(true);barsRef.current=[];
  const chart=createChart(target,{autoSize:true,layout:{background:{type:ColorType.Solid,color:'#0a141f'},textColor:'#8d90a2',fontSize:11},grid:{vertLines:{color:'#131c27'},horzLines:{color:'#131c27'}},crosshair:{mode:CrosshairMode.Normal},rightPriceScale:{borderColor:'#17202b',scaleMargins:{top:.08,bottom:.18}},timeScale:{borderColor:'#17202b',timeVisible:true,rightOffset:6,barSpacing:8}});
  api.current=chart;
  const candles=chart.addSeries(CandlestickSeries,{upColor:'#00c087',downColor:'#ff3b30',wickUpColor:'#00c087',wickDownColor:'#ff3b30',borderVisible:false,autoscaleInfoProvider:(original:()=>AutoscaleInfo|null)=>{
   const info=original();if(!info||!info.priceRange||!levels)return info;return {...info,priceRange:{minValue:Math.min(info.priceRange.minValue,Number(levels.entry),Number(levels.stop),Number(levels.target)),maxValue:Math.max(info.priceRange.maxValue,Number(levels.entry),Number(levels.stop),Number(levels.target))}};
  }});
  const volume=chart.addSeries(HistogramSeries,{priceFormat:{type:'volume'},priceScaleId:'volume',lastValueVisible:false,priceLineVisible:false,visible:current.current.doc.volume});volumeRef.current=volume;
  volume.priceScale().applyOptions({scaleMargins:{top:.8,bottom:0}});
  const colors=['#ffffff','#2962ff','#f5ac37','#ff7043'];emaRefs.current={};smaRefs.current={};
  ([20,50,100,200] as EmaPeriod[]).forEach((p,i)=>{emaRefs.current[p]=chart.addSeries(LineSeries,{color:colors[i]!,lineWidth:p===20?1:2,title:'EMA '+p,visible:current.current.doc.ema.includes(p),priceLineVisible:false,lastValueVisible:false});});
  ([20,50] as const).forEach((p,i)=>{smaRefs.current[p]=chart.addSeries(LineSeries,{color:['#b28af0','#d6a94a'][i]!,lineWidth:1,lineStyle:LineStyle.Dashed,title:'SMA '+p,visible:current.current.doc.sma.includes(p),priceLineVisible:false,lastValueVisible:false});});
  if(levels)for(const [title,price,color] of [['Entry',levels.entry,'#58b7ff'],['Stop',levels.stop,'#ff6b7c'],['Target',levels.target,'#58d6af']])candles.createPriceLine({price:Number(price),color,lineWidth:1,lineStyle:LineStyle.Dashed,axisLabelVisible:true,title});
  const duration=({'1m':60,'5m':300,'15m':900,'1h':3600,'4h':14400,'1d':86400} as Record<string,number>)[timeframe]!;
  function anchor(){
   const bars=barsRef.current,last=bars.at(-1),prev=bars.at(-2);if(!last||!prev)return null;
   const x=chart.timeScale().timeToCoordinate(last.time as UTCTimestamp),px=chart.timeScale().timeToCoordinate(prev.time as UTCTimestamp);return x===null||px===null?null:{last:last.time,x,spacing:Math.abs(x-px)};
  }
  function tx(time:number){const exact=chart.timeScale().timeToCoordinate(time as UTCTimestamp);if(exact!==null)return exact;const a=anchor();return a?extrapolateTimeToCoordinate(time,a.last,a.x,a.spacing,duration):null;}
  function pointAt(e:PointerEvent){
   const bounds=target!.getBoundingClientRect(),x=e.clientX-bounds.left,y=e.clientY-bounds.top;
   if(x<0||x>chart.timeScale().width()||y<0||y>(chart.panes()[0]?.getHeight()??0))return null;
   const a=anchor(),native=chart.timeScale().coordinateToTime(x),time=typeof native==='number'?native:a?extrapolateCoordinateToTime(x,a.last,a.x,a.spacing,duration):null,price=candles.coordinateToPrice(y);
   return time===null||price===null?null:{x,y,time:Math.round(time),price:Number(price)};
  }
  function pointerDown(e:PointerEvent){
   if(current.current.tool!=='cursor'||!current.current.layout.loaded||current.current.layout.saving)return;
   const p=pointAt(e);if(!p)return;
   for(const d of [...current.current.doc.drawings].reverse()){
    const x1=tx(d.startTime),x2=tx(d.endTime),y1=candles.priceToCoordinate(d.startPrice),y2=candles.priceToCoordinate(d.endPrice);
    if(x1===null||x2===null||y1===null||y2===null)continue;
    if(hitDrawing(d,p,{start:{x:x1,y:y1},end:{x:x2,y:y2}},chart.timeScale().width())){
     setSelected(d.id);
     if(!d.locked){drag.current={id:d.id,start:p,original:d,moved:false};chart.applyOptions({handleScroll:false,handleScale:false});target!.setPointerCapture(e.pointerId);}
     return;
    }
   }
   setSelected(null);
  }
  function pointerMove(e:PointerEvent){
   const active=drag.current;if(!active)return;const p=pointAt(e);if(!p)return;
   if(Math.hypot(p.x-active.start.x,p.y-active.start.y)>3)active.moved=true;
  }
  function pointerCancel(){drag.current=null;chart.applyOptions({handleScroll:true,handleScale:true});}
  function pointerUp(e:PointerEvent){
   const active=drag.current;drag.current=null;if(!active)return;chart.applyOptions({handleScroll:true,handleScale:true});if(!active.moved)return;
   const p=pointAt(e);if(!p)return;
   const moved=moveDrawing(active.original,p.time-active.start.time,p.price-active.start.price);
   if(moved)current.current.layout.drawings(current.current.doc.drawings.map(d=>d.id===active.id?moved:d));
   else setError('Drawing cannot move beyond valid time or positive price.');
  }
  function drawingPointer(e:PointerEvent){
   const s=current.current;if(s.tool==='cursor'||!s.layout.loaded||s.layout.saving||!barsRef.current.length)return;
   const bounds=target!.getBoundingClientRect(),pointX=e.clientX-bounds.left,pointY=e.clientY-bounds.top;
   if(pointX<0||pointX>chart.timeScale().width()||pointY<0||pointY>(chart.panes()[0]?.getHeight()??0))return;
   const a=anchor(),nativeTime=chart.timeScale().coordinateToTime(pointX),time=typeof nativeTime==='number'?nativeTime:a?extrapolateCoordinateToTime(pointX,a.last,a.x,a.spacing,duration):null,price=candles.coordinateToPrice(pointY);
   if(time===null||price===null)return;
   const point={time:Math.round(time),price:Number(price)};
   if(s.tool!=='horizontal_line'&&!s.start){setStart(point);return;}
   if(s.doc.drawings.length>=100){setError('This layout supports up to100 drawings.');setTool('cursor');setStart(null);return;}
   try{
    const first=s.start??point,drawing=drawingSchema.parse({id:crypto.randomUUID(),type:s.tool,startTime:first.time,endTime:point.time,startPrice:first.price,endPrice:point.price,color:'#58d6af',name:toolNames[s.tool],hidden:false,locked:false});
    s.layout.drawings([...s.doc.drawings,drawing]);setSelected(drawing.id);setTool('cursor');setStart(null);setError('');
   }catch{setError('Choose two distinct candle times and positive price levels.');setStart(null);}
  }
  target.addEventListener('pointerdown',pointerDown);target.addEventListener('pointermove',pointerMove);target.addEventListener('pointercancel',pointerCancel);target.addEventListener('pointerup',pointerUp);target.addEventListener('pointerup',drawingPointer);
  let dead=false,frame=0,initial=true;const controller=new AbortController();
  function draw(){
   if(dead)return;const canvas=overlay.current,ctx=canvas?.getContext('2d');if(canvas&&ctx){
    const w=chart.timeScale().width(),h=chart.panes()[0]?.getHeight()??target!.clientHeight,dpr=window.devicePixelRatio||1;
    if(canvas.width!==Math.round(w*dpr)||canvas.height!==Math.round(h*dpr)){canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);canvas.style.width=w+'px';canvas.style.height=h+'px';}
    ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);
    const state=current.current;
    for(const d of state.doc.drawings){
     if(d.hidden)continue;const x1=tx(d.startTime),x2=tx(d.endTime),y1=candles.priceToCoordinate(d.startPrice),y2=candles.priceToCoordinate(d.endPrice);
     if(x1===null||x2===null||y1===null||y2===null)continue;
     ctx.strokeStyle=d.color;ctx.fillStyle=d.color;ctx.lineWidth=d.id===state.selected?2:1;ctx.setLineDash(d.locked?[5,3]:[]);ctx.font='11px system-ui';
     if(d.type==='horizontal_line'){ctx.beginPath();ctx.moveTo(0,y1);ctx.lineTo(w,y1);ctx.stroke();ctx.fillText(d.name,8,y1-6);}
     else if(d.type==='rectangle'){ctx.globalAlpha=.12;ctx.fillRect(Math.min(x1,x2),Math.min(y1,y2),Math.abs(x2-x1),Math.abs(y2-y1));ctx.globalAlpha=1;ctx.strokeRect(Math.min(x1,x2),Math.min(y1,y2),Math.abs(x2-x1),Math.abs(y2-y1));}
     else if(d.type==='fib'){for(const level of calculateFibLevels(d.startPrice,d.endPrice)){const y=candles.priceToCoordinate(level.price);if(y===null)continue;ctx.beginPath();ctx.moveTo(Math.min(x1,x2),y);ctx.lineTo(Math.max(x1,x2),y);ctx.stroke();ctx.fillText(level.ratio+' · '+level.price.toLocaleString('en-US',{maximumFractionDigits:8}),Math.min(x1,x2)+4,y-4);}}
     else{ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();}
    }
    if(state.start){const x=tx(state.start.time),y=candles.priceToCoordinate(state.start.price);if(x!==null&&y!==null){ctx.setLineDash([]);ctx.fillStyle='#f5ac37';ctx.beginPath();ctx.arc(x,y,4,0,Math.PI*2);ctx.fill();}}
   }frame=requestAnimationFrame(draw);
  }
  async function load(){
   try{
    const response=await fetch('/api/core/candles?symbol='+encodeURIComponent(symbol)+'&timeframe='+encodeURIComponent(timeframe),{signal:controller.signal,cache:'no-store'}),data=await response.json();
    if(!response.ok)throw Error(data.error??'Market data unavailable');
    if(data.symbol!==symbol||data.timeframe!==timeframe||data.exchange!=='mexc'||data.market!=='perpetual')throw Error('Market identity mismatch');
    const bars:Candle[]=data.candles;if(!bars.length)throw Error('No MEXC futures candles returned');if(dead)return;barsRef.current=bars;
    const latest=bars.at(-1)!,precision=calculatePricePrecision(latest.close,bars);candles.applyOptions({priceFormat:{type:'price',precision:precision.precision,minMove:precision.minMove}});
    candles.setData(bars.map(b=>({...b,time:b.time as UTCTimestamp})));volume.setData(bars.map(b=>({time:b.time as UTCTimestamp,value:b.volume,color:b.close>=b.open?'rgba(0,192,135,.3)':'rgba(255,59,48,.3)'})));
    for(const p of [20,50,100,200] as EmaPeriod[]){const values=calculateEma(bars.map(b=>b.close),p);emaRefs.current[p]?.setData(bars.flatMap((b,i)=>values[i]===null?[]:[{time:b.time as UTCTimestamp,value:values[i]!}]));}
    for(const p of [20,50]){const values=sma(bars.map(b=>b.close),p);smaRefs.current[p]?.setData(bars.flatMap((b,i)=>values[i]===null?[]:[{time:b.time as UTCTimestamp,value:values[i]!}]));}
    if(rsiRef.current){const values=rsi(bars.map(b=>b.close));rsiRef.current.setData(bars.flatMap((b,i)=>values[i]===null?[]:[{time:b.time as UTCTimestamp,value:values[i]!}]));}
    if(initial){const range=current.current.doc.range;if(range)chart.timeScale().setVisibleLogicalRange(range);else chart.timeScale().fitContent();initial=false;}
    setFeed({close:latest.close,time:data.updatedAt});setError(data.stale?'MEXC candles may be stale':'');
   }catch(e){if(!dead)setError(e instanceof Error?e.message:'Market data unavailable');}finally{if(!dead)setLoading(false);}
  }
  void load();draw();const interval=setInterval(()=>void load(),15000);
  return()=>{dead=true;drag.current=null;target.removeEventListener('pointerdown',pointerDown);target.removeEventListener('pointermove',pointerMove);target.removeEventListener('pointercancel',pointerCancel);target.removeEventListener('pointerup',pointerUp);target.removeEventListener('pointerup',drawingPointer);controller.abort();clearInterval(interval);cancelAnimationFrame(frame);emaRefs.current={};smaRefs.current={};rsiRef.current=null;volumeRef.current=null;api.current=null;chart.remove();};
 },[symbol,timeframe,layout.loaded,levels?.entry,levels?.stop,levels?.target]);
 useEffect(()=>{
  for(const [p,series] of Object.entries(emaRefs.current))series.applyOptions({visible:doc.ema.includes(Number(p) as EmaPeriod)});
  for(const [p,series] of Object.entries(smaRefs.current))series.applyOptions({visible:doc.sma.includes(Number(p) as 20|50)});
  volumeRef.current?.applyOptions({visible:doc.volume});
  const chart=api.current;if(!chart)return;
  if(doc.rsi&&!rsiRef.current){const series=chart.addSeries(LineSeries,{title:'RSI14',color:'#b28af0',lineWidth:1,priceLineVisible:false,autoscaleInfoProvider:()=>({priceRange:{minValue:0,maxValue:100}})},1);rsiRef.current=series;
   for(const price of [30,70])series.createPriceLine({price,color:'#4d5369',lineWidth:1,lineStyle:LineStyle.Dashed,axisLabelVisible:false});
   const bars=barsRef.current,values=rsi(bars.map(b=>b.close));series.setData(bars.flatMap((b,i)=>values[i]===null?[]:[{time:b.time as UTCTimestamp,value:values[i]!}]));chart.panes()[1]?.setHeight(120);
  }else if(!doc.rsi&&rsiRef.current){chart.removeSeries(rsiRef.current);rsiRef.current=null;}
 },[doc.ema,doc.sma,doc.rsi,doc.volume,layout.loaded]);
 useEffect(()=>{api.current?.applyOptions({handleScroll:tool==='cursor',handleScale:tool==='cursor'});},[tool,layout.loaded]);
 useEffect(()=>{
  const handler=(e:KeyboardEvent)=>{if(!section.current?.contains(document.activeElement)||/INPUT|TEXTAREA|SELECT/.test((e.target as HTMLElement).tagName))return;
   if(e.key==='Escape'){setTool('cursor');setStart(null);}
   if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'&&layout.loaded&&!layout.saving){e.preventDefault();if(e.shiftKey)layout.redo();else layout.undo();}
  };window.addEventListener('keydown',handler);return()=>window.removeEventListener('keydown',handler);
 },[layout]);
 const disabled=!layout.loaded||layout.saving;
 function timeframeChange(value:string){if(!layout.dirty||window.confirm('Discard unsaved chart changes and switch timeframe?'))onTimeframe(value);}
 return <section className="core-chart" ref={section} tabIndex={0} onPointerDown={e=>{if(!/INPUT|SELECT|TEXTAREA|BUTTON/.test((e.target as HTMLElement).tagName))section.current?.focus({preventScroll:true});}}>
  <div className="chart-toolbar"><div><strong>{symbol.replace('_',' / ')}</strong><span className="market-badge">MEXC · USDT PERPETUAL</span></div><div className="chart-controls"><select aria-label="Chart timeframe" value={timeframe} onChange={e=>timeframeChange(e.target.value)}>{['1m','5m','15m','1h','4h','1d'].map(t=><option key={t}>{t}</option>)}</select><button onClick={()=>section.current?.requestFullscreen().catch(()=>setError('Fullscreen unavailable'))}>Fullscreen</button></div></div>
  <div className="chart-drawing-tools">{(Object.keys(toolNames) as Tool[]).map(t=><button key={t} disabled={disabled} aria-pressed={tool===t} onClick={()=>{setTool(t);setStart(null);}}>{toolNames[t]}</button>)}<button disabled={disabled||!layout.canUndo} onClick={layout.undo}>Undo</button><button disabled={disabled||!layout.canRedo} onClick={layout.redo}>Redo</button></div>
  <div className="chart-layout-actions"><span role="status">{!layout.loaded?'Loading saved layout…':layout.saving?'Saving layout…':layout.dirty?'Unsaved chart changes':'Saved layout · revision '+layout.revision}</span><button disabled={disabled} onClick={()=>void layout.save(api.current?.timeScale().getVisibleLogicalRange()??doc.range)}>Save layout</button><button disabled={layout.saving} onClick={layout.reload}>Reload saved</button><small>Save includes the current zoom.</small></div>
  {tool!=='cursor'&&<p className="chart-draw-prompt">{start?'Choose the second point.':'Choose '+(tool==='horizontal_line'?'a price level.':'the first point.')} Escape cancels.</p>}
  <div className="chart-indicators">{([20,50,100,200] as EmaPeriod[]).map(p=><button disabled={disabled} key={p} aria-pressed={doc.ema.includes(p)} onClick={()=>layout.change({ema:doc.ema.includes(p)?doc.ema.filter(v=>v!==p):[...doc.ema,p]})}>EMA {p}</button>)}{([20,50] as const).map(p=><button disabled={disabled} key={'sma'+p} aria-pressed={doc.sma.includes(p)} onClick={()=>layout.change({sma:doc.sma.includes(p)?doc.sma.filter(v=>v!==p):[...doc.sma,p]})}>SMA {p}</button>)}<button disabled={disabled} aria-pressed={doc.rsi} onClick={()=>layout.change({rsi:!doc.rsi})}>RSI 14</button><button disabled={disabled} aria-pressed={doc.volume} onClick={()=>layout.change({volume:!doc.volume})}>Volume</button><span>{feed?feed.close.toLocaleString('en-US',{maximumFractionDigits:8}):'—'}</span></div>
  {layout.error&&<div role="alert" className="chart-error">{layout.error} Your draft has not been discarded.</div>}
  {error&&<div role="status" className="chart-error">{error}. {feed?'Showing the last received chart; data may be stale.':'No substitute market or generated prices are shown.'}</div>}
  {loading&&<p className="chart-loading">Loading MEXC futures candles…</p>}
  <div className="chart-canvas-stack"><div ref={mount} data-testid="price-chart" className="price-chart" role="img" aria-label={'Mochex candlestick chart for '+symbol}/><canvas ref={overlay} className="chart-drawing-overlay" aria-label="Drawing overlay"/></div>
  <ChartObjects items={doc.drawings} selected={selected} onSelect={setSelected} onChange={layout.drawings} disabled={disabled}/>
  <footer><a href="https://www.tradingview.com/" target="_blank" rel="noreferrer">Charts powered by TradingView Lightweight Charts</a><span>{feed?'Received '+new Date(feed.time).toLocaleTimeString():'Waiting for market data'} · UTC drawing anchors</span></footer>
 </section>;
}
