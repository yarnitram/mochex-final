import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createInitialMultiChartState,getVisiblePanes,setGridLayoutMode,updateActivePaneSymbol,updateActivePaneResolution,toggleGridSyncOption,toggleMaximizePane} from '../src/core/chart/grid.js';

test('G-01: Mochex grid presets keep four native perpetual pane contexts',()=>{
 const start=createInitialMultiChartState();
 assert.deepEqual(start.panes.map(p=>[p.symbol,p.resolution]),[['BTC_USDT','15m'],['ETH_USDT','1h'],['SOL_USDT','4h'],['BTC_USDT','1d']]);
 assert.equal(getVisiblePanes(start).length,1);
 const quad=setGridLayoutMode(start,'2x2');assert.equal(getVisiblePanes(quad).length,4);
 assert.equal(getVisiblePanes(setGridLayoutMode(quad,'2x1')).length,2);
});
test('G-02: active pane and opt-in symbol/interval sync do not change other markets silently',()=>{
 let state=setGridLayoutMode(createInitialMultiChartState(),'2x2');
 state=updateActivePaneSymbol(state,'XRP_USDT','pane-1');assert.equal(state.panes[0]!.symbol,'BTC_USDT');assert.equal(state.panes[1]!.symbol,'XRP_USDT');
 state={...state,activePaneId:'pane-1'};state=toggleGridSyncOption(state,'syncSymbol');assert.ok(state.panes.every(p=>p.symbol==='XRP_USDT'));
 state=updateActivePaneResolution(state,'1d');assert.equal(state.panes[0]!.resolution,'15m');
 state=toggleGridSyncOption(state,'syncInterval');assert.ok(state.panes.every(p=>p.resolution==='1d'));
 state=toggleMaximizePane(state,'pane-2');assert.equal(state.maximizedPaneId,'pane-2');state=toggleMaximizePane(state,'pane-2');assert.equal(state.maximizedPaneId,null);
 assert.throws(()=>updateActivePaneSymbol(state,'BTCUSDT'));assert.throws(()=>updateActivePaneResolution(state,'1W'));
});
