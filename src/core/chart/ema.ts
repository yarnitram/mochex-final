/** Extracted from Mochex Charts 5fad2a6, 2026-11-18. Source unchanged; see docs/CORE-CHART-PROVENANCE.md. */
export type EmaPeriod=20|50|100|200;
export function getEmaAlpha(period:number):number {
 if(period<=0)return 1;
 return 2/(period+1);
}
export function calculateEma(closes: number[], period: EmaPeriod): (number | null)[] {
  const n = closes.length;
  const result: (number | null)[] = new Array(n).fill(null);

  if (n < period || period <= 0) {
    return result;
  }

  const alpha = getEmaAlpha(period);
  const oneMinusAlpha = 1 - alpha;

  // 1. Initial SMA seed at index (period - 1)
  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += closes[i]!;
  }
  let prevEma = sum / period;
  result[period - 1] = prevEma;

  // 2. Subsequent exponential smoothing
  for (let i = period; i < n; i++) {
    const currentClose = closes[i]!;
    if (isNaN(currentClose) || currentClose === null) {
      result[i] = prevEma;
      continue;
    }
    const currentEma = currentClose * alpha + prevEma * oneMinusAlpha;
    result[i] = currentEma;
    prevEma = currentEma;
  }

  return result;
}
