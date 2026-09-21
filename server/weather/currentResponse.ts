import type {
  CurrentWeatherResponse,
  ProbabilityBucket,
  RegionWeatherInfo,
} from "../../shared/weather.ts";

export interface CurrentWeatherRow {
  time: string;
  sidoCode: string;
  sigunguCode: string;
  name: string;
  pop: number | null;
  kmaPop: number | null;
  pty: number;
  rn1: number;
  tmp: number | null;
  sky: number;
  updatedAt: string;
}

export interface VerifiedPopBucketRow {
  sigungu_code: string;
  sido_code: string;
  predicted_pop: number;
  rain_count: number;
  rate: number;
  samples: number;
}

export function assembleCurrentWeatherResponse(
  maxTime: string,
  rows: readonly CurrentWeatherRow[],
  localStats: readonly VerifiedPopBucketRow[],
): CurrentWeatherResponse {
  const localMap = new Map(
    localStats.map((s) => [`${s.sigungu_code}_${s.predicted_pop}`, s]),
  );

  const sidoAggMap = new Map<string, { rain_count: number; samples: number }>();
  for (const s of localStats) {
    const key = `${s.sido_code}_${s.predicted_pop}`;
    const curr = sidoAggMap.get(key) || { rain_count: 0, samples: 0 };
    curr.rain_count += s.rain_count;
    curr.samples += s.samples;
    sidoAggMap.set(key, curr);
  }
  const sidoMap = new Map<string, ProbabilityBucket>();
  for (const [key, agg] of sidoAggMap.entries()) {
    sidoMap.set(key, {
      rate: Math.round(((100.0 * agg.rain_count) / agg.samples) * 10) / 10,
      samples: agg.samples,
    });
  }

  const data: Record<string, RegionWeatherInfo> = {};
  for (const rawRow of rows) {
    const pop = rawRow.kmaPop;
    const local =
      pop == null ? undefined : localMap.get(`${rawRow.sigunguCode}_${pop}`);
    const sido =
      pop == null ? undefined : sidoMap.get(`${rawRow.sidoCode}_${pop}`);
    const row: RegionWeatherInfo = {
      time: rawRow.time,
      sidoCode: rawRow.sidoCode,
      sigunguCode: rawRow.sigunguCode,
      name: rawRow.name,
      pop: rawRow.pop,
      kmaPop: rawRow.kmaPop,
      pty: rawRow.pty,
      rn1: rawRow.rn1,
      tmp: rawRow.tmp,
      sky: rawRow.sky,
      updatedAt: rawRow.updatedAt,
      isRaining: rawRow.pty > 0 || rawRow.rn1 > 0 ? 1 : 0,
      empiricalRate: local?.rate ?? null,
      sampleCount: local?.samples ?? 0,
      sidoEmpiricalRate: sido?.rate ?? null,
      sidoSampleCount: sido?.samples ?? 0,
      stats: {},
      sidoStats: {},
    };

    // 0~100%까지 모든 버킷의 통계 매핑 (UI select 박스용)
    for (let p = 0; p <= 100; p += 10) {
      const l = localMap.get(`${row.sigunguCode}_${p}`);
      if (l) {
        row.stats[p] = { rate: l.rate, samples: l.samples };
      }

      const s = sidoMap.get(`${row.sidoCode}_${p}`);
      if (s) {
        row.sidoStats[p] = { rate: s.rate, samples: s.samples };
      }
    }

    data[row.sigunguCode] = row;
  }

  return { time: maxTime, count: rows.length, data };
}
