import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {calculateFibLevels,extrapolateCoordinateToTime,extrapolateTimeToCoordinate,historyPush,historyUndo,historyRedo,type DrawingHistoryState,type Drawing} from '../src/core/chart/workspace.js';
const source=resolve(process.env.MOCHEX_SOURCES_ROOT??fileURLToPath(new URL('../../',import.meta.url)),'Mochex');
const head=execFileSync('git',['-C',source,'rev-parse','HEAD'],{encoding:'utf8',windowsHide:true}).trim();
assert.ok(head.startsWith('5642f5c'),'Source changed; re-audit before comparing');
execFileSync('git',['-C',source,'diff','--exit-code','HEAD','--','src/lib/chart/drawing-math.ts'],{stdio:'pipe',windowsHide:true});
const legacy=await import(pathToFileURL(resolve(source,'src/lib/chart/drawing-math.ts')).href);
for(const [a,b] of [[100,110],[110,100],[.001,.002]] as const)assert.deepEqual(calculateFibLevels(a,b),legacy.calculateFibLevels(a,b));
assert.equal(extrapolateCoordinateToTime(120,1795000000,100,5,900),legacy.extrapolateCoordinateToTime(120,1795000000,100,5,900));
assert.equal(extrapolateTimeToCoordinate(1795003600,1795000000,100,5,900),legacy.extrapolateTimeToCoordinate(1795003600,1795000000,100,5,900));
let current:DrawingHistoryState={current:[],undoStack:[],redoStack:[]},old:any={current:[],undoStack:[],redoStack:[]};
for(let i=0;i<60;i++){
 const d:Drawing={id:'00000000-0000-4000-8000-'+String(i).padStart(12,'0'),type:'horizontal_line',startTime:1795000000,endTime:1795000000,startPrice:i+1,endPrice:i+1,color:'#58d6af',name:'Synthetic',hidden:false,locked:false};
 current=historyPush(current,[d]);old=legacy.pushDrawingHistory(old,[d]);assert.deepEqual(current,old);
}
assert.deepEqual(historyUndo(current),legacy.performDrawingUndo(old));assert.deepEqual(historyRedo(historyUndo(current)),legacy.performDrawingRedo(legacy.performDrawingUndo(old)));
console.log('Chart extraction parity passed against clean Mochex5642f5c: Fibonacci, coordinate projection and50-step history.');
