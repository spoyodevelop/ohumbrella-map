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

// 헬퍼: 배열을 지정 크기 청크로 분할
function chunkArray<T>(array: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    result.push(array.slice(i, i + size));
  }
  return result;
}

// 1. 실황 업서트 (Turso batch 최적화)
export async function upsertObservationsBatch(records: ObservationRecord[]) {
  if (records.length === 0) return;

  const sql = `
    INSERT INTO weather_observations (
      time, sigungu_code, sido_code, name, is_raining, pty, rn1, tmp, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(time, sigungu_code) DO UPDATE SET
      is_raining = excluded.is_raining,
      pty = excluded.pty,
      rn1 = excluded.rn1,
      tmp = coalesce(excluded.tmp, weather_observations.tmp),
      created_at = excluded.created_at
  `;

  const chunks = chunkArray(records, 100);
  for (const chunk of chunks) {
    const stmts = chunk.map((r) => ({
      sql,
      args: [
        r.time,
        r.sigunguCode,
        r.sidoCode,
        r.name,
        r.isRaining,
        r.pty,
        r.rn1,
        r.tmp,
        r.createdAt,
      ],
    }));
    await db.batch(stmts, "write");
  }
}

// 2. 예보 업서트 (Turso batch 최적화)
export async function upsertForecastsBatch(records: ForecastRecord[]) {
  if (records.length === 0) return;

  const sql = `
    INSERT INTO weather_forecasts (
      base_time, target_time, sigungu_code, sido_code, name, pop, lead_hours, sky, tmp, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(base_time, target_time, sigungu_code) DO UPDATE SET
      pop = excluded.pop,
      lead_hours = excluded.lead_hours,
      sky = excluded.sky,
      tmp = coalesce(excluded.tmp, weather_forecasts.tmp),
      created_at = excluded.created_at
  `;

  const chunks = chunkArray(records, 100);
  for (const chunk of chunks) {
    const stmts = chunk.map((r) => ({
      sql,
      args: [
        r.baseTime,
        r.targetTime,
        r.sigunguCode,
        r.sidoCode,
        r.name,
        r.pop,
        r.leadHours,
        r.sky,
        r.tmp,
        r.createdAt,
      ],
    }));
    await db.batch(stmts, "write");
  }
}

// 3. 기존 지도 렌더링용 업서트
export async function upsertWeatherBatch(records: WeatherRecord[]) {
  if (records.length === 0) return;

  const sql = `
    INSERT INTO hourly_weather (
      time, sido_code, sigungu_code, name, pop, pty, rn1, tmp, sky, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(time, sigungu_code) DO UPDATE SET
      pop = coalesce(excluded.pop, hourly_weather.pop),
      pty = excluded.pty,
      rn1 = excluded.rn1,
      tmp = coalesce(excluded.tmp, hourly_weather.tmp),
      sky = coalesce(excluded.sky, hourly_weather.sky),
      updated_at = excluded.updated_at
  `;

  const chunks = chunkArray(records, 100);
  for (const chunk of chunks) {
    const stmts = chunk.map((r) => ({
      sql,
      args: [
        r.time,
        r.sidoCode,
        r.sigunguCode,
        r.name,
        r.pop,
        r.pty,
        r.rn1,
        r.tmp,
        r.sky,
        r.updatedAt,
      ],
    }));
    await db.batch(stmts, "write");
  }
}

// 4. 예보 수집 후 기존 실황 row의 pop/sky만 업데이트 (JOIN 제거용)
// 예보 발표 시각이 아닌, 시군구별 최신 실황 row에 덮어씀
export async function updateForecastPopBatch(
  records: { sigunguCode: string; pop: number; sky: number; updatedAt: string }[]
) {
  if (records.length === 0) return;

  const sql = `
    UPDATE hourly_weather
    SET pop = ?, sky = ?, updated_at = ?
    WHERE sigungu_code = ?
      AND time = (SELECT MAX(time) FROM hourly_weather WHERE sigungu_code = ?)
  `;

  const chunks = chunkArray(records, 100);
  for (const chunk of chunks) {
    const stmts = chunk.map((r) => ({
      sql,
      args: [r.pop, r.sky, r.updatedAt, r.sigunguCode, r.sigunguCode],
    }));
    await db.batch(stmts, "write");
  }
}

