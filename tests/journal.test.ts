import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseReview,journalSummary,filterJournal} from '../src/core/journal.js';

test('J-01: review tags normalize and reject duplicates, excessive or malformed values',()=>{
 assert.deepEqual(parseReview({review:'Stayed patient',tags:[' Patience ','risk-control']}).tags,['patience','risk-control']);
 assert.throws(()=>parseReview({review:'',tags:['Plan','plan']}));
 assert.throws(()=>parseReview({review:'',tags:Array.from({length:9},(_,i)=>'tag-'+i)}));
 assert.throws(()=>parseReview({review:'',tags:['unsafe tag!']}));
 assert.throws(()=>parseReview({review:'',tags:[],ownerId:'spoof'}));
});
test('J-02: journal filters and summaries use only matching closed trades',()=>{
 const rows=[
  {id:'a',closed_at:'2026-11-18T00:00:00Z',review:'Patient',tags:['patience'],data:{symbol:'BTC_USDT',strategy:'Breakout',notes:''},summary:{net:'28',rMultiple:'1.4'}},
  {id:'b',closed_at:'2026-11-19T00:00:00Z',review:'Late entry',tags:['late'],data:{symbol:'ETH_USDT',strategy:'Pullback',notes:''},summary:{net:'-8',rMultiple:'-0.4'}},
  {id:'c',closed_at:null,review:'',tags:[],data:{symbol:'SOL_USDT',strategy:'Breakout',notes:''},summary:{net:'100',rMultiple:'5'}},
 ];
 const all=filterJournal(rows,{query:'',tag:'all',outcome:'all'});
 assert.deepEqual(all.map(x=>x.id),['a','b']);
 assert.deepEqual(journalSummary(all),{count:2,wins:1,net:'20',averageR:'0.5',winRate:50});
 assert.deepEqual(filterJournal(rows,{query:'patient',tag:'patience',outcome:'win'}).map(x=>x.id),['a']);
 assert.deepEqual(filterJournal(rows,{query:'',tag:'all',outcome:'loss'}).map(x=>x.id),['b']);
});
