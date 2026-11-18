import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import { emaClosed, replayLedger } from '../src/domain.js';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const sources=process.env.MOCHEX_SOURCES_ROOT ?? resolve(root,'..');
const load=async(relative:string)=>import(pathToFileURL(resolve(sources,relative)).href);
const fixture=JSON.parse(readFileSync(resolve(root,'fixtures/candles-v1.json'),'utf8'));
const golden=JSON.parse(readFileSync(resolve(root,'fixtures/partial-exits-v1.json'),'utf8'));
const charts=await load('Mochex/src/lib/indicators/mtf-ema/ema-calculator.ts');
const bot=await load('mochbot/src/strategy/indicators.ts');
const ex=await load('EXMOCHEX/src/lib/calculations.ts');
const closes:number[]=fixture.closes;
const bars=closes.map((c,i)=>({t:1800000000+i*60,o:c,h:c,l:c,c,v:1}));
const canonical=emaClosed(closes,fixture.period);
const chartResult=charts.calculateEma(closes,fixture.period);
const botResult=bot.ema(bars,fixture.period).map((v:number)=>Number.isNaN(v)?null:v);
assert.deepEqual(chartResult,canonical);
assert.deepEqual(botResult,canonical);
const python=process.env.PYTHON ?? 'python';
const py=JSON.parse(execFileSync(python,['-I','-c',
  "import runpy,json,sys; from decimal import Decimal; v=json.loads(sys.argv[3]); legacy=runpy.run_path(sys.argv[1])['ema'](v,20); E=runpy.run_path(sys.argv[2])['ClosedEMA']; e=E(20); out=[]; [(e.close(Decimal(str(x))),out.append(None if e.value is None else float(e.value))) for x in v]; print(json.dumps({'legacy':legacy,'closed':out}))",
  resolve(sources,'Emalert/app/ema.py'),resolve(sources,'Emalert/app/indicator.py'),JSON.stringify(closes)],
  {encoding:'utf8'}));
for(let i=0;i<canonical.length;i++){
  if(canonical[i]===null)assert.equal(py.closed[i],null);
  else assert.ok(Math.abs(canonical[i]!-py.closed[i])<1e-10);
}
assert.notEqual(py.legacy.at(-1),canonical.at(-1));
const ledger=replayLedger('long','20',golden.fills);
const twoLegs=ex.pnlDollars({direction:'long',entry_price:100,exit_price:106,size:5,fees:0})
  +ex.pnlDollars({direction:'long',entry_price:100,exit_price:100,size:5,fees:0});
const finalExitOnly=ex.pnlDollars({direction:'long',entry_price:100,exit_price:100,size:10,fees:0});
assert.equal(String(twoLegs),ledger.grossPnl);
assert.notEqual(String(finalExitOnly),ledger.grossPnl);
console.log(JSON.stringify({
  fixture:'synthetic closes 1..21, period20; 10@100 -> 5@106 + 5@100',
  ema:{terminal:canonical.at(-1),charts:chartResult.at(-1),mochbot:botResult.at(-1),
    emalertClosed:py.closed.at(-1),emalertLegacy:py.legacy.at(-1)},
  pnl:{terminal:ledger.grossPnl,exmochexTwoLegs:twoLegs,exmochexFinalExitOnly:finalExitOnly},
  verdict:'PASS; legacy seed and omitted partial-exit differences explicitly observed'
},null,2));
