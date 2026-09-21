import type {
  ProbabilityBucket,
  SidoStat,
  SidoStatsResponse,
} from "../../shared/weather.ts";

export interface SidoStatRow {
  sidoCode: string;
  avgPop: number | null;
  maxPop: number | null;
  totalRain: number;
  rainingCount: number;
  totalCount: number;
}

export interface SidoPopBucketRow {
  sidoCode: string;
  predictedPop: number;
  rainCount: number;
  samples: number;
}

export function assembleSidoStatsResponse(
  maxTime: string,
  rows: readonly SidoStatRow[],
  buckets: readonly SidoPopBucketRow[],
): SidoStatsResponse {
  const bucketMap = new Map<string, Record<number, ProbabilityBucket>>();
  for (const bucket of buckets) {
    if (!bucketMap.has(bucket.sidoCode)) bucketMap.set(bucket.sidoCode, {});
    const stats = bucketMap.get(bucket.sidoCode)!;
    stats[bucket.predictedPop] = {
      rate: Math.round(((100.0 * bucket.rainCount) / bucket.samples) * 10) / 10,
      samples: bucket.samples,
    };
  }

  const stats: SidoStat[] = rows.map((row) => ({
    sidoCode: row.sidoCode,
    avgPop: row.avgPop,
    maxPop: row.maxPop,
    totalRain: row.totalRain,
    rainingCount: row.rainingCount,
    totalCount: row.totalCount,
    stats: bucketMap.get(row.sidoCode) || {},
  }));

  return { time: maxTime, stats };
}
