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

// 3. 현재 날씨 조회용 테이블에는 실황 필드만 반영한다. 예보 필드는 예보 수집이 소유한다.
export async function upsertObservationReadModelBatch(records: ObservationReadModelRecord[]) {
  if (records.length === 0) return;

  const sql = `
    INSERT INTO hourly_weather (
      time, sido_code, sigungu_code, name, pop, pty, rn1, tmp, sky, updated_at
    ) VALUES (?, ?, ?, ?, NULL, ?, ?, ?, NULL, ?)
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
        r.pty,
        r.rn1,
        r.tmp,
        r.updatedAt,
      ],
    }));
    await db.batch(stmts, "write");
  }
}

// 4. 예보 수집 후 기존 실황 row의 pop/sky만 업데이트 (JOIN 제거용)
// 예보 발표 시각이 아닌, 시군구별 최신 실황 row에 덮어씀
export async function updateLatestForecastReadModelBatch(
  records: {
    sigunguCode: string;
    pop: number;
    sky: number;
    updatedAt: string;
  }[],
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
