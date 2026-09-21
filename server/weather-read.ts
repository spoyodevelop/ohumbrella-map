import { db } from "./db.ts";
import { latestKnownPopForH } from "./weather-sql.ts";
import type { ForecastRecord } from "./weather-write.ts";

interface WeatherRecord {
  time: string;
  sidoCode: string;
  sigunguCode: string;
  name: string;
  pop: number | null;
  kmaPop?: number | null;
  pty: number;
  rn1: number;
  tmp: number | null;
  sky: number;
  isRaining?: number;
  empiricalRate?: number | null;
  sampleCount?: number;
  stats?: Record<number, { rate: number; samples: number }>;
  sidoStats?: Record<number, { rate: number; samples: number }>;
  sidoSampleCount?: number;
  sidoEmpiricalRate?: number | null;
  updatedAt: string;
}

export interface SidoStat {
  sidoCode: string;
  avgPop: number;
  maxPop: number;
  totalRain: number;
  rainingCount: number;
  totalCount: number;
}

// 전국 252개 시군구 최신 날씨 + 실측 확률 일괄 반환
export async function getLatestWeather() {
  const latestTimeRes = await db.execute(
    `SELECT MAX(time) as maxTime FROM hourly_weather`,
  );
  const maxTime = (latestTimeRes.rows[0]?.maxTime as string | null) ?? null;

  if (!maxTime) {
    return { time: null, count: 0, data: {} };
  }

  // 1. 시군구별 최신 실황 조회 (pop/sky는 예보 sync 시 직접 업데이트됨)
  const [rowsRes, localStatsRes] = await Promise.all([
    db.execute(`
      SELECT
        h.time,
        h.sido_code as sidoCode,
        h.sigungu_code as sigunguCode,
        h.name,
        ${latestKnownPopForH} as pop,
        ${latestKnownPopForH} as kmaPop,
        h.pty,
        h.rn1,
        h.tmp,
        COALESCE(h.sky, 1) as sky,
        h.updated_at as updatedAt
      FROM hourly_weather h
      INNER JOIN (
        SELECT sigungu_code, MAX(time) as max_time
        FROM hourly_weather
        GROUP BY sigungu_code
      ) latest ON h.sigungu_code = latest.sigungu_code AND h.time = latest.max_time
    `),
    // 집계 테이블 직접 조회 (최대 2,772 rows, 비용 고정)
    db.execute(`
      SELECT
        f.sigungu_code,
        h.sido_code,
        f.predicted_pop,
        f.rain_count,
        f.total_count AS samples,
        ROUND(100.0 * f.rain_count / f.total_count, 1) AS rate
      FROM verified_accuracy_stats f
      JOIN (
        SELECT DISTINCT sigungu_code, sido_code FROM hourly_weather
      ) h ON f.sigungu_code = h.sigungu_code
      WHERE f.total_count > 0
    `),
  ]);

  const rows = rowsRes.rows as unknown as WeatherRecord[];
  const localStats = localStatsRes.rows as unknown as {
    sigungu_code: string;
    sido_code: string;
    predicted_pop: number;
    rain_count: number;
    rate: number;
    samples: number;
  }[];
  const localMap = new Map(
    localStats.map((s) => [`${s.sigungu_code}_${s.predicted_pop}`, s]),
  );

  // Aggregate sido stats
  const sidoAggMap = new Map<string, { rain_count: number; samples: number }>();
  for (const s of localStats) {
    const key = `${s.sido_code}_${s.predicted_pop}`;
    const curr = sidoAggMap.get(key) || { rain_count: 0, samples: 0 };
    curr.rain_count += s.rain_count;
    curr.samples += s.samples;
    sidoAggMap.set(key, curr);
  }
  const sidoMap = new Map<string, { rate: number; samples: number }>();
  for (const [key, agg] of sidoAggMap.entries()) {
    sidoMap.set(key, {
      rate: Math.round((100.0 * agg.rain_count) / agg.samples * 10) / 10,
      samples: agg.samples,
    });
  }

  const data: Record<string, WeatherRecord> = {};
  for (const rawRow of rows) {
    const row = { ...rawRow };
    const pop = row.kmaPop;
    const local = pop == null ? undefined : localMap.get(`${row.sigunguCode}_${pop}`);
    const sido = pop == null ? undefined : sidoMap.get(`${row.sidoCode}_${pop}`);
    row.isRaining = row.pty > 0 || row.rn1 > 0 ? 1 : 0;
    row.empiricalRate = local?.rate ?? null;
    row.sampleCount = local?.samples ?? 0;
    row.sidoEmpiricalRate = sido?.rate ?? null;
    row.sidoSampleCount = sido?.samples ?? 0;

    // 0~100%까지 모든 버킷의 통계 매핑 (UI select 박스용)
    row.stats = {};
    row.sidoStats = {};
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

// 17개 광역시도별 최신 집계 통계
export async function getSidoStats() {
  const latestTimeRes = await db.execute(
    `SELECT MAX(time) as maxTime FROM hourly_weather`,
  );
  const maxTime = (latestTimeRes.rows[0]?.maxTime as string | null) ?? null;

  if (!maxTime) {
    return { time: null, stats: [] };
  }

  const [res, bucketsRes] = await Promise.all([
    db.execute(`
      WITH latest_weather AS (
        SELECT
          h.sido_code,
          ${latestKnownPopForH} as effective_pop,
          h.rn1,
          h.pty
        FROM hourly_weather h
        INNER JOIN (
          SELECT sigungu_code, MAX(time) as max_time
          FROM hourly_weather
          GROUP BY sigungu_code
        ) latest ON h.sigungu_code = latest.sigungu_code AND h.time = latest.max_time
      )
      SELECT
        sido_code as sidoCode,
        ROUND(AVG(effective_pop), 1) as avgPop,
        MAX(effective_pop) as maxPop,
        ROUND(SUM(COALESCE(rn1, 0)), 1) as totalRain,
        SUM(CASE WHEN pty > 0 OR rn1 > 0 THEN 1 ELSE 0 END) as rainingCount,
        COUNT(*) as totalCount
      FROM latest_weather
      GROUP BY sido_code
      ORDER BY sido_code ASC
    `),
    db.execute(`
      SELECT
        h.sido_code as sidoCode,
        f.predicted_pop as predictedPop,
        SUM(f.rain_count) as rainCount,
        SUM(f.total_count) as samples
      FROM verified_accuracy_stats f
      JOIN (SELECT DISTINCT sigungu_code, sido_code FROM hourly_weather) h ON f.sigungu_code = h.sigungu_code
      WHERE f.total_count > 0
      GROUP BY h.sido_code, f.predicted_pop
    `)
  ]);

  const stats = res.rows as unknown as SidoStat[];
  const buckets = bucketsRes.rows as unknown as { sidoCode: string; predictedPop: number; rainCount: number; samples: number }[];

  const bucketMap = new Map<string, Record<number, { rate: number; samples: number }>>();
  for (const b of buckets) {
    if (!bucketMap.has(b.sidoCode)) bucketMap.set(b.sidoCode, {});
    const m = bucketMap.get(b.sidoCode)!;
    m[b.predictedPop] = {
      rate: Math.round((100.0 * b.rainCount) / b.samples * 10) / 10,
      samples: b.samples
    };
  }

  const enrichedStats = stats.map(s => ({
    ...s,
    stats: bucketMap.get(s.sidoCode) || {}
  }));

  return { time: maxTime, stats: enrichedStats };
}

// 특정 시군구 미래 예보 타임라인 조회
export async function getForecastTimeline(sigunguCode: string, hours = 24) {
  const latestBaseRes = await db.execute({
    sql: `SELECT MAX(base_time) as maxBaseTime FROM weather_forecasts WHERE sigungu_code = ?`,
    args: [sigunguCode],
  });

  const maxBaseTime =
    (latestBaseRes.rows[0]?.maxBaseTime as string | null) ?? null;
  if (!maxBaseTime) {
    return [];
  }

  const res = await db.execute({
    sql: `
      SELECT
        base_time as baseTime,
        target_time as targetTime,
        sigungu_code as sigunguCode,
        sido_code as sidoCode,
        name,
        pop,
        lead_hours as leadHours,
        sky,
        tmp,
        created_at as createdAt
      FROM weather_forecasts
      WHERE sigungu_code = ? AND base_time = ?
      ORDER BY target_time ASC
      LIMIT ?
    `,
    args: [sigunguCode, maxBaseTime, hours],
  });

  return res.rows as unknown as ForecastRecord[];
}

// 특정 시군구 시계열 이력 조회
export async function getTimeSeries(sigunguCode: string, limitHours = 48) {
  const res = await db.execute({
    sql: `
      SELECT
        time,
        sido_code as sidoCode,
        sigungu_code as sigunguCode,
        name,
        pop,
        pty,
        rn1,
        tmp,
        sky,
        updated_at as updatedAt
      FROM hourly_weather
      WHERE sigungu_code = ?
      ORDER BY time DESC
      LIMIT ?
    `,
    args: [sigunguCode, limitHours],
  });

  return res.rows as unknown as WeatherRecord[];
}
