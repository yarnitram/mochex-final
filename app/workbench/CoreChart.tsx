'use client';
import { useEffect,useRef,useState } from 'react';
import { createChart,CandlestickSeries,HistogramSeries,LineSeries,ColorType,CrosshairMode,LineStyle,type UTCTimestamp,type ISeriesApi,type AutoscaleInfo } from 'lightweight-charts';
import { calculateEma,type EmaPeriod } from '../../src/core/chart/ema';
import { calculatePricePrecision } from '../../src/core/chart/price-precision';
import type { Candle } from '../../src/core/market';
export default function CoreChart({symbol,timeframe,onTimeframe,levels}:{symbol:string,timeframe:string,onTimeframe:(v:string)=>void,levels?:{entry:string,stop:string,target:string}}){
 const mount=useRef<HTMLDivElement>(null),section=useRef<HTMLElement>(null),emaRefs=useRef<Record<number,ISeriesApi<'Line'>>>({});
 const [enabled,setEnabled]=useState<number[]>([20,50]),[error,setError]=useState(''),[feed,setFeed]=useState<{close:number,time:string}|null>(null),[loading,setLoading]=useState(true);
 useEffect(()=>{
  const target=mount.current;if(!target)return;
  setFeed(null);setError('');setLoading(true);
  const chart=createChart(target,{autoSize:true,layout:{background:{type:ColorType.Solid,color:'#0a141f'},textColor:'#8d90a2',fontSize:11},
   grid:{vertLines:{color:'#131c27'},horzLines:{color:'#131c27'}},crosshair:{mode:CrosshairMode.Normal},
   rightPriceScale:{borderColor:'#17202b',scaleMargins:{top:.08,bottom:.18}},
   timeScale:{borderColor:'#17202b',timeVisible:true,rightOffset:6,barSpacing:8}});
const candles=chart.addSeries(CandlestickSeries,{upColor:'#00c087',downColor:'#ff3b30',wickUpColor:'#00c087',wickDownColor:'#ff3b30',borderVisible:false,autoscaleInfoProvider:(original:()=>AutoscaleInfo|null)=>{const info=original();if(!info||!info.priceRange||!levels)return info;return {...info,priceRange:{minValue:Math.min(info.priceRange.minValue,Number(levels.entry),Number(levels.stop),Number(levels.target)),maxValue:Math.max(info.priceRange.maxValue,Number(levels.entry),Number(levels.stop),Number(levels.target))}};}});
  const volume=chart.addSeries(HistogramSeries,{priceFormat:{type:'volume'},priceScaleId:'volume',lastValueVisible:false,priceLineVisible:false});
  volume.priceScale().applyOptions({scaleMargins:{top:.8,bottom:0}});
  const colors=['#ffffff','#2962ff','#f5ac37','#ff7043'];
  emaRefs.current={};([20,50,100,200] as EmaPeriod[]).forEach((p,i)=>{emaRefs.current[p]=chart.addSeries(LineSeries,{color:colors[i]!,lineWidth:p===20?1:2,title:'EMA '+p,visible:enabled.includes(p),priceLineVisible:false,lastValueVisible:false});});
  if(levels)for(const [title,price,color] of [['Entry',levels.entry,'#58b7ff'],['Stop',levels.stop,'#ff6b7c'],['Target',levels.target,'#58d6af']]){
   candles.createPriceLine({price:Number(price),color,lineWidth:1,lineStyle:LineStyle.Dashed,axisLabelVisible:true,title});
  }
  const controller=new AbortController();let initial=true,dead=false;
  async function load(){
   try{
    const response=await fetch('/api/core/candles?symbol='+encodeURIComponent(symbol)+'&timeframe='+encodeURIComponent(timeframe),{signal:controller.signal,cache:'no-store'});
    const data=await response.json();
    if(!response.ok)throw Error(data.error??'Market data unavailable');
    if(data.symbol!==symbol||data.timeframe!==timeframe||data.exchange!=='mexc'||data.market!=='perpetual')throw Error('Market identity mismatch');
    const bars:Candle[]=data.candles;if(!bars.length)throw Error('No MEXC futures candles returned');
    if(dead)return;
    const latest=bars.at(-1)!,precision=calculatePricePrecision(latest.close,bars);
    candles.applyOptions({priceFormat:{type:'price',precision:precision.precision,minMove:precision.minMove}});
    candles.setData(bars.map(b=>({...b,time:b.time as UTCTimestamp})));
    volume.setData(bars.map(b=>({time:b.time as UTCTimestamp,value:b.volume,color:b.close>=b.open?'rgba(0,192,135,.3)':'rgba(255,59,48,.3)'})));
    for(const p of [20,50,100,200] as EmaPeriod[]){
     const values=calculateEma(bars.map(b=>b.close),p);
     emaRefs.current[p]?.setData(bars.flatMap((b,i)=>values[i]===null?[]:[{time:b.time as UTCTimestamp,value:values[i]!}]));
    }
    if(initial){chart.timeScale().fitContent();initial=false;}
    setFeed({close:latest.close,time:data.updatedAt});setError(data.stale?'MEXC candles may be stale':'');
   }catch(e){if(!dead)setError(e instanceof Error?e.message:'Market data unavailable');}
   finally{if(!dead)setLoading(false);}
  }
  void load();const interval=setInterval(()=>void load(),15000);
  return()=>{dead=true;controller.abort();clearInterval(interval);emaRefs.current={};chart.remove();};
  // Recreate only on market/context changes; refreshes retain the visible range.
 },[symbol,timeframe,levels?.entry,levels?.stop,levels?.target]);
 useEffect(()=>{for(const [p,series] of Object.entries(emaRefs.current))series.applyOptions({visible:enabled.includes(Number(p))});},[enabled]);
 return <section className="core-chart" ref={section}>
  <div className="chart-toolbar"><div><strong>{symbol.replace('_',' / ')}</strong><span className="market-badge">MEXC · USDT PERPETUAL</span></div><div className="chart-controls"><select aria-label="Chart timeframe" value={timeframe} onChange={e=>onTimeframe(e.target.value)}>{['1m','5m','15m','1h','4h','1d'].map(t=><option key={t}>{t}</option>)}</select><button onClick={()=>section.current?.requestFullscreen().catch(()=>setError('Fullscreen unavailable'))}>Fullscreen</button></div></div>
  <div className="chart-indicators">{[20,50,100,200].map(p=><button key={p} aria-pressed={enabled.includes(p)} onClick={()=>setEnabled(old=>old.includes(p)?old.filter(v=>v!==p):[...old,p])}>EMA {p}</button>)}<span>{feed?feed.close.toLocaleString('en-US',{maximumFractionDigits:8}):'—'}</span></div>
  {error&&<div role="status" className="chart-error">{error}. {feed?'Showing the last received chart; data may be stale.':'No substitute market or generated prices are shown.'}</div>}
  {loading&&<p className="chart-loading">Loading MEXC futures candles…</p>}
  <div ref={mount} data-testid="price-chart" className="price-chart" role="img" aria-label={'Mochex candlestick chart for '+symbol}/>
  <footer><a href="https://www.tradingview.com/" target="_blank" rel="noreferrer">Charts powered by TradingView Lightweight Charts</a><span>{feed?'Received '+new Date(feed.time).toLocaleTimeString():'Waiting for market data'} · Mochex chart baseline</span></footer>
 </section>;
}
