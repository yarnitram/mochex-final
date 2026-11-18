import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {layoutSchema,defaultLayout,historyPush,historyUndo,historyRedo,calculateFibLevels,sma,rsi} from '../src/core/chart/workspace.js';
const drawing=(price=100)=>({id:randomUUID(),type:'horizontal_line' as const,startTime:1795000000,endTime:1795000000,startPrice:price,endPrice:price,color:'#58d6af',name:'Level',hidden:false,locked:false});
test('A-01/04: strict UTC-second chart documents reject duplicate IDs and invalid geometry',()=>{
 const d=drawing();assert.equal(layoutSchema.parse({...defaultLayout,drawings:[d]}).drawings.length,1);
 assert.throws(()=>layoutSchema.parse({...defaultLayout,drawings:[d,d]}));
 assert.throws(()=>layoutSchema.parse({...defaultLayout,drawings:[{...d,startTime:1795000000000}]}));
 assert.throws(()=>layoutSchema.parse({...defaultLayout,drawings:[{...d,startPrice:Infinity}]}));
 assert.throws(()=>layoutSchema.parse({...defaultLayout,drawings:[{...d,type:'rectangle'}]}));
 assert.throws(()=>layoutSchema.parse({...defaultLayout,ownerId:randomUUID()}));
});
test('A-01/02: Mochex fib orientation and50-step undo/redo semantics',()=>{
 assert.deepEqual(calculateFibLevels(100,110).map(x=>x.price).slice(0,4),[110,107.64,106.18,105]);
 let state={current:[] as any[],undoStack:[] as any[][],redoStack:[] as any[][]};
 for(let i=0;i<60;i++)state=historyPush(state,[drawing(i+1)]);
 assert.equal(state.undoStack.length,50);
 state=historyUndo(state);assert.equal(state.current[0].startPrice,59);
 state=historyRedo(state);assert.equal(state.current[0].startPrice,60);
 state=historyPush(historyUndo(state),[drawing(80)]);assert.equal(state.redoStack.length,0);
});
test('A-05: SMA and Wilder RSI retain warmup and reference values',()=>{
 assert.deepEqual(sma([1,2,3,4,5],3),[null,null,2,3,4]);
 assert.equal(rsi(Array.from({length:20},(_,i)=>i+1),14)[14],100);
 assert.equal(rsi(Array(20).fill(10),14)[14],50);
 const values=[44.34,44.09,44.15,43.61,44.33,44.83,45.10,45.42,45.84,46.08,45.89,46.03,45.61,46.28,46.28,46.00];
 assert.ok(Math.abs(rsi(values,14)[14]!-70.464135)<0.00001);
 assert.ok(Math.abs(rsi(values,14)[15]!-66.249619)<0.00001);
});
