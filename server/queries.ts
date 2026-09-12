import { db } from "./db.ts";

export interface ObservationRecord {
  time: string;
  sigunguCode: string;
  sidoCode: string;
  name: string;
  isRaining: number;
  pty: number;
  rn1: number;
  tmp: number | null;
  createdAt: string;
}

export interface ForecastRecord {
  baseTime: string;
  targetTime: string;
  sigunguCode: string;
  sidoCode: string;
  name: string;
  pop: number;
  leadHours: number;
  sky: number;
  tmp: number | null;
  createdAt: string;
}

export interface WeatherRecord {
  time: string;
  sidoCode: string;
  sigunguCode: string;
  name: string;
  pop: number | null;
  pty: number;
  rn1: number;
  tmp: number | null;
  sky: number;
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

// 1. 실황 업서트
const upsertObsStmt = db.prepare(`
  INSERT INTO weather_observations (
    time, sigungu_code, sido_code, name, is_raining, pty, rn1, tmp, created_at
  ) VALUES (
    @time, @sigunguCode, @sidoCode, @name, @isRaining, @pty, @rn1, @tmp, @createdAt
  )
  ON CONFLICT(time, sigungu_code) DO UPDATE SET
    is_raining = excluded.is_raining,
    pty = excluded.pty,
    rn1 = excluded.rn1,
    tmp = coalesce(excluded.tmp, weather_observations.tmp),
    created_at = excluded.created_at
`);

export const upsertObservationsBatch = db.transaction(
  (records: ObservationRecord[]) => {
    for (const record of records) {
      upsertObsStmt.run(record);
    }
  },
);

// 2. 예보 업서트
const upsertFcstStmt = db.prepare(`
  INSERT INTO weather_forecasts (
    base_time, target_time, sigungu_code, sido_code, name, pop, lead_hours, sky, tmp, created_at
  ) VALUES (
    @baseTime, @targetTime, @sigunguCode, @sidoCode, @name, @pop, @leadHours, @sky, @tmp, @createdAt
  )
  ON CONFLICT(base_time, target_time, sigungu_code) DO UPDATE SET
    pop = excluded.pop,
    lead_hours = excluded.lead_hours,
    sky = excluded.sky,
    tmp = coalesce(excluded.tmp, weather_forecasts.tmp),
    created_at = excluded.created_at
`);

export const upsertForecastsBatch = db.transaction(
  (records: ForecastRecord[]) => {
    for (const record of records) {
      upsertFcstStmt.run(record);
    }
  },
);

// 3. 기존 지도 렌더링용 업서트
const upsertHourlyStmt = db.prepare(`
  INSERT INTO hourly_weather (
    time, sido_code, sigungu_code, name, pop, pty, rn1, tmp, sky, updated_at
  ) VALUES (
    @time, @sidoCode, @sigunguCode, @name, @pop, @pty, @rn1, @tmp, @sky, @updatedAt
  )
  ON CONFLICT(time, sigungu_code) DO UPDATE SET
    pop = coalesce(excluded.pop, hourly_weather.pop),
    pty = excluded.pty,
    rn1 = excluded.rn1,
    tmp = coalesce(excluded.tmp, hourly_weather.tmp),
    sky = coalesce(excluded.sky, hourly_weather.sky),
    updated_at = excluded.updated_at
`);

export const upsertWeatherBatch = db.transaction((records: WeatherRecord[]) => {
  for (const record of records) {
    upsertHourlyStmt.run(record);
  }
});

// 전국 252개 시군구 최신 시간대 날씨 반환
export function getLatestWeather() {
  const latestTimeRow = db
    .prepare(`SELECT MAX(time) as maxTime FROM hourly_weather`)
    .get() as { maxTime: string | null } | undefined;

  const maxTime = latestTimeRow?.maxTime;
  if (!maxTime) {
    return { time: null, count: 0, data: {} };
  }

  const rows = db
    .prepare(
      `SELECT 
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
      WHERE time = ?`,
    )
    .all(maxTime) as WeatherRecord[];

  const data: Record<string, WeatherRecord> = {};
  for (const row of rows) {
    data[row.sigunguCode] = row;
  }

  return { time: maxTime, count: rows.length, data };
}

// 17개 광역시도별 최신 집계 통계
export function getSidoStats() {
  const latestTimeRow = db
    .prepare(`SELECT MAX(time) as maxTime FROM hourly_weather`)
    .get() as { maxTime: string | null } | undefined;

  const maxTime = latestTimeRow?.maxTime;
  if (!maxTime) {
    return { time: null, stats: [] };
  }

  const stats = db
    .prepare(
      `SELECT 
        sido_code as sidoCode,
        ROUND(AVG(COALESCE(pop, 0)), 1) as avgPop,
        MAX(COALESCE(pop, 0)) as maxPop,
        ROUND(SUM(COALESCE(rn1, 0)), 1) as totalRain,
        SUM(CASE WHEN pty > 0 THEN 1 ELSE 0 END) as rainingCount,
        COUNT(*) as totalCount
      FROM hourly_weather
      WHERE time = ?
      GROUP BY sido_code
      ORDER BY sido_code ASC`,
    )
    .all(maxTime) as SidoStat[];

  return { time: maxTime, stats };
}

// 특정 시군구 시계열 이력 조회
export function getTimeSeries(sigunguCode: string, limitHours = 48) {
  return db
    .prepare(
      `SELECT 
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
      LIMIT ?`,
    )
    .all(sigunguCode, limitHours) as WeatherRecord[];
}

// --- 💡 [핵심 신규 기능: 예보 vs 실황 검증 쿼리] ---

// 1. 기상청 예보 확률별 실제 강수 확률 (Empirical Rain Probability)
export function getEmpiricalProbabilityStats(minLeadHours = 1, maxLeadHours = 12) {
  const rows = db
    .prepare(
      `SELECT 
        predicted_pop as predictedPop,
        COUNT(*) as totalForecasts,
        SUM(actual_rain) as actualRainedCount,
        ROUND(100.0 * SUM(actual_rain) / COUNT(*), 1) as empiricalRainRate
      FROM v_forecast_accuracy
      WHERE actual_rain IS NOT NULL
        AND lead_hours BETWEEN ? AND ?
      GROUP BY predicted_pop
      ORDER BY predicted_pop ASC`,
    )
    .all(minLeadHours, maxLeadHours);

  return rows;
}

// 2. 17개 광역시도별 예보 신뢰도 & 적중률
export function getSidoReliabilityStats() {
  const rows = db
    .prepare(
      `SELECT 
        sido_code as sidoCode,
        ROUND(AVG(predicted_pop), 1) as avgPredictedPop,
        ROUND(100.0 * SUM(actual_rain) / COUNT(*), 1) as actualRainRate,
        ROUND(100.0 * SUM(is_accurate_30) / COUNT(*), 1) as accuracyRate30,
        COUNT(*) as sampleCount
      FROM v_forecast_accuracy
      WHERE actual_rain IS NOT NULL
      GROUP BY sido_code
      ORDER BY sido_code ASC`,
    )
    .all();

  return rows;
}

// 3. 리드타임(몇 시간 전 예보인가: 1h, 3h, 6h...)별 적중률 변화
export function getLeadTimeAccuracyStats() {
  const rows = db
    .prepare(
      `SELECT 
        lead_hours as leadHours,
        ROUND(AVG(predicted_pop), 1) as avgPredictedPop,
        ROUND(100.0 * SUM(actual_rain) / COUNT(*), 1) as actualRainRate,
        ROUND(100.0 * SUM(is_accurate_30) / COUNT(*), 1) as accuracyRate,
        COUNT(*) as sampleCount
      FROM v_forecast_accuracy
      WHERE actual_rain IS NOT NULL
      GROUP BY lead_hours
      ORDER BY lead_hours ASC`,
    )
    .all();

  return rows;
}
