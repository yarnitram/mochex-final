import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {Pool} from 'pg';
import {readLayout,saveLayout} from '../src/core/chart-store.js';
import {defaultLayout} from '../src/core/chart/workspace.js';
import {withOwner} from '../src/server/store.js';
const db=new Pool({connectionString:process.env.DATABASE_URL!}),admin=new Pool({connectionString:process.env.TEST_ADMIN_DATABASE_URL!});
const a=process.env.FIXTURE_A_ID!,b=process.env.FIXTURE_B_ID!;
const context={symbol:'CHARTTEST_USDT',timeframe:'15m'};
const document={...defaultLayout,drawings:[{id:randomUUID(),type:'horizontal_line',startTime:1795000000,endTime:1795000000,startPrice:100,endPrice:100,color:'#58d6af',name:'Support',hidden:false,locked:false}],sma:[20],rsi:true,range:{from:20,to:90}};
after(async()=>{await db.end();await admin.end();});
test('A-03/04: exact retries, context and owner isolation survive layout reload',async()=>{
 const input={...context,revision:0,requestId:randomUUID(),document};
 assert.equal((await saveLayout(db,a,input)).revision,1);assert.equal((await saveLayout(db,a,input)).revision,1);
 assert.equal((await readLayout(db,a,context)).document.drawings[0].name,'Support');
 assert.equal((await readLayout(db,b,context)).revision,0);
 assert.equal((await readLayout(db,a,{...context,timeframe:'1h'})).revision,0);
 await assert.rejects(()=>saveLayout(db,a,{...input,document:{...document,rsi:false}}),/retry changed/);
 await assert.rejects(()=>saveLayout(db,a,{...input,requestId:randomUUID()}),/changed elsewhere/);
 await withOwner(db,b,async c=>assert.equal((await c.query('SELECT * FROM core_chart_layouts WHERE owner_id=$1',[a])).rowCount,0));
 await saveLayout(db,b,{...input,document:defaultLayout});
 await assert.rejects(()=>withOwner(db,b,c=>c.query("UPDATE core_chart_layouts SET owner_id=$1 WHERE symbol='CHARTTEST_USDT'",[a])),{code:'42501'});
});
test('A-04: concurrent layout writes allow one winner without lost update',async()=>{
 const base={symbol:'CHARTCAS_USDT',timeframe:'15m',revision:0,document:defaultLayout};
 const settled=await Promise.allSettled(Array.from({length:8},()=>saveLayout(db,a,{...base,requestId:randomUUID()})));
 assert.equal(settled.filter(r=>r.status==='fulfilled').length,1);assert.equal((await readLayout(db,a,{symbol:base.symbol,timeframe:base.timeframe})).revision,1);
});
test('A-04: failed DB write leaves the prior chart document intact',async()=>{
 const symbol='CHARTFAULT_USDT',base={symbol,timeframe:'15m',revision:0,requestId:randomUUID(),document:defaultLayout};
 await saveLayout(db,a,base);
 await admin.query("ALTER TABLE core_chart_layouts ADD CONSTRAINT chart_fault CHECK(symbol<>'CHARTFAULT_USDT' OR revision<2) NOT VALID");
 try{await assert.rejects(()=>saveLayout(db,a,{...base,revision:1,requestId:randomUUID(),document:{...defaultLayout,rsi:true}}));}
 finally{await admin.query('ALTER TABLE core_chart_layouts DROP CONSTRAINT chart_fault');}
 const stored=await readLayout(db,a,{symbol,timeframe:'15m'});assert.equal(stored.revision,1);assert.equal(stored.document.rsi,false);
});