// 5. 실황 sync 후 해당 관측 시각의 예보-실황 매칭으로 정확도 집계 테이블 누적 업데이트
// 처리 대상: weather_forecasts WHERE target_time = observationTime (소규모 JOIN)
export async function updateAccuracyStats(observationTime: string) {
  const now = new Date().toISOString();
  await db.execute({
    sql: `
      INSERT INTO forecast_accuracy_stats
        (sigungu_code, predicted_pop, rain_count, total_count, updated_at)
      SELECT
        f.sigungu_code,
        f.pop              AS predicted_pop,
        SUM(o.is_raining)  AS rain_count,
        COUNT(*)           AS total_count,
        ?                  AS updated_at
      FROM weather_forecasts f
      INNER JOIN weather_observations o
        ON f.target_time = o.time
       AND f.sigungu_code = o.sigungu_code
      WHERE o.time = ?
      GROUP BY f.sigungu_code, f.pop
      ON CONFLICT(sigungu_code, predicted_pop) DO UPDATE SET
        rain_count  = rain_count  + excluded.rain_count,
        total_count = total_count + excluded.total_count,
        updated_at  = excluded.updated_at
    `,
    args: [now, observationTime],
  });
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
        COALESCE(h.pop, 0) as pop,
        COALESCE(h.pop, 0) as kmaPop,
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
      FROM forecast_accuracy_stats f
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
    const pop = row.kmaPop ?? 0;
    const local = localMap.get(`${row.sigunguCode}_${pop}`);
    const sido = sidoMap.get(`${row.sidoCode}_${pop}`);
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
      SELECT 
        h.sido_code as sidoCode,
        ROUND(AVG(COALESCE(h.pop, 0)), 1) as avgPop,
        MAX(COALESCE(h.pop, 0)) as maxPop,
        ROUND(SUM(COALESCE(h.rn1, 0)), 1) as totalRain,
        SUM(CASE WHEN h.pty > 0 OR h.rn1 > 0 THEN 1 ELSE 0 END) as rainingCount,
        COUNT(*) as totalCount
      FROM hourly_weather h
      INNER JOIN (
        SELECT sigungu_code, MAX(time) as max_time
        FROM hourly_weather
        GROUP BY sigungu_code
      ) latest ON h.sigungu_code = latest.sigungu_code AND h.time = latest.max_time
      GROUP BY h.sido_code
      ORDER BY h.sido_code ASC
    `),
    db.execute(`
      SELECT 
        h.sido_code as sidoCode,
        f.predicted_pop as predictedPop,
        SUM(f.rain_count) as rainCount,
        SUM(f.total_count) as samples
      FROM forecast_accuracy_stats f
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

// 1. 기상청 예보 확률별 실제 강수 확률 (Empirical Rain Probability)
export async function getEmpiricalProbabilityStats(
  minLeadHours = 1,
  maxLeadHours = 12,
) {
  const res = await db.execute({
    sql: `
      SELECT 
        predicted_pop as predictedPop,
        COUNT(*) as totalForecasts,
        SUM(actual_rain) as actualRainedCount,
        ROUND(100.0 * SUM(actual_rain) / COUNT(*), 1) as empiricalRainRate
      FROM v_forecast_accuracy
      WHERE actual_rain IS NOT NULL
        AND lead_hours BETWEEN ? AND ?
      GROUP BY predicted_pop
      ORDER BY predicted_pop ASC
    `,
    args: [minLeadHours, maxLeadHours],
  });

  return res.rows;
}

// 2. 17개 광역시도별 예보 신뢰도 & 적중률
export async function getSidoReliabilityStats() {
  const res = await db.execute(`
    SELECT 
      sido_code as sidoCode,
      ROUND(AVG(predicted_pop), 1) as avgPredictedPop,
      ROUND(100.0 * SUM(actual_rain) / COUNT(*), 1) as actualRainRate,
      ROUND(100.0 * SUM(is_accurate_30) / COUNT(*), 1) as accuracyRate30,
      COUNT(*) as sampleCount
    FROM v_forecast_accuracy
    WHERE actual_rain IS NOT NULL
    GROUP BY sido_code
    ORDER BY sido_code ASC
  `);

  return res.rows;
}

export async function getLeadTimeAccuracyStats() {
  const res = await db.execute(`
    SELECT 
      lead_hours as leadHours,
      ROUND(AVG(predicted_pop), 1) as avgPredictedPop,
      ROUND(100.0 * SUM(actual_rain) / COUNT(*), 1) as actualRainRate,
      ROUND(100.0 * SUM(is_accurate_30) / COUNT(*), 1) as accuracyRate,
      COUNT(*) as sampleCount
    FROM v_forecast_accuracy
    WHERE actual_rain IS NOT NULL
    GROUP BY lead_hours
    ORDER BY lead_hours ASC
  `);

  return res.rows;
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

export async function getRegionProbabilityInsight(
  sigunguCode: string,
  targetPop?: number,
): Promise<RegionProbabilityInsight | null> {
  const currentRes = await db.execute({
    sql: `
      SELECT 
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
      LIMIT 1
    `,
    args: [sigunguCode],
  });

  const current = currentRes.rows[0] as unknown as
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
  const popToQuery = targetPop ?? current.kmaPop ?? 30;

  const [localRes, sidoRes, nationalRes] = await Promise.all([
    db.execute({
      sql: `
        SELECT 
          COUNT(*) as sampleCount,
          ROUND(100.0 * SUM(actual_rain) / COUNT(*), 1) as actualRainRate
        FROM v_forecast_accuracy
        WHERE sigungu_code = ? AND predicted_pop = ? AND actual_rain IS NOT NULL
      `,
      args: [sigunguCode, popToQuery],
    }),
    db.execute({
      sql: `
        SELECT 
          COUNT(*) as sidoSampleCount,
          ROUND(100.0 * SUM(actual_rain) / COUNT(*), 1) as sidoRainRate
        FROM v_forecast_accuracy
        WHERE sido_code = ? AND predicted_pop = ? AND actual_rain IS NOT NULL
      `,
      args: [sidoCode, popToQuery],
    }),
    db.execute({
      sql: `
        SELECT 
          COUNT(*) as nationalSampleCount,
          ROUND(100.0 * SUM(actual_rain) / COUNT(*), 1) as nationalRainRate
        FROM v_forecast_accuracy
        WHERE predicted_pop = ? AND actual_rain IS NOT NULL
      `,
      args: [popToQuery],
    }),
  ]);

  const localRow = localRes.rows[0] as unknown as {
    sampleCount: number;
    actualRainRate: number | null;
  };
  const sidoRow = sidoRes.rows[0] as unknown as {
    sidoSampleCount: number;
    sidoRainRate: number | null;
  };
  const nationalRow = nationalRes.rows[0] as unknown as {
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
      sampleCount: Number(localRow?.sampleCount ?? 0),
      sidoRainRate: sidoRow?.sidoRainRate ?? null,
      sidoSampleCount: Number(sidoRow?.sidoSampleCount ?? 0),
      nationalRainRate: nationalRow?.nationalRainRate ?? null,
      nationalSampleCount: Number(nationalRow?.nationalSampleCount ?? 0),
    },
  };
}
