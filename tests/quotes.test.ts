import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCatalogue,parseTickers,quoteState,crossings } from '../src/core/quotes.js';
import { cachedLoader } from '../src/core/market-provider.js';
test('Q-02: shared loads deduplicate and back off failures without serving old quotes',async()=>{
 let count=0,clock=1000;const load=cachedLoader(async()=>{count++;await Promise.resolve();return count;},5000,()=>clock);
 assert.deepEqual(await Promise.all([load(),load(),load()]),[1,1,1]);assert.equal(count,1);
 clock=6001;assert.equal(await load(),2);
 let attempts=0;const failed=cachedLoader(async()=>{attempts++;throw Error('offline');},5000,()=>clock);
 await assert.rejects(failed);await assert.rejects(failed);assert.equal(attempts,1);
 clock+=5001;await assert.rejects(failed);assert.equal(attempts,2);
});
const now=1795000000000;
const contract={symbol:'BTC_USDT',baseCoin:'BTC',quoteCoin:'USDT',settleCoin:'USDT',state:0,isHidden:false,futureType:1};
test('Q-01: active USDT perpetual discovery preserves multiplier bases',()=>{
 const list=parseCatalogue({success:true,data:[contract,{...contract,symbol:'1000PEPE_USDT',baseCoin:'1000PEPE'},{...contract,symbol:'ETH_USDT',state:4},{...contract,symbol:'X_USDT',isHidden:true},{...contract,symbol:'BTC_USD',quoteCoin:'USD'}]});
 assert.deepEqual(list.map(x=>x.symbol),['1000PEPE_USDT','BTC_USDT']);
 assert.throws(()=>parseCatalogue({success:false}));
});
test('Q-02: ticker values retain identity, freshness and turnover semantics',()=>{
 const q=parseTickers({success:true,data:[{symbol:'BTC_USDT',lastPrice:100.25,riseFallRate:-0.015,amount24:20000,timestamp:now}]}).BTC_USDT!;
 assert.equal(q.price,'100.25');assert.equal(q.changePct,'-1.5');assert.equal(q.turnover,'20000');
 assert.equal(quoteState(q,now),'live');assert.equal(quoteState(q,now+30001),'stale');
 assert.equal(quoteState({...q,time:now+5001},now),'future');assert.equal(quoteState(undefined,now),'missing');
 assert.equal(parseTickers({success:true,data:[{symbol:'BTC_USDT',lastPrice:0,timestamp:now}]}).BTC_USDT,undefined);
 assert.throws(()=>parseTickers({success:true,data:[{symbol:'BTC_USDT',lastPrice:1,riseFallRate:0,amount24:1,timestamp:now},{symbol:'BTC_USDT',lastPrice:2,riseFallRate:0,amount24:1,timestamp:now}]}));
});
test('Q-04/05: equality crossings, direction and discontinuities are deterministic',()=>{
 const rules=[{kind:'trigger' as const,direction:'above' as const,level:'100'}];
 const sample=(price:string,time:number)=>({symbol:'BTC_USDT',price,time,changePct:'0',turnover:'0'});
 assert.deepEqual(crossings(rules,null,sample('101',now),now),[]);
 assert.deepEqual(crossings(rules,sample('99',now),sample('100',now+1000),now+1000),['trigger']);
 assert.deepEqual(crossings(rules,sample('100',now),sample('101',now+1000),now+1000),[]);
 assert.deepEqual(crossings(rules,sample('99',now),sample('101',now+31000),now+31000),[]);
 assert.deepEqual(crossings(rules,sample('99',now),sample('101',now-1),now),[]);
 assert.deepEqual(crossings(rules,sample('99',now-40000),sample('101',now-39000),now),[]);
 assert.deepEqual(crossings([{kind:'stop',direction:'below',level:'98'}],sample('100',now),sample('98',now+1000),now+1000),['stop']);
 assert.deepEqual(crossings([{kind:'target',direction:'below',level:'90'}],sample('91',now),sample('89',now+1000),now+1000),['target']);
 const replay=['99','100','101','99','100'].flatMap((p,i,a)=>i?crossings(rules,sample(a[i-1]!,now+(i-1)*1000),sample(p,now+i*1000),now+i*1000):[]);
 assert.deepEqual(replay,['trigger','trigger']);
});
