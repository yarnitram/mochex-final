import { test } from 'node:test';
import assert from 'node:assert/strict';
import { marketQuery,parseFuturesCandles } from '../src/core/market.js';
import { calculateEma } from '../src/core/chart/ema.js';
import { calculatePricePrecision } from '../src/core/chart/price-precision.js';
test('C-06/07: Mochex extracted EMA/precision and futures-only feed',()=>{
 assert.equal(calculateEma(Array.from({length:21},(_,i)=>i+1),20)[20],11.5);
 assert.equal(calculatePricePrecision(.000012).precision,8);
 assert.equal(marketQuery('BTC_USDT','15m').url,'https://contract.mexc.com/api/v1/contract/kline/BTC_USDT?interval=Min15');
 assert.throws(()=>marketQuery('BTC_USDT','bogus'));
 const good={success:true,data:{time:[1794960000],open:[100],high:[102],low:[99],close:[101],vol:[15]}};
 assert.equal(parseFuturesCandles(good)[0]?.time,1794960000);
 assert.throws(()=>parseFuturesCandles({...good,data:{...good.data,low:[103]}}));
 assert.throws(()=>parseFuturesCandles({success:false}));
});
