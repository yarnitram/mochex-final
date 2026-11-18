import { z } from 'zod';
import { Money,decimal,instrumentSchema,signalSchema } from '../contracts.js';
import { fingerprint,stableJson,PersistenceError } from '../server/signal-contracts.js';

export const MOCHBOT_REVISION='271cc546191e70086791fa66aca8722a1996197b';
const positive=decimal.refine(v=>new Money(v).gt(0));
const seconds=z.number().int().min(946684800).max(4102444800);
const iso=(t:number)=>new Date(t*1000).toISOString();
const numeric=(v:number)=>new Money(v.toString()).toFixed();
export const configurationSchema=z.strictObject({
 biasTfMinutes:z.union([z.literal(60),z.literal(240)]),
 alignTfMinutes:z.union([z.literal(5),z.literal(15),z.literal(30),z.literal(60)]),
 entryTfMinutes:z.union([z.literal(1),z.literal(3),z.literal(5),z.literal(15)]),
 biasPivotLen:z.number().int().min(1).max(100),alignPivotLen:z.number().int().min(1).max(100),entryPivotLen:z.number().int().min(1).max(100),
 requireAlignment:z.boolean(),breakRule:z.enum(['Body close','Wick']),entryFib:z.number().gt(0).lt(1),
 zoneNear:z.number().min(0),zoneFar:z.number().max(1),orderExpiry:z.number().int().min(1).max(100),
 cancelBiasFlip:z.boolean(),cancelNewChoch:z.boolean(),useKillzone:z.boolean(),stopBufferAtr:z.number().min(0).max(5),
 rrTP1:z.number().positive(),rrTP2:z.number().positive(),watchDistanceAtr:z.number().nonnegative(),
}).refine(c=>c.entryTfMinutes<=c.alignTfMinutes&&c.alignTfMinutes<=c.biasTfMinutes&&c.zoneNear<c.zoneFar&&c.rrTP1<c.rrTP2);
const context=z.object({
 biasMinutes:z.number(),chochMinutes:z.number(),expiryBarMinutes:z.number(),expiryBars:z.number(),
 fibRatio:z.number(),fibZero:z.number().positive(),fibOne:z.number().positive(),confirmedAt:seconds,breakRule:z.enum(['Body close','Wick']),
});
const snapshot=z.object({
 symbol:z.literal('BTC_USDT'),strategyId:z.literal('MOD-01E'),
 stage:z.enum(['IDLE','WATCH','ARMED','ENTRY_READY']),orderStatus:z.enum(['PENDING','TOUCHED','EXPIRED','INVALIDATED','BLOCKED']).optional(),
 setupId:z.string().nullable(),direction:z.enum(['LONG','SHORT']).nullable(),ts:seconds,ltfMinutes:z.number(),
 entry:z.number().positive().nullable(),sl:z.number().positive().nullable(),tp1:z.number().positive().nullable(),tp2:z.number().positive().nullable(),
 orderType:z.enum(['LIMIT','MARKET','TRIGGER_LIMIT']).nullable(),expiresAt:seconds.optional(),limitContext:context.optional(),
});
const wrapper=z.strictObject({
 envelopeVersion:z.literal(1),sourceId:z.uuid(),sourceRevision:z.literal(MOCHBOT_REVISION),
 revision:z.number().int().nonnegative().max(2147483647),capturedAt:z.iso.datetime({precision:3}),
 configuration:configurationSchema,instrument:instrumentSchema,snapshot,
}).refine(v=>v.instrument.exchange==='mexc'&&v.instrument.market==='perpetual'&&v.instrument.nativeSymbol==='BTC_USDT'&&v.instrument.base==='BTC'&&v.instrument.quote==='USDT'&&v.instrument.settlement==='USDT');
export const planSchema=z.strictObject({
 direction:z.enum(['long','short']),orderType:z.literal('LIMIT'),fillStatus:z.literal('unconfirmed'),
 levels:z.strictObject({entry:positive,stop:positive,tp1:positive,tp2:positive}),
 fibZero:positive,fibOne:positive,fibRatio:positive,confirmedAt:z.iso.datetime({precision:3}),expiresAt:z.iso.datetime({precision:3}),
});
const state=z.enum(['armed','entry-ready','expired','invalidated']);
const timeframe=(minutes:number)=>minutes===60?'1h':minutes===240?'4h':minutes+'m';
export const observationSchema=z.strictObject({
 ...signalSchema.shape,schemaVersion:z.literal(2),strategyId:z.literal('MOD-01E'),strategyVersion:z.literal(MOCHBOT_REVISION),
 configurationVersion:z.string().regex(/^[a-f0-9]{64}$/),sourceEventId:z.string().regex(/^[a-f0-9]{64}$/),
 adapterVersion:z.literal('mochbot-mod01e-v1'),externalSetupId:z.string().max(128),
 revision:z.number().int().min(0).max(2147483647),proposedState:state,configuration:configurationSchema,plan:planSchema.nullable(),
}).superRefine((v,c)=>{
 const {adapterVersion,externalSetupId,revision,proposedState,configuration,plan,...base}=v;
 if(!signalSchema.safeParse({...base,schemaVersion:1}).success)c.addIssue({code:'custom',message:'Invalid observation timestamps/base'});
 if(fingerprint(configuration)!==v.configurationVersion||v.sourceEventId!==fingerprint([externalSetupId,v.configurationVersion,revision]))
  c.addIssue({code:'custom',message:'Invalid configuration/event identity'});
 if(v.instrument.exchange!=='mexc'||v.instrument.market!=='perpetual'||v.instrument.nativeSymbol!=='BTC_USDT'||v.timeframe!==timeframe(configuration.entryTfMinutes))
  c.addIssue({code:'custom',message:'Observation instrument/timeframe mismatch'});
 const identity=/^BTC_USDT:01E:(LONG|SHORT):(\d+)$/.exec(externalSetupId);
 const confirmation=identity?(Number(identity[2])+configuration.alignTfMinutes*60)*1000:NaN;
 if(!identity||v.instrument.base!=='BTC'||v.instrument.quote!=='USDT'||v.instrument.settlement!=='USDT'||Date.parse(v.observedAt)<confirmation)
  c.addIssue({code:'custom',message:'Observation identity/confirmation mismatch'});
 if((proposedState==='armed'||proposedState==='entry-ready')&&!plan)c.addIssue({code:'custom',message:'Active observation needs geometry'});
 if(plan){
  if(plan.direction!==(identity?.[1]==='LONG'?'long':'short')||
    !new Money(plan.fibRatio).eq(configuration.entryFib)||
    Date.parse(plan.confirmedAt)!==confirmation||
    Date.parse(plan.expiresAt)!==confirmation+configuration.orderExpiry*configuration.entryTfMinutes*60000)
   c.addIssue({code:'custom',message:'Plan context/configuration mismatch'});
  const {entry,stop,tp1,tp2}=plan.levels,sign=plan.direction==='long'?1:-1;
  const risk=new Money(entry).minus(stop).times(sign);
  const close=(a:InstanceType<typeof Money>,b:InstanceType<typeof Money>)=>a.minus(b).abs().lte(Money.max(b.abs().times('0.000000000001'),'0.00000000000000000001'));
  const fib=new Money(plan.fibZero).plus(new Money(plan.fibOne).minus(plan.fibZero).times(plan.fibRatio));
  if(risk.lte(0)||new Money(stop).minus(plan.fibOne).times(sign).gt(0)||new Money(plan.fibZero).minus(plan.fibOne).times(sign).lte(0)||
    !new Money(tp1).minus(entry).times(sign).gt(0)||!new Money(tp2).minus(tp1).times(sign).gt(0)||
    !close(new Money(entry),fib)||!close(new Money(tp1),new Money(entry).plus(risk.times(configuration.rrTP1).times(sign)))||
    !close(new Money(tp2),new Money(entry).plus(risk.times(configuration.rrTP2).times(sign))))
   c.addIssue({code:'custom',message:'Invalid direction/Fibonacci/target geometry'});
 }
});
export type Observation=z.infer<typeof observationSchema>;
export function validateObservation(input:unknown){return observationSchema.parse(input);}
export function adaptMochbot(input:unknown):{kind:'ignored',sourceId:string,reason:string}|{kind:'observation',event:Observation}{
 const w=wrapper.parse(input),s=w.snapshot,cfg=w.configuration;
 if(s.stage==='WATCH'||s.orderStatus==='BLOCKED'||(!s.setupId&&s.stage==='IDLE'))
  return {kind:'ignored',sourceId:w.sourceId,reason:'Unconfirmed watch/idle/blocked snapshot'};
 const match=/^BTC_USDT:01E:(LONG|SHORT):(\d+)$/.exec(s.setupId??'');
 if(!match||!s.limitContext)throw new PersistenceError(422,'Confirmed MOD-01E identity/context required');
 const ctx=s.limitContext,choch=Number(match[2]),confirmed=choch+cfg.alignTfMinutes*60;
 if(ctx.confirmedAt!==confirmed||s.ts<confirmed||s.ltfMinutes!==cfg.entryTfMinutes||
  ctx.biasMinutes!==cfg.biasTfMinutes||ctx.chochMinutes!==cfg.alignTfMinutes||ctx.expiryBarMinutes!==cfg.entryTfMinutes||
  ctx.expiryBars!==cfg.orderExpiry||ctx.fibRatio!==cfg.entryFib||ctx.breakRule!==cfg.breakRule)
  throw new PersistenceError(422,'Snapshot configuration/context mismatch');
 const expires=confirmed+cfg.orderExpiry*cfg.entryTfMinutes*60;
 let proposedState:z.infer<typeof state>;
 if(s.orderStatus==='EXPIRED')proposedState='expired';
 else if(s.orderStatus==='INVALIDATED')proposedState='invalidated';
 else if(s.stage==='ARMED'&&s.orderStatus==='PENDING')proposedState='armed';
 else if(s.stage==='ENTRY_READY'&&s.orderStatus==='TOUCHED')proposedState='entry-ready';
 else return {kind:'ignored',sourceId:w.sourceId,reason:'No confirmed lifecycle observation'};
 let plan:z.infer<typeof planSchema>|null=null;
 if(proposedState==='armed'||proposedState==='entry-ready'){
  if(s.direction!==match[1]||s.orderType!=='LIMIT'||s.entry===null||s.sl===null||s.tp1===null||s.tp2===null||
   (s.expiresAt!==undefined&&s.expiresAt!==expires))throw new PersistenceError(422,'Incomplete or inconsistent LIMIT geometry');
  plan={direction:s.direction==='LONG'?'long':'short',orderType:'LIMIT',fillStatus:'unconfirmed',
   levels:{entry:numeric(s.entry),stop:numeric(s.sl),tp1:numeric(s.tp1),tp2:numeric(s.tp2)},
   fibZero:numeric(ctx.fibZero),fibOne:numeric(ctx.fibOne),fibRatio:numeric(ctx.fibRatio),confirmedAt:iso(confirmed),expiresAt:iso(expires)};
 }
 const configurationVersion=fingerprint(cfg),observedAt=iso(s.ts);
 return {kind:'observation',event:validateObservation({
  schemaVersion:2,sourceId:w.sourceId,sourceEventId:fingerprint([s.setupId,configurationVersion,w.revision]),
  instrument:w.instrument,strategyId:'MOD-01E',strategyVersion:w.sourceRevision,configurationVersion,
  timeframe:timeframe(cfg.entryTfMinutes),candleOpenTime:iso(Math.floor(s.ts/(cfg.entryTfMinutes*60))*cfg.entryTfMinutes*60),
  observedAt,emittedAt:w.capturedAt,expiresAt:iso(s.ts+180),maxAgeSeconds:180,
  evidence:{kind:'intrabar',reference:'mochbot-setup-minute'},adapterVersion:'mochbot-mod01e-v1',
  externalSetupId:s.setupId,revision:w.revision,proposedState,configuration:cfg,plan,
 })};
}
export type StoredLifecycle={revision:number,state:string,observedAt:string,plan:z.infer<typeof planSchema>|null};
export function transitionDecision(stored:StoredLifecycle|null,event:Observation):string{
 if(!stored){
  if(event.revision!==0||event.proposedState!=='armed'||!event.plan)return 'missing-root';
  return event.observedAt>=event.plan.expiresAt?'expired-plan':'apply';
 }
 if(event.revision<=stored.revision)return 'stale-revision';
 if(event.revision!==stored.revision+1)return 'revision-gap';
 if(['expired','invalidated','cancelled'].includes(stored.state))return 'terminal-state';
 if(!['armed','entry-ready'].includes(stored.state))return 'invalid-transition';
 if(event.observedAt<stored.observedAt)return 'time-regression';
 if(event.plan&&stableJson(stored.plan)!==stableJson(event.plan))return 'geometry-change';
 if(stored.state==='entry-ready'&&event.proposedState==='armed')return 'invalid-transition';
 const expiry=stored.plan?.expiresAt;
 if(event.proposedState==='expired'&&expiry&&event.observedAt<expiry)return 'premature-expiry';
 if(['armed','entry-ready'].includes(event.proposedState)&&expiry&&event.observedAt>=expiry)return 'expired-plan';
 return 'apply';
}
