import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { resolve,dirname } from 'node:path';
import { fileURLToPath,pathToFileURL } from 'node:url';
import { readFileSync } from 'node:fs';
import { adaptMochbot,MOCHBOT_REVISION,transitionDecision } from '../src/adapters/mochbot.js';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const source=resolve(process.env.MOCHEX_SOURCES_ROOT??resolve(root,'..'),'mochbot');
assert.equal(execFileSync('git',['-C',source,'rev-parse','HEAD'],{encoding:'utf8'}).trim(),MOCHBOT_REVISION);
assert.equal(execFileSync('git',['-C',source,'status','--porcelain','--','src/strategy/mod01e.ts','src/strategy/indicators.ts','src/types.ts'],{encoding:'utf8'}).trim(),'','Pinned pure calculation files must be clean');
const evaluator=await import(pathToFileURL(resolve(source,'src/strategy/mod01e.ts')).href);
const types=await import(pathToFileURL(resolve(source,'src/types.ts')).href);
const configuration={...types.DEFAULT_MOD01E_CFG,biasPivotLen:1,alignPivotLen:1,entryPivotLen:1,requireAlignment:false,useKillzone:false,entryFib:0.2,cancelBiasFlip:false,cancelNewChoch:false};
evaluator.validateMod01eConfig(configuration);
const template=JSON.parse(readFileSync(resolve(root,'fixtures/mochbot-mod01e.json'),'utf8'));
const start=Date.parse('2026-11-16T00:00:00.000Z')/1000;
let result:any=null;const diagnostics:unknown[]=[];
for(let variant=0;variant<6&&!result;variant++){
 let seed=42+variant,value=100;
 const closes=Array.from({length:6000},()=>{
  seed=(Math.imul(seed,1664525)+1013904223)>>>0;
  value=Math.max(10,value+(seed/4294967296-.48)*2);return value;
 });
 const candles=closes.map((c,i)=>({t:start+i*60,o:closes[Math.max(0,i-1)]!,h:Math.max(c,closes[Math.max(0,i-1)]!)+.05+(i*17%7)*.001,l:Math.min(c,closes[Math.max(0,i-1)]!)-.05-(i*13%11)*.001,c,v:100}));
 const scan=evaluator.scanMod01e(candles,undefined,configuration);
 diagnostics.push({variant,signals:scan.signals.length,pending:!!scan.pendingOrder,bias:scan.biasTrend,alignment:scan.alignTrend,reason:scan.reason});
 for(const signal of scan.signals){
  const armed=evaluator.evaluateMod01e('BTC_USDT',candles.slice(0,signal.barIndex),null,undefined,configuration);
  const ready=evaluator.evaluateMod01e('BTC_USDT',candles.slice(0,signal.barIndex+1),null,undefined,configuration);
  if(armed.stage==='ARMED'&&ready.stage==='ENTRY_READY'&&armed.setupId===ready.setupId){
   const envelope=(snapshot:unknown,revision:number,ts:number)=>({...template,configuration,snapshot,revision,capturedAt:new Date(ts*1000+1000).toISOString()});
   const before=adaptMochbot(envelope(armed,0,armed.ts)),after=adaptMochbot(envelope(ready,1,ready.ts));
   assert.equal(before.kind,'observation');assert.equal(after.kind,'observation');
   if(before.kind!=='observation'||after.kind!=='observation')throw Error();
   assert.equal(transitionDecision({revision:0,state:'armed',plan:before.event.plan,observedAt:before.event.observedAt},after.event),'apply');
   assert.deepEqual(before.event.plan,after.event.plan);
   assert.equal(before.event.plan!.levels.entry,String(armed.entry));
   assert.deepEqual(adaptMochbot(envelope(armed,0,armed.ts)),before);
   result={variant,candlePrefix:signal.barIndex+1,setupId:armed.setupId,states:[armed.stage,ready.stage],levels:before.event.plan!.levels,configurationVersion:before.event.configurationVersion};
   break;
  }
 }
}
assert.ok(result,'Synthetic fixture must exercise actual ARMED -> ENTRY_READY source output: '+JSON.stringify(diagnostics));
console.log(JSON.stringify({sourceRevision:MOCHBOT_REVISION,evidence:result,verdict:'PASS: pinned pure source output adapts deterministically without fills, services, network or future bars'},null,2));
