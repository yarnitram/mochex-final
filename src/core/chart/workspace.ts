import {z} from 'zod';
const time=z.number().int().min(946684800).max(4102444800),price=z.number().positive().max(1e20);
export const drawingSchema=z.strictObject({
 id:z.uuid(),type:z.enum(['horizontal_line','trendline','rectangle','fib']),
 startTime:time,endTime:time,startPrice:price,endPrice:price,
 color:z.string().regex(/^#[a-fA-F0-9]{6}$/).default('#58d6af'),name:z.string().max(80).default('Drawing'),
 hidden:z.boolean().default(false),locked:z.boolean().default(false),
}).superRefine((d,c)=>{if(d.type!=='horizontal_line'&&d.startTime===d.endTime)c.addIssue({code:'custom',message:'Choose two distinct candle times'});});
export type Drawing=z.infer<typeof drawingSchema>;
export const layoutSchema=z.strictObject({
 version:z.literal(1),drawings:z.array(drawingSchema).max(100).refine(d=>new Set(d.map(x=>x.id)).size===d.length,'Duplicate drawing IDs'),
 ema:z.array(z.union([z.literal(20),z.literal(50),z.literal(100),z.literal(200)])).max(4).refine(a=>new Set(a).size===a.length),
 sma:z.array(z.union([z.literal(20),z.literal(50)])).max(2).refine(a=>new Set(a).size===a.length),
 rsi:z.boolean(),volume:z.boolean(),
 range:z.strictObject({from:z.number().min(-100000).max(100000),to:z.number().min(-100000).max(100000)}).refine(r=>r.to>r.from&&r.to-r.from<=10000).nullable(),
});
export type ChartLayout=z.infer<typeof layoutSchema>;
export const defaultLayout:ChartLayout={version:1,drawings:[],ema:[20,50],sma:[],rsi:false,volume:true,range:null};
export function sma(values:number[],period:number):(number|null)[]{
 if(!Number.isInteger(period)||period<1)throw Error('Invalid SMA period');
 let sum=0;return values.map((v,i)=>{sum+=v;if(i>=period)sum-=values[i-period]!;return i<period-1?null:sum/period;});
}
export function rsi(values:number[],period=14):(number|null)[]{
 if(!Number.isInteger(period)||period<1)throw Error('Invalid RSI period');
 const result:(number|null)[]=values.map(()=>null);let gain=0,loss=0;
 for(let i=1;i<values.length;i++){
  const diff=values[i]!-values[i-1]!,g=Math.max(diff,0),l=Math.max(-diff,0);
  if(i<=period){gain+=g;loss+=l;if(i<period)continue;gain/=period;loss/=period;}
  else{gain=(gain*(period-1)+g)/period;loss=(loss*(period-1)+l)/period;}
  result[i]=loss===0?(gain===0?50:100):100-100/(1+gain/loss);
 }return result;
}
// Selected pure helpers extracted from Mochex5642f5c. Coordinates must use a consistent time unit.
export interface FibLevelConfig {
  ratio: number;
  color: string;
  enabled: boolean;
  bg?: string;
}

export interface FibLevel {
  ratio: number;
  price: number;
  color: string;
  bg: string;
}

export const DEFAULT_FIB_LEVELS: FibLevelConfig[] = [
  { ratio: 0.0, color: "rgba(141, 144, 162, 0.9)", enabled: true, bg: "rgba(141, 144, 162, 0.08)" },
  { ratio: 0.236, color: "rgba(245, 172, 55, 0.9)", enabled: true, bg: "rgba(245, 172, 55, 0.08)" },
  { ratio: 0.382, color: "rgba(255, 213, 79, 0.9)", enabled: true, bg: "rgba(255, 213, 79, 0.08)" },
  { ratio: 0.5, color: "rgba(144, 202, 249, 0.9)", enabled: true, bg: "rgba(144, 202, 249, 0.08)" },
  { ratio: 0.618, color: "rgba(0, 216, 255, 0.95)", enabled: true, bg: "rgba(0, 216, 255, 0.12)" },
  { ratio: 0.786, color: "rgba(147, 83, 211, 0.9)", enabled: true, bg: "rgba(147, 83, 211, 0.08)" },
  { ratio: 1.0, color: "rgba(141, 144, 162, 0.9)", enabled: true, bg: "rgba(141, 144, 162, 0.08)" },
  { ratio: 1.618, color: "rgba(0, 192, 135, 0.95)", enabled: true, bg: "rgba(0, 192, 135, 0.08)" },
  { ratio: 2.618, color: "rgba(245, 172, 55, 0.9)", enabled: false, bg: "rgba(245, 172, 55, 0.08)" },
  { ratio: 3.618, color: "rgba(255, 59, 48, 0.9)", enabled: false, bg: "rgba(255, 59, 48, 0.08)" },
  { ratio: 4.236, color: "rgba(144, 202, 249, 0.9)", enabled: false, bg: "rgba(144, 202, 249, 0.08)" },
];

export const FIB_CONFIG = DEFAULT_FIB_LEVELS;

/**
 * Calculates standard Fibonacci Retracement levels from start price to end price (DEC-050).
 */
export function calculateFibLevels(
  startPrice: number,
  endPrice: number,
  customLevels?: FibLevelConfig[]
): FibLevel[] {
  const diff = endPrice - startPrice;
  const levels = customLevels && customLevels.length > 0 ? customLevels : DEFAULT_FIB_LEVELS;
  return levels
    .filter((lvl) => lvl.enabled !== false)
    .map((lvl) => ({
      ratio: lvl.ratio,
      price: startPrice + diff * (1 - lvl.ratio),
      color: lvl.color,
      bg: lvl.bg || "rgba(41, 98, 255, 0.06)",
    }));
}


export function extrapolateCoordinateToTime(
  x: number,
  lastBarTime: number,
  lastBarX: number,
  barSpacingPx: number,
  intervalMs: number
): number {
  if (barSpacingPx <= 0 || intervalMs <= 0) return lastBarTime;
  const deltaBars = (x - lastBarX) / barSpacingPx;
  return Math.round(lastBarTime + deltaBars * intervalMs);
}

/**
 * Projects a millisecond timestamp to pixel coordinate x, supporting infinite future and past extrapolation.
 */
export function extrapolateTimeToCoordinate(
  timeMs: number,
  lastBarTime: number,
  lastBarX: number,
  barSpacingPx: number,
  intervalMs: number
): number {
  if (intervalMs <= 0 || barSpacingPx <= 0) return lastBarX;
  const deltaBars = (timeMs - lastBarTime) / intervalMs;
  return lastBarX + deltaBars * barSpacingPx;
}


export interface DrawingHistoryState {
  undoStack: Drawing[][];
  redoStack: Drawing[][];
  current: Drawing[];
}

/**
 * Pushes a new drawing state snapshot onto the undo stack (capped at maxSteps) and clears the redo stack (DEC-068).
 */
export function pushDrawingHistory(
  state: DrawingHistoryState,
  nextDrawings: Drawing[],
  maxSteps: number = 50
): DrawingHistoryState {
  if (JSON.stringify(state.current) === JSON.stringify(nextDrawings)) {
    return state;
  }
  const newUndo = [...state.undoStack, state.current];
  if (newUndo.length > maxSteps) {
    newUndo.shift();
  }
  return {
    undoStack: newUndo,
    redoStack: [],
    current: nextDrawings,
  };
}

/**
 * Reverts to the most recent snapshot on the undo stack and pushes the current state onto the redo stack (DEC-068).
 */
export function performDrawingUndo(state: DrawingHistoryState): DrawingHistoryState {
  if (state.undoStack.length === 0) return state;
  const newUndo = [...state.undoStack];
  const previous = newUndo.pop()!;
  return {
    undoStack: newUndo,
    redoStack: [...state.redoStack, state.current],
    current: previous,
  };
}

/**
 * Restores the next snapshot from the redo stack and pushes the current state onto the undo stack (DEC-068).
 */
export function performDrawingRedo(state: DrawingHistoryState): DrawingHistoryState {
  if (state.redoStack.length === 0) return state;
  const newRedo = [...state.redoStack];
  const next = newRedo.pop()!;
  return {
    undoStack: [...state.undoStack, state.current],
    redoStack: newRedo,
    current: next,
  };
}


export const historyPush=pushDrawingHistory,historyUndo=performDrawingUndo,historyRedo=performDrawingRedo;
