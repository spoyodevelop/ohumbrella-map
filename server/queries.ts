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

// 전국 252개 시군구 최신 날씨 반환
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
        h.time,
        h.sido_code as sidoCode,
        h.sigungu_code as sigunguCode,
        h.name,
        h.pop,
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
      ) latest ON h.sigungu_code = latest.sigungu_code AND h.time = latest.max_time`,
    )
    .all() as WeatherRecord[];

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
        h.sido_code as sidoCode,
        ROUND(AVG(COALESCE(h.pop, 0)), 1) as avgPop,
        MAX(COALESCE(h.pop, 0)) as maxPop,
        ROUND(SUM(COALESCE(h.rn1, 0)), 1) as totalRain,
        SUM(CASE WHEN h.pty > 0 THEN 1 ELSE 0 END) as rainingCount,
        COUNT(*) as totalCount
      FROM hourly_weather h
      INNER JOIN (
        SELECT sigungu_code, MAX(time) as max_time
        FROM hourly_weather
        GROUP BY sigungu_code
      ) latest ON h.sigungu_code = latest.sigungu_code AND h.time = latest.max_time
      GROUP BY h.sido_code
      ORDER BY h.sido_code ASC`,
    )
    .all() as SidoStat[];

  return { time: maxTime, stats };
}

// 특정 시군구 미래 예보 타임라인 조회 (가장 최근에 성공한 base_time의 미래 예보를 가져옴)
export function getForecastTimeline(sigunguCode: string, hours = 24) {
  const latestBaseTimeRow = db
    .prepare(
      `SELECT MAX(base_time) as maxBaseTime
       FROM weather_forecasts
       WHERE sigungu_code = ?`,
    )
    .get(sigunguCode) as { maxBaseTime: string | null } | undefined;

  const maxBaseTime = latestBaseTimeRow?.maxBaseTime;
  if (!maxBaseTime) {
    return [];
  }

  const rows = db
    .prepare(
      `SELECT 
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
      LIMIT ?`,
    )
    .all(sigunguCode, maxBaseTime, hours) as ForecastRecord[];

  return rows;
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
export function getEmpiricalProbabilityStats(
  minLeadHours = 1,
  maxLeadHours = 12,
) {
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

// 4. 특정 지역 & 강수확률(POP) 기준 실측/경험적 강수 확률 및 현재 현황 조회
export interface RegionProbabilityInsight {
  code: string;
  name: string;
  sidoCode: string;
  current: {
    time: string | null;
    kmaPop: number | null;
    isRaining: number;
    pty: number;
    rn1: number;
    tmp: number | null;
    sky: number;
  } | null;
  empirical: {
    targetPop: number;
    actualRainRate: number | null;
    sampleCount: number;
    sidoRainRate: number | null;
    sidoSampleCount: number;
    nationalRainRate: number | null;
    nationalSampleCount: number;
  };
}

export function getRegionProbabilityInsight(
  sigunguCode: string,
  targetPop?: number,
): RegionProbabilityInsight | null {
  const current = db
    .prepare(
      `SELECT 
        time,
        sido_code as sidoCode,
        sigungu_code as sigunguCode,
        name,
        pop as kmaPop,
        pty,
        rn1,
        tmp,
        sky
      FROM hourly_weather
      WHERE sigungu_code = ?
      ORDER BY time DESC
      LIMIT 1`,
    )
    .get(sigunguCode) as
    | {
        time: string;
        sidoCode: string;
        sigunguCode: string;
        name: string;
        kmaPop: number | null;
        pty: number;
        rn1: number;
        tmp: number | null;
        sky: number;
      }
    | undefined;

  if (!current) {
    return null;
  }

  const sidoCode = current.sidoCode;
  const sigunguName = current.name;
  const popToQuery =
    targetPop !== undefined ? targetPop : (current.kmaPop ?? 30);

  // 시군구 단위 표본
  const localRow = db
    .prepare(
      `SELECT 
        COUNT(*) as sampleCount,
        ROUND(100.0 * SUM(actual_rain) / COUNT(*), 1) as actualRainRate
      FROM v_forecast_accuracy
      WHERE sigungu_code = ? AND predicted_pop = ? AND actual_rain IS NOT NULL`,
    )
    .get(sigunguCode, popToQuery) as {
    sampleCount: number;
    actualRainRate: number | null;
  };

  // 시도 광역 단위 표본
  const sidoRow = db
    .prepare(
      `SELECT 
        COUNT(*) as sidoSampleCount,
        ROUND(100.0 * SUM(actual_rain) / COUNT(*), 1) as sidoRainRate
      FROM v_forecast_accuracy
      WHERE sido_code = ? AND predicted_pop = ? AND actual_rain IS NOT NULL`,
    )
    .get(sidoCode, popToQuery) as {
    sidoSampleCount: number;
    sidoRainRate: number | null;
  };

  // 전국 단위 표본
  const nationalRow = db
    .prepare(
      `SELECT 
        COUNT(*) as nationalSampleCount,
        ROUND(100.0 * SUM(actual_rain) / COUNT(*), 1) as nationalRainRate
      FROM v_forecast_accuracy
      WHERE predicted_pop = ? AND actual_rain IS NOT NULL`,
    )
    .get(popToQuery) as {
    nationalSampleCount: number;
    nationalRainRate: number | null;
  };

  const isRaining = current.pty > 0 || current.rn1 > 0 ? 1 : 0;

  return {
    code: sigunguCode,
    name: sigunguName,
    sidoCode,
    current: {
      time: current.time,
      kmaPop: current.kmaPop,
      isRaining,
      pty: current.pty,
      rn1: current.rn1,
      tmp: current.tmp,
      sky: current.sky,
    },
    empirical: {
      targetPop: popToQuery,
      actualRainRate: localRow?.actualRainRate ?? null,
      sampleCount: localRow?.sampleCount ?? 0,
      sidoRainRate: sidoRow?.sidoRainRate ?? null,
      sidoSampleCount: sidoRow?.sidoSampleCount ?? 0,
      nationalRainRate: nationalRow?.nationalRainRate ?? null,
      nationalSampleCount: nationalRow?.nationalSampleCount ?? 0,
    },
  };
}
