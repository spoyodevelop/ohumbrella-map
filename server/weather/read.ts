import { db } from "../db.ts";
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
import { timedQuery, type TimingReporter } from "./timing.ts";

// 전국 252개 시군구 최신 날씨 + 실측 확률 일괄 반환
export async function getLatestWeather(
  reportTiming?: TimingReporter,
): Promise<CurrentWeatherResponse> {
  // 시군구별 최신 상태는 수집 시점에 계산해 둔다.
  const [rowsRes, localStatsRes] = await Promise.all([
    timedQuery("db-weather", reportTiming, () => db.execute(`
      SELECT
        h.time,
        h.sido_code as sidoCode,
        h.sigungu_code as sigunguCode,
        h.name,
        h.pop as kmaPop,
        h.pop_source_time as kmaPopSourceTime,
        h.pty,
        h.rn1,
        h.tmp,
        h.sky,
        h.sky_source_time as skySourceTime,
        h.updated_at as updatedAt
      FROM current_weather h
    `)),

    timedQuery("db-accuracy", reportTiming, () => db.execute(`
      SELECT
        f.sigungu_code,
        h.sido_code,
        f.predicted_pop,
        f.rain_count,
        f.total_count AS samples,
        ROUND(100.0 * f.rain_count / f.total_count, 1) AS rate
      FROM verified_accuracy_stats f
      JOIN current_weather h ON f.sigungu_code = h.sigungu_code
      WHERE f.total_count > 0
    `)),
  ]);

  const rows = rowsRes.rows as unknown as CurrentWeatherRow[];
  if (rows.length === 0) {
    return { time: null, isStale: true, count: 0, data: {} };
  }

  const maxTime = rows.reduce(
    (latest, row) => row.time > latest ? row.time : latest,
    rows[0].time,
  );
  const localStats = localStatsRes.rows as unknown as VerifiedPopBucketRow[];
  return assembleCurrentWeatherResponse(maxTime, rows, localStats);
}

// 17개 광역시도별 최신 집계 통계
export async function getSidoStats(
  reportTiming?: TimingReporter,
): Promise<SidoStatsResponse> {
  const [res, bucketsRes] = await Promise.all([
    timedQuery("db-sido", reportTiming, () => db.execute(`
      SELECT
        sido_code as sidoCode,
        MAX(time) as latestTime,
        ROUND(AVG(pop), 1) as avgPop,
        MAX(pop) as maxPop,
        ROUND(SUM(COALESCE(rn1, 0)), 1) as totalRain,
        SUM(CASE WHEN pty > 0 OR rn1 > 0 THEN 1 ELSE 0 END) as rainingCount,
        COUNT(*) as totalCount
      FROM current_weather
      GROUP BY sido_code
      ORDER BY sido_code ASC
    `)),
    timedQuery("db-buckets", reportTiming, () => db.execute(`
      SELECT
        h.sido_code as sidoCode,
        f.predicted_pop as predictedPop,
        SUM(f.rain_count) as rainCount,
        SUM(f.total_count) as samples
      FROM verified_accuracy_stats f
      JOIN current_weather h ON f.sigungu_code = h.sigungu_code
      WHERE f.total_count > 0
      GROUP BY h.sido_code, f.predicted_pop
    `)),
  ]);

  const stats = res.rows as unknown as (SidoStatRow & { latestTime: string })[];
  if (stats.length === 0) {
    return { time: null, stats: [] };
  }

  const maxTime = stats.reduce(
    (latest, row) => row.latestTime > latest ? row.latestTime : latest,
    stats[0].latestTime,
  );
  const buckets = bucketsRes.rows as unknown as SidoPopBucketRow[];
  return assembleSidoStatsResponse(maxTime, stats, buckets);
}
