import {z} from 'zod';
import {Money} from '../contracts.js';
import {normalizeSymbol,positive} from './domain.js';
import {parseReview} from './journal.js';

export type ExmochexRow={date:string,symbol:string,side:'long'|'short',entry:string,pnl:string,tags:string[],notes:string,tradeId?:string};
export type ReconcileStatus='ready'|'unmatched'|'ambiguous'|'pnl_mismatch'|'reviewed'|'duplicate'|'empty';
export type ReconciledRow={row:ExmochexRow,status:ReconcileStatus,tradeId?:string};
export type ImportTrade={id:string,closed_at:string|null,review:string,tags:string[],data:{symbol:string,side:string,entry:string,leverage?:string,quantity?:string},summary:{net:string,rMultiple?:string}};
const HEADERS=['Date','Symbol','Side','Entry','P&L ($)','Tags','Notes'];
const EXMOCHEX_HEADERS=['Date','Symbol','Side','Leverage','Entry','Exit','Size','P&L ($)','P&L (%)','R-Multiple','Tags','Notes','Screenshot'];
function cells(csv:string):string[][]{
 const rows:string[][]=[];let row:string[]=[],cell='',quoted=false,afterQuote=false;
 for(let i=0;i<csv.length;i++){
  const ch=csv[i]!;
  if(quoted){if(ch==='"'){if(csv[i+1]==='"'){cell+='"';i++;}else{quoted=false;afterQuote=true;}}else cell+=ch;continue;}
  if(afterQuote){if(ch===','||ch==='\n'||ch==='\r'){afterQuote=false;}else throw Error('Invalid CSV quote');}
  if(ch==='"'){if(cell)throw Error('Invalid CSV quote');quoted=true;}
  else if(ch===','){row.push(cell);cell='';}
  else if(ch==='\n'){row.push(cell);if(row.some(v=>v!==''))rows.push(row);row=[];cell='';}
  else if(ch==='\r'){if(csv[i+1]!=='\n')throw Error('Invalid CSV line ending');}
  else cell+=ch;
 }
 if(quoted)throw Error('Unclosed CSV quote');
 if(cell!==''||row.length){row.push(cell);rows.push(row);}
 return rows;
}
function validDay(day:string){if(!/^\d{4}-\d{2}-\d{2}$/.test(day)||new Date(day+'T00:00:00Z').toISOString().slice(0,10)!==day)throw Error('Invalid close date');return day;}
export function parseExmochexCsv(csv:string):ExmochexRow[]{
 if(Buffer.byteLength(csv,'utf8')>1048576)throw Error('CSV too large');
 const table=cells(csv.replace(/^\uFEFF/,''));if(!table.length)throw Error('CSV header required');
 const headers=table.shift()!,indexes=HEADERS.map(h=>headers.indexOf(h));if(indexes.some(i=>i<0)||new Set(headers).size!==headers.length||headers.some(h=>!EXMOCHEX_HEADERS.includes(h)&&h!=='Trade ID'))throw Error('Unsupported CSV columns');
 if(table.length>5000)throw Error('Too many CSV rows');
 return table.map(values=>{
  if(values.length!==headers.length)throw Error('CSV row length differs from header');
  const get=(key:string)=>values[headers.indexOf(key)]??'';
  const notes=get('Notes').trim();if(notes.length>4000||/^[\s]*[=+@-]/.test(notes))throw Error('Unsafe or oversized note');
  const tags=get('Tags').split(',').map(s=>s.trim().toLowerCase().replace(/\s+/g,'-')).filter(Boolean);
  const parsed=parseReview({review:notes,tags});
  const side=z.enum(['long','short']).parse(get('Side').trim().toLowerCase());
  const tradeId=get('Trade ID').trim()||undefined;if(tradeId)z.uuid().parse(tradeId);
  const pnl=get('P&L ($)').trim();if(!/^-?\d+(?:\.\d+)?$/.test(pnl))throw Error('Invalid P&L');
  return {date:validDay(get('Date').trim()),symbol:normalizeSymbol(get('Symbol')),side,entry:positive.parse(get('Entry').trim()),pnl:new Money(pnl).toDecimalPlaces(2).toFixed(2),tags:parsed.tags??[],notes:parsed.review,...(tradeId?{tradeId}:{})};
 });
}
export function reconcileJournalRows(rows:ExmochexRow[],trades:ImportTrade[]):ReconciledRow[]{
 const used=new Set<string>();
 return rows.map(row=>{
  const candidates=trades.filter(t=>t.closed_at&&(!row.tradeId||t.id===row.tradeId)&&t.closed_at.slice(0,10)===row.date&&t.data.symbol===row.symbol&&t.data.side===row.side&&new Money(t.data.entry).eq(row.entry));
  if(!candidates.length)return {row,status:'unmatched'};
  if(candidates.length>1)return {row,status:'ambiguous'};
  const trade=candidates[0]!;
  if(!new Money(trade.summary.net).toDecimalPlaces(2).eq(row.pnl))return {row,status:'pnl_mismatch',tradeId:trade.id};
  if(used.has(trade.id))return {row,status:'duplicate',tradeId:trade.id};used.add(trade.id);
  if(trade.review.trim()||trade.tags.length)return {row,status:'reviewed',tradeId:trade.id};
  if(!row.notes&&row.tags.length===0)return {row,status:'empty',tradeId:trade.id};
  return {row,status:'ready',tradeId:trade.id};
 });
}
function csvCell(value:string,numeric=false){
 const safe=numeric?value:/^[\s]*[=+@-]/.test(value)?"'"+value:value;
 return '"'+safe.replaceAll('"','""')+'"';
}
export function exportJournalCsv(trades:ImportTrade[]):string{
 const header=[...EXMOCHEX_HEADERS,'Trade ID'].join(',');
 const rows=trades.filter(t=>t.closed_at).map(t=>[
  csvCell(t.closed_at!.slice(0,10)),csvCell(t.data.symbol),csvCell(t.data.side),csvCell(t.data.leverage?t.data.leverage+'x':''),csvCell(t.data.entry,true),csvCell(''),csvCell(t.data.quantity??'',true),csvCell(new Money(t.summary.net).toDecimalPlaces(2).toFixed(2),true),csvCell(''),csvCell(t.summary.rMultiple??'',true),csvCell(t.tags.join(', ')),csvCell(t.review),csvCell(''),csvCell(t.id)
 ].join(','));
 return [header,...rows].join('\r\n')+'\r\n';
}
