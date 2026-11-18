import { test } from 'node:test';
import assert from 'node:assert/strict';
import { adaptMochbot,validateObservation,transitionDecision } from '../src/adapters/mochbot.js';
import { observation } from '../fixtures/mochbot-observation.js';
test('S3-01/02: confirmed MOD-01E geometry, timestamps and configuration are deterministic',()=>{
 const raw=observation(undefined,0,'armed',Date.parse('2026-11-18T00:16:00Z'));
 const first=adaptMochbot(raw);assert.equal(first.kind,'observation');
 if(first.kind!=='observation')throw Error('Expected observation');
 const event=first.event;
 assert.equal(event.schemaVersion,2);assert.equal(event.proposedState,'armed');
 assert.deepEqual(event.plan?.levels,{entry:'103.82',stop:'99.7',tp1:'116.18',tp2:'124.42'});
 assert.equal(event.observedAt,new Date(raw.snapshot.ts*1000).toISOString());
 assert.equal(event.configurationVersion.length,64);
 assert.deepEqual(adaptMochbot(structuredClone(raw)),first);
 assert.equal(validateObservation(event).schemaVersion,2);
 assert.throws(()=>validateObservation({...event,plan:{...event.plan!,expiresAt:event.plan!.confirmedAt}}));
 assert.throws(()=>validateObservation({...event,externalSetupId:'BTC_USDT:01E:SHORT:1794960000'}));
});
test('S3-02: reject incompatible source, market, config and geometry',()=>{
 const raw=observation();
 for(const update of [
  {sourceRevision:'unknown'},
  {configuration:{...raw.configuration,rrTP2:1}},
  {instrument:{...raw.instrument,exchange:'bybit'}},
  {snapshot:{...raw.snapshot,sl:110}},
  {snapshot:{...raw.snapshot,entry:104}},
  {snapshot:{...raw.snapshot,tp1:110}},
  {snapshot:{...raw.snapshot,direction:'SHORT'}},
  {snapshot:{...raw.snapshot,entry:Infinity}},
  {snapshot:{...raw.snapshot,ltfMinutes:1}},
 ])assert.throws(()=>adaptMochbot({...raw,...update}));
});
test('S3-01: WATCH and IDLE never become a confirmed setup or fill',()=>{
 const raw=observation();
 assert.equal(adaptMochbot({...raw,snapshot:{...raw.snapshot,stage:'WATCH',setupId:'01E:WATCH:LONG:110',orderStatus:undefined}}).kind,'ignored');
 assert.equal(adaptMochbot({...raw,snapshot:{...raw.snapshot,stage:'IDLE',setupId:null,orderStatus:undefined}}).kind,'ignored');
});
test('S3-03/04: revision order, timestamps, geometry and terminal states are guarded',()=>{
 const event=(state='armed',revision=0)=>{const r=adaptMochbot(observation(undefined,revision,state));if(r.kind!=='observation')throw Error();return r.event;};
 const root=event(),ready=event('entry-ready',1);
 assert.equal(transitionDecision(null,root),'apply');
 assert.equal(transitionDecision(null,{...root,observedAt:root.plan!.expiresAt}),'expired-plan');
 assert.equal(transitionDecision(null,ready),'missing-root');
 const stored={revision:0,state:'armed',observedAt:root.observedAt,plan:root.plan};
 assert.equal(transitionDecision(stored,ready),'apply');
 assert.equal(transitionDecision(stored,{...ready,revision:2}),'revision-gap');
 assert.equal(transitionDecision(stored,root),'stale-revision');
 assert.equal(transitionDecision({...stored,state:'entry-ready',revision:1},event('armed',2)),'invalid-transition');
 assert.equal(transitionDecision({...stored,state:'expired'},ready),'terminal-state');
 assert.equal(transitionDecision(stored,{...ready,observedAt:'2000-01-01T00:00:00.000Z'}),'time-regression');
 assert.equal(transitionDecision(stored,{...ready,plan:{...ready.plan!,levels:{...ready.plan!.levels,entry:'104'}}}),'geometry-change');
});
test('S3-05: source expiry retains plan identity and requires its boundary',()=>{
 const root=adaptMochbot(observation()),expired=adaptMochbot(observation(undefined,1,'expired'));
 assert.equal(root.kind,'observation');assert.equal(expired.kind,'observation');
 if(root.kind!=='observation'||expired.kind!=='observation')throw Error();
 assert.equal(expired.event.plan,null);
 const stored={revision:0,state:'armed',observedAt:root.event.observedAt,plan:root.event.plan};
 assert.equal(transitionDecision(stored,expired.event),'apply');
 assert.equal(transitionDecision(stored,{...expired.event,observedAt:root.event.observedAt}),'premature-expiry');
});
