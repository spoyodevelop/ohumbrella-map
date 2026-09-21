import { db } from "../db.ts";

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

export interface ObservationReadModelRecord {
  time: string;
  sidoCode: string;
  sigunguCode: string;
  name: string;
  pty: number;
  rn1: number;
  tmp: number | null;
  updatedAt: string;
}

function chunkArray<T>(array: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    result.push(array.slice(i, i + size));
  }
  return result;
}

// 1. 실황 업서트
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

// 2. 예보 업서트
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

// 해당 관측 시각에 유효한 가장 최근 발표 예보를 사용한다.
const matchingForecast = `
  FROM weather_forecasts f
  WHERE f.target_time = hourly_weather.time
    AND f.sigungu_code = hourly_weather.sigungu_code
    AND f.base_time <= hourly_weather.time
  ORDER BY f.base_time DESC
  LIMIT 1
`;

// 3. 새 실황 행에는 해당 시각의 예보를 채우고, 재수집 때는 예보 필드를 보존한다.
export async function upsertObservationReadModelBatch(records: ObservationReadModelRecord[]) {
  if (records.length === 0) return;

  const sql = `
    INSERT INTO hourly_weather (
      time, sido_code, sigungu_code, name, pop, pty, rn1, tmp, sky, updated_at
    ) VALUES (
      ?, ?, ?, ?,
      (SELECT pop FROM weather_forecasts WHERE target_time = ? AND sigungu_code = ? AND base_time <= ? ORDER BY base_time DESC LIMIT 1),
      ?, ?, ?,
      (SELECT sky FROM weather_forecasts WHERE target_time = ? AND sigungu_code = ? AND base_time <= ? ORDER BY base_time DESC LIMIT 1),
      ?
    )
    ON CONFLICT(time, sigungu_code) DO UPDATE SET
      pty = excluded.pty,
      rn1 = excluded.rn1,
      tmp = coalesce(excluded.tmp, hourly_weather.tmp),
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
        r.time,
        r.sigunguCode,
        r.time,
        r.pty,
        r.rn1,
        r.tmp,
        r.time,
        r.sigunguCode,
        r.time,
        r.updatedAt,
      ],
    }));
    await db.batch(stmts, "write");
  }
}

// 4. 예보가 나중에 도착한 경우 최신 실황 행과 대상 시각이 맞을 때만 반영한다.
export async function updateLatestForecastReadModelBatch(
  records: {
    sigunguCode: string;
    updatedAt: string;
  }[],
) {
  if (records.length === 0) return;

  const sql = `
    UPDATE hourly_weather
    SET (pop, sky) = (SELECT f.pop, f.sky ${matchingForecast}),
        updated_at = ?
    WHERE sigungu_code = ?
      AND time = (SELECT MAX(time) FROM hourly_weather WHERE sigungu_code = ?)
      AND EXISTS (SELECT 1 ${matchingForecast})
  `;

  const chunks = chunkArray(records, 100);
  for (const chunk of chunks) {
    const stmts = chunk.map((r) => ({
      sql,
      args: [r.updatedAt, r.sigunguCode, r.sigunguCode],
    }));
    await db.batch(stmts, "write");
  }
}
