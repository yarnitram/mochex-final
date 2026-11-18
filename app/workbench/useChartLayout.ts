'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {defaultLayout,layoutSchema,historyPush,historyUndo,historyRedo,type Drawing,type ChartLayout,type DrawingHistoryState} from '../../src/core/chart/workspace';
type State={document:ChartLayout,saved:string,revision:number,history:DrawingHistoryState};
const initial=():State=>({document:structuredClone(defaultLayout),saved:JSON.stringify(defaultLayout),revision:0,history:{current:[],undoStack:[],redoStack:[]}});
export function useChartLayout(symbol:string,timeframe:string){
 const [state,setState]=useState(initial),[loaded,setLoaded]=useState(false),[saving,setSaving]=useState(false),[error,setError]=useState(''),[context,setContext]=useState('');
 const ready=loaded&&context===symbol+'|'+timeframe;
 const epoch=useRef(0),retry=useRef<{key:string,body:unknown}|null>(null),dirty=ready&&JSON.stringify(state.document)!==state.saved;
 const load=useCallback(async(signal?:AbortSignal)=>{
  const requestEpoch=++epoch.current;
  setLoaded(false);setError('');
  try{
   const r=await fetch('/api/core/chart?symbol='+encodeURIComponent(symbol)+'&timeframe='+encodeURIComponent(timeframe),{cache:'no-store',signal});const data=await r.json();if(!r.ok)throw Error(data.error??'Layout unavailable');
   if(data.symbol!==symbol||data.timeframe!==timeframe)throw Error('Layout context mismatch');
   const document=layoutSchema.parse(data.document);if(signal?.aborted||requestEpoch!==epoch.current)return;
   setState({document,saved:JSON.stringify(document),revision:data.revision,history:{current:document.drawings,undoStack:[],redoStack:[]}});retry.current=null;setContext(symbol+'|'+timeframe);setLoaded(true);
  }catch(e){if(!signal?.aborted&&requestEpoch===epoch.current)setError(e instanceof Error?e.message:'Layout unavailable');}
 },[symbol,timeframe]);
 useEffect(()=>{const c=new AbortController();void load(c.signal);return()=>{c.abort();epoch.current++;};},[load]);
 useEffect(()=>{if(!dirty)return;const listener=(e:BeforeUnloadEvent)=>{e.preventDefault();e.returnValue='';};window.addEventListener('beforeunload',listener);return()=>window.removeEventListener('beforeunload',listener);},[dirty]);
 const change=useCallback((patch:Partial<ChartLayout>)=>setState(s=>({...s,document:{...s.document,...patch}})),[]);
 const drawings=useCallback((next:Drawing[])=>setState(s=>({...s,document:{...s.document,drawings:next},history:historyPush(s.history,next)})),[]);
 const undo=()=>setState(s=>{const history=historyUndo(s.history);return {...s,history,document:{...s.document,drawings:history.current}};});
 const redo=()=>setState(s=>{const history=historyRedo(s.history);return {...s,history,document:{...s.document,drawings:history.current}};});
 async function save(range:ChartLayout['range']){
  const requestEpoch=epoch.current;
  setSaving(true);setError('');
  try{
   const document=layoutSchema.parse({...state.document,range}),key=JSON.stringify({document,revision:state.revision,symbol,timeframe});
   if(retry.current?.key!==key)retry.current={key,body:{symbol,timeframe,revision:state.revision,requestId:crypto.randomUUID(),document}};
   setState(s=>({...s,document}));
   const r=await fetch('/api/core/chart',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(retry.current.body)}),data=await r.json();
   if(!r.ok)throw Error(data.error??'Unable to save layout');
   if(requestEpoch===epoch.current){setState(s=>({...s,revision:data.revision,saved:JSON.stringify(document)}));retry.current=null;}
  }catch(e){if(requestEpoch===epoch.current)setError(e instanceof Error?e.message:'Unable to save layout');}finally{setSaving(false);}
 }
 return {document:ready?state.document:defaultLayout,loaded:ready,saving,error,dirty,revision:state.revision,change,drawings,undo,redo,canUndo:state.history.undoStack.length>0,canRedo:state.history.redoStack.length>0,save,reload:()=>{if(!dirty||window.confirm('Discard unsaved chart changes and reload the saved layout?'))void load();}};
}
