import type { SidoStat } from "../../shared/weather";

export interface NationalRecord {
  rate: number;
  samples: number;
}

// Sido buckets carry rates rounded to 0.1%, so the national rate is weighted
// by samples; the rounding stays well under the 0.1% shown.
export function nationalRecord(
  stats: readonly SidoStat[],
  pop: number,
): NationalRecord | null {
  let samples = 0;
  let rain = 0;
  for (const stat of stats) {
    const bucket = stat.stats[pop];
    if (!bucket) continue;
    samples += bucket.samples;
    rain += (bucket.rate * bucket.samples) / 100;
  }
  return samples ? { rate: (100 * rain) / samples, samples } : null;
}

// 표본이 적은 높은 확률 구간을 하나로 묶는다.
export function combinedRecord(
  stats: readonly SidoStat[],
  pops: readonly number[],
): NationalRecord | null {
  let samples = 0;
  let rain = 0;
  for (const pop of pops) {
    const record = nationalRecord(stats, pop);
    if (!record) continue;
    samples += record.samples;
    rain += (record.rate * record.samples) / 100;
  }
  return samples ? { rate: (100 * rain) / samples, samples } : null;
}
