'use client';
import {useState} from 'react';
type Result={rows:{status:string,symbol:string,date:string,tradeId:string|null}[],applied:number};
export default function JournalTransfer({onApplied}:{onApplied:()=>Promise<void>}){
 const [csv,setCsv]=useState(''),[result,setResult]=useState<Result|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 async function exportFile(){
  setBusy(true);setError('');try{const response=await fetch('/api/core/journal/transfer',{cache:'no-store'});if(!response.ok)throw Error((await response.json()).error??'Export failed');
   const url=URL.createObjectURL(await response.blob()),link=document.createElement('a');link.href=url;link.download='mochex-journal.csv';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }catch(e){setError(e instanceof Error?e.message:'Export failed');}finally{setBusy(false);}
 }
 async function send(body:string,mode:'preview'|'apply'){
  setBusy(true);setError('');try{const response=await fetch('/api/core/journal/transfer?mode='+mode,{method:'POST',headers:{'content-type':'text/csv'},body});
   const data=await response.json();if(!response.ok)throw Error(data.error??'Import failed');setResult(data);if(mode==='apply')await onApplied();
  }catch(e){setError(e instanceof Error?e.message:'Import failed');}finally{setBusy(false);}
 }
 const counts=result?.rows.reduce((a:Record<string,number>,r)=>({...a,[r.status]:(a[r.status]??0)+1}),{})??{};
 return <details className="journal-transfer"><summary>Import / export journal</summary><div><p>Export closed trades as EXMOCHEX column CSV. Import a CSV copy to add tags and notes to matching unreviewed trades only. Matching checks date, symbol, side, entry and P&amp;L. It never creates fills.</p><button type="button" disabled={busy} onClick={()=>void exportFile()}>Export closed CSV</button><label>Import EXMOCHEX CSV<input aria-label="Import EXMOCHEX CSV" type="file" accept=".csv,text/csv" disabled={busy} onChange={async e=>{const file=e.target.files?.[0];e.target.value='';if(!file)return;if(file.size>1048576){setError('CSV must be at most 1 MB.');return;}const text=await file.text();setCsv(text);setResult(null);void send(text,'preview');}}/></label>{result&&<div role="status"><strong>{result.rows.length} rows checked</strong><span>{Object.entries(counts).map(([key,count])=>key+': '+count).join(' · ')}</span>{result.applied>0&&<span> · Applied {result.applied} reviews</span>}</div>}{result&&(counts.ready??0)>0&&<button type="button" disabled={busy} onClick={()=>void send(csv,'apply')}>Import {counts.ready} matching reviews</button>}{error&&<p role="alert">{error}</p>}</div></details>;
}
