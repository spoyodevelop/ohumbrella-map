import { db } from "../db.ts";
import { latestKnownPopForH } from "./sql.ts";
import type {
  CurrentWeatherResponse,
  SidoStatsResponse,
} from "../../shared/weather.ts";
import {
  assembleCurrentWeatherResponse,
  type CurrentWeatherRow,
  type VerifiedPopBucketRow,
} from "./currentResponse.ts";
import {
  assembleSidoStatsResponse,
  type SidoPopBucketRow,
  type SidoStatRow,
} from "./sidoResponse.ts";

// 전국 252개 시군구 최신 날씨 + 실측 확률 일괄 반환
export async function getLatestWeather(): Promise<CurrentWeatherResponse> {
  const latestTimeRes = await db.execute(
    `SELECT MAX(time) as maxTime FROM hourly_weather`,
  );
  const maxTime = (latestTimeRes.rows[0]?.maxTime as string | null) ?? null;

  if (!maxTime) {
    return { time: null, isStale: true, count: 0, data: {} };
  }

  // 1. 시군구별 최신 실황 조회 (pop/sky는 예보 sync 시 직접 업데이트됨)
  const [rowsRes, localStatsRes] = await Promise.all([
    db.execute(`
      SELECT
        h.time,
        h.sido_code as sidoCode,
        h.sigungu_code as sigunguCode,
        h.name,
        ${latestKnownPopForH} as kmaPop,
        h.pty,
        h.rn1,
        h.tmp,
        h.sky,
        h.updated_at as updatedAt
      FROM hourly_weather h
      INNER JOIN (
        SELECT sigungu_code, MAX(time) as max_time
        FROM hourly_weather
        GROUP BY sigungu_code
      ) latest ON h.sigungu_code = latest.sigungu_code AND h.time = latest.max_time
    `),

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

  const rows = rowsRes.rows as unknown as CurrentWeatherRow[];
  const localStats = localStatsRes.rows as unknown as VerifiedPopBucketRow[];
  return assembleCurrentWeatherResponse(maxTime, rows, localStats);
}

// 17개 광역시도별 최신 집계 통계
export async function getSidoStats(): Promise<SidoStatsResponse> {
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
    `),
  ]);

  const stats = res.rows as unknown as SidoStatRow[];
  const buckets = bucketsRes.rows as unknown as SidoPopBucketRow[];
  return assembleSidoStatsResponse(maxTime, stats, buckets);
}
