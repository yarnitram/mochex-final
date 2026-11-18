'use client';
import { useEffect,useState } from 'react';
export default function SymbolPicker({value,onChange,label='Symbol'}:{value:string,onChange:(value:string)=>void,label?:string}){
 const [items,setItems]=useState<{symbol:string}[]>([]),[error,setError]=useState(''),[focused,setFocused]=useState(false);
 useEffect(()=>{
  const controller=new AbortController();const timer=setTimeout(()=>{void fetch('/api/core/market?search='+encodeURIComponent(value),{signal:controller.signal,cache:'no-store'}).then(async r=>{const data=await r.json();if(!r.ok)throw Error(data.error??'Discovery unavailable');setItems(data.instruments);setError('');}).catch(e=>{if(!controller.signal.aborted){setError(e.message);setItems([]);}});},200);
  return()=>{clearTimeout(timer);controller.abort();};
 },[value]);
 return <label className="core-symbol-picker">{label}<input aria-label={label} autoComplete="off" value={value} required maxLength={40} onFocus={()=>setFocused(true)} onBlur={()=>setTimeout(()=>setFocused(false),150)} onChange={e=>onChange(e.target.value.toUpperCase())}/>{focused&&<div className="core-symbol-options">{items.slice(0,8).map(i=><button type="button" key={i.symbol} onMouseDown={e=>e.preventDefault()} onClick={()=>{onChange(i.symbol);setFocused(false);}}>{i.symbol}</button>)}{!items.length&&!error&&<small>No matching active contracts</small>}</div>}{error&&<small className="negative" role="status">{error}. Manual plans remain available.</small>}</label>;
}
