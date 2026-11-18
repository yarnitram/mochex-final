import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeSymbol,validatePlan,positionSummary } from '../src/core/domain.js';
const plan={symbol:'BTC_USDT',side:'long',entry:'100',stop:'98',target:'110',trigger:'100',timeframe:'15m',strategy:'Pullback',notes:''} as const;
test('C-01: normalize native futures symbols without stripping multiplier bases',()=>{
 assert.equal(normalizeSymbol('btc/usdt'),'BTC_USDT');assert.equal(normalizeSymbol('1000PEPEUSDT'),'1000PEPE_USDT');
 assert.throws(()=>normalizeSymbol('BTCUSD'));assert.throws(()=>normalizeSymbol('bad/../USDT'));
});
test('C-01: explicit directional validation',()=>{
 assert.equal(validatePlan(plan).side,'long');
 for(const change of [{stop:'101'},{target:'99'},{entry:'0'},{entry:100},{side:'short'}])assert.throws(()=>validatePlan({...plan,...change}));
 assert.equal(validatePlan({...plan,side:'short',stop:'102',target:'90'}).side,'short');
});
test('C-03: partial exits, fees and R conserve quantity without extra leverage',()=>{
 const trade={...plan,quantity:'10',entryFee:'1'};
 const exits=[{quantity:'5',price:'106',fee:'0.5'},{quantity:'5',price:'100',fee:'0.5'}];
 const result=positionSummary(trade,exits);
 assert.equal(result.remaining,'0');assert.equal(result.gross,'30');assert.equal(result.net,'28');assert.equal(result.rMultiple,'1.4');
 assert.throws(()=>positionSummary(trade,[...exits,{quantity:'1',price:'100',fee:'0'}]));
 const short=positionSummary({...trade,side:'short',stop:'102'},[{quantity:'10',price:'95',fee:'0'}]);
 assert.equal(short.net,'49');
});
