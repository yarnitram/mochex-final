'use client';
import { useCallback,useEffect,useRef,useState } from 'react';
export function useMarketMonitor(symbols:string[]){
 const [market,setMarket]=useState<any>({quotes:{},events:[],sampledAt:null}),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const active=useRef(false),latest=useRef(symbols);latest.current=symbols;
 const refresh=useCallback(async()=>{
  if(active.current)return;active.current=true;setBusy(true);
  try{
   const r=await fetch('/api/core/monitor',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({symbols:latest.current.slice(0,100)}),signal:AbortSignal.timeout(15000)});
   const body=await r.json();if(!r.ok){setMarket((old:any)=>({...old,quotes:{},events:body.events??old.events,sampledAt:body.sampledAt??old.sampledAt}));throw Error(body.error??'Quotes unavailable');}
   if(body.exchange!=='mexc'||body.market!=='perpetual')throw Error('Market identity mismatch');
   setMarket(body);setError('');
  }catch(e){setError(e instanceof Error?e.message:'Market refresh unavailable');setMarket((old:any)=>({...old,quotes:{}}));}
  finally{active.current=false;setBusy(false);}
 },[]);
 useEffect(()=>{void refresh();const timer=setInterval(()=>void refresh(),10000);return()=>clearInterval(timer);},[refresh]);
 return {market,error,busy,refresh};
}
