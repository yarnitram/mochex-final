import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { emaClosed, normalizeCandles, replayLedger } from '../src/domain.js';
const golden = JSON.parse(readFileSync(new URL('../fixtures/partial-exits-v1.json',import.meta.url),'utf8'));
const candles = JSON.parse(readFileSync(new URL('../fixtures/candles-v1.json',import.meta.url),'utf8'));
test('D-05 R-07: closed EMA has SMA warmup and known next value', () => {
  const values=emaClosed(candles.closes,20);
  assert.equal(values.slice(0,19).every(x=>x===null),true);
  assert.equal(values[19],10.5);
  assert.equal(values[20],11.5);
  assert.throws(()=>emaClosed([1,NaN],1));
  assert.throws(()=>emaClosed([1],0));
});
test('D-05 R-02: normalize closed candles, detect conflicting duplicates, gaps and future bars', () => {
  const a={openTimeMs:1800000000000,open:'100',high:'102',low:'99',close:'101',volume:'1'};
  const b={...a,openTimeMs:a.openTimeMs+60000};
  assert.deepEqual(normalizeCandles([b,a,a],60000,b.openTimeMs+60000),[a,b]);
  assert.throws(()=>normalizeCandles([a,{...a,close:'100'}],60000,b.openTimeMs+60000));
  assert.throws(()=>normalizeCandles([a,{...b,openTimeMs:b.openTimeMs+60000}],60000,b.openTimeMs+120000));
  assert.throws(()=>normalizeCandles([a],60000,a.openTimeMs+1));
  assert.throws(()=>normalizeCandles([{...a,low:'103'}],60000,b.openTimeMs));
});
test('D-05 R-04: partial exit and break-even reconcile to 30 gross / 1.5R', () => {
  const result=replayLedger(golden.side,golden.initialRisk,golden.fills);
  assert.equal(result.grossPnl,'30'); assert.equal(result.netPnl,'30');
  assert.equal(result.remainingQuantity,'0'); assert.equal(result.rMultiple,'1.5');
  assert.equal(result.fillKeys.length,3);
});
test('D-05 R-03: duplicate fills are idempotent but conflicting identity fails', () => {
  assert.deepEqual(replayLedger('long','20',[...golden.fills,...golden.fills]),replayLedger('long','20',golden.fills));
  assert.throws(()=>replayLedger('long','20',[...golden.fills,{...golden.fills[1],price:'107'}]));
});
test('D-05 R-04: fees, runner exit and short direction reconcile', () => {
  const fees=golden.fills.map((f:any,i:number)=>({...f,fee:i===0?'1':'0.5'}));
  assert.equal(replayLedger('long','20',fees).netPnl,'28');
  assert.equal(replayLedger('long','20',fees).rMultiple,'1.4');
  assert.equal(replayLedger('long','20',[...golden.fills.slice(0,2),{...golden.fills[2],price:'110'}]).grossPnl,'80');
  const short=golden.fills.map((f:any)=>({...f,price:String(200-Number(f.price))}));
  assert.equal(replayLedger('short','20',short).grossPnl,'30');
});
test('D-05 R-04/R-05: overfills, mixed identities and non-quote fees fail closed', () => {
  for (const change of [{quantity:'6'},{ownerId:'other'},{tradeId:'other'},{feeCurrency:'BTC'},
    {provenance:'manually-reported'},{instrument:{...golden.fills[2].instrument,exchange:'bybit'}}]) {
    assert.throws(()=>replayLedger('long','20',[...golden.fills.slice(0,2),{...golden.fills[2],...change}]));
  }
  assert.throws(()=>replayLedger('long','20',[golden.fills[1]]));
});
test('D-05 R-04: decimal multiplication avoids binary rounding and extra leverage', () => {
  const fills=[{...golden.fills[0],quantity:'0.1',price:'0.1'},
    {...golden.fills[1],quantity:'0.1',price:'0.3'}];
  assert.equal(replayLedger('long','1',fills).grossPnl,'0.02');
});
test('D-05 R-07: replay is invariant to arrival order and duplicate multiplicity', () => {
  for(let n=1;n<=20;n++){
    const mixed=Array.from({length:n},()=>golden.fills).flat().reverse();
    assert.deepEqual(replayLedger('long','20',mixed),replayLedger('long','20',golden.fills));
  }
});
