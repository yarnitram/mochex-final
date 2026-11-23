import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseExmochexCsv,reconcileJournalRows,exportJournalCsv} from '../src/core/journal-import.js';

const trade={id:'11111111-1111-4111-8111-111111111111',closed_at:'2026-11-19T02:00:00Z',review:'',tags:[],data:{symbol:'BTC_USDT',side:'long',entry:'100',strategy:'Pullback',notes:'Plan'},summary:{net:'28',rMultiple:'1.4'}};
const header='Date,Symbol,Side,Entry,P&L ($),Tags,Notes';
test('J-06: sanitized EXMOCHEX CSV parses quotes and rejects unsafe or oversized input',()=>{
 const rows=parseExmochexCsv(header+'\n2026-11-19,BTC_USDT,long,100,28,"patience, risk-control","Kept plan, took partial"\n');
 assert.equal(rows[0]?.notes,'Kept plan, took partial');assert.deepEqual(rows[0]?.tags,['patience','risk-control']);
 assert.throws(()=>parseExmochexCsv(header+'\n2026-11-19,BTC_USDT,long,100,28,tag,"unclosed\n'));
 assert.throws(()=>parseExmochexCsv(header+'\n2026-11-19,BTC_USDT,long,100,28,tag,=cmd\n'));
 const sourceFixture=readFileSync(new URL('../fixtures/exmochex-journal-sanitized.csv',import.meta.url),'utf8');
 const full=parseExmochexCsv(sourceFixture);assert.equal(full[0]?.symbol,'BTC_USDT');assert.equal(full[0]?.notes,'Kept the plan, took partial exits');
});
test('J-07: import matches one exact ledger outcome and cannot overwrite a review',()=>{
 const rows=parseExmochexCsv(header+'\n2026-11-19,BTC_USDT,long,100,28,patience,Learned\n');
 assert.equal(reconcileJournalRows(rows,[trade])[0]?.status,'ready');
 assert.equal(reconcileJournalRows(rows,[{...trade,review:'Existing'}])[0]?.status,'reviewed');
 assert.equal(reconcileJournalRows(rows,[trade,{...trade,id:'22222222-2222-4222-8222-222222222222'}])[0]?.status,'ambiguous');
 assert.equal(reconcileJournalRows(rows,[{...trade,summary:{...trade.summary,net:'27'}}])[0]?.status,'pnl_mismatch');
 assert.equal(reconcileJournalRows(rows,[])[0]?.status,'unmatched');
});
test('J-08: export preserves EXMOCHEX columns and neutralizes spreadsheet formulas',()=>{
 const csv=exportJournalCsv([{...trade,review:'=HYPERLINK("bad")',tags:['patience']}]);
 assert.match(csv,/Date,Symbol,Side,Leverage,Entry,Exit,Size,P&L \(\$\),P&L \(%\),R-Multiple,Tags,Notes,Screenshot,Trade ID/);
 assert.match(csv,/'=HYPERLINK/);
 assert.match(csv,/BTC_USDT/);
});
