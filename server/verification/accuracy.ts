import type { Client } from "@libsql/client";

// 관측 시각을 예측한 직전 단기예보 발표 회차를 선택한다.
// 00~02시는 전날 23시, 03~05시는 당일 02시 발표분이다.
export function expectedForecastBaseTime(targetTime: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):00$/.exec(targetTime);
  if (!match) throw new Error(`잘못된 관측 시각: ${targetTime}`);

  const [, year, month, day, hour] = match;
  const target = new Date(Date.UTC(+year, +month - 1, +day, +hour));
  if (Number.isNaN(target.getTime()) || target.toISOString().slice(0, 13) !== `${year}-${month}-${day}T${hour}`) {
    throw new Error(`잘못된 관측 시각: ${targetTime}`);
  }

  target.setUTCHours(target.getUTCHours() - (+hour % 3 + 1));
  return target.toISOString().slice(0, 16).replace("T", " ");
}

// SQLite의 날짜 계산도 위 함수와 같은 발표 회차를 선택한다.
const expectedBaseSql = `substr(datetime(o.time, '-' || (CAST(strftime('%H', o.time) AS INTEGER) % 3 + 1) || ' hours'), 1, 16)`;

export async function createAccuracySchema(client: Client): Promise<void> {
  await client.execute(`
    CREATE TABLE IF NOT EXISTS forecast_verifications (
      target_time   TEXT NOT NULL,
      sigungu_code  TEXT NOT NULL,
      base_time     TEXT NOT NULL,
      sido_code     TEXT NOT NULL,
      name          TEXT NOT NULL,
      predicted_pop INTEGER NOT NULL,
      lead_hours    INTEGER NOT NULL,
      actual_rain   INTEGER NOT NULL,
      actual_rn1    REAL NOT NULL,
      actual_tmp    REAL,
      updated_at    TEXT NOT NULL,
      PRIMARY KEY (target_time, sigungu_code)
    )
  `);
  await client.execute(`
    CREATE INDEX IF NOT EXISTS idx_verifications_region_pop
    ON forecast_verifications(sigungu_code, predicted_pop)
  `);
  await client.execute(`
    CREATE TABLE IF NOT EXISTS verified_accuracy_stats (
      sigungu_code  TEXT NOT NULL,
      predicted_pop INTEGER NOT NULL,
      rain_count    INTEGER NOT NULL DEFAULT 0,
      total_count   INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (sigungu_code, predicted_pop)
    )
  `);
  await client.execute(`
    CREATE TRIGGER IF NOT EXISTS trg_verifications_insert
    AFTER INSERT ON forecast_verifications BEGIN
      INSERT INTO verified_accuracy_stats (sigungu_code, predicted_pop, rain_count, total_count)
      VALUES (NEW.sigungu_code, NEW.predicted_pop, NEW.actual_rain, 1)
      ON CONFLICT(sigungu_code, predicted_pop) DO UPDATE SET
        rain_count = rain_count + excluded.rain_count,
        total_count = total_count + 1;
    END
  `);
  await client.execute(`
    CREATE TRIGGER IF NOT EXISTS trg_verifications_update
    AFTER UPDATE ON forecast_verifications BEGIN
      UPDATE verified_accuracy_stats
      SET rain_count = rain_count - OLD.actual_rain,
          total_count = total_count - 1
      WHERE sigungu_code = OLD.sigungu_code AND predicted_pop = OLD.predicted_pop;
      DELETE FROM verified_accuracy_stats
      WHERE sigungu_code = OLD.sigungu_code AND predicted_pop = OLD.predicted_pop AND total_count = 0;
      INSERT INTO verified_accuracy_stats (sigungu_code, predicted_pop, rain_count, total_count)
      VALUES (NEW.sigungu_code, NEW.predicted_pop, NEW.actual_rain, 1)
      ON CONFLICT(sigungu_code, predicted_pop) DO UPDATE SET
        rain_count = rain_count + excluded.rain_count,
        total_count = total_count + 1;
    END
  `);
  await client.execute(`
    CREATE TRIGGER IF NOT EXISTS trg_verifications_delete
    AFTER DELETE ON forecast_verifications BEGIN
      UPDATE verified_accuracy_stats
      SET rain_count = rain_count - OLD.actual_rain,
          total_count = total_count - 1
      WHERE sigungu_code = OLD.sigungu_code AND predicted_pop = OLD.predicted_pop;
      DELETE FROM verified_accuracy_stats
      WHERE sigungu_code = OLD.sigungu_code AND predicted_pop = OLD.predicted_pop AND total_count = 0;
    END
  `);
  await client.execute("DROP VIEW IF EXISTS v_verified_forecast_accuracy");
}

// 마이그레이션 명령에서 빠진 원본만 보충한다. INSERT 한 문장이므로 부분 백필은 남지 않는다.
export async function backfillAccuracyVerifications(client: Client): Promise<number> {
  const result = await client.execute(`
    INSERT OR IGNORE INTO forecast_verifications (
      target_time, sigungu_code, base_time, sido_code, name,
      predicted_pop, lead_hours, actual_rain, actual_rn1, actual_tmp, updated_at
    )
    SELECT o.time, o.sigungu_code, f.base_time, o.sido_code, o.name,
      f.pop, f.lead_hours, o.is_raining, o.rn1, o.tmp, datetime('now')
    FROM weather_observations o
    JOIN weather_forecasts f
      ON f.target_time = o.time
     AND f.sigungu_code = o.sigungu_code
     AND f.base_time = ${expectedBaseSql}
    WHERE f.lead_hours BETWEEN 1 AND 3
  `);
  return result.rowsAffected;
}

// 같은 시각을 다시 수집해도 검증 결과 한 행만 갱신한다.
export async function upsertAccuracyForObservationTime(client: Client, observationTime: string): Promise<number> {
  const baseTime = expectedForecastBaseTime(observationTime);
  const result = await client.execute({
    sql: `
      INSERT INTO forecast_verifications (
        target_time, sigungu_code, base_time, sido_code, name,
        predicted_pop, lead_hours, actual_rain, actual_rn1, actual_tmp, updated_at
      )
      SELECT o.time, o.sigungu_code, f.base_time, o.sido_code, o.name,
        f.pop, f.lead_hours, o.is_raining, o.rn1, o.tmp, datetime('now')
      FROM weather_observations o
      JOIN weather_forecasts f
        ON f.target_time = o.time
       AND f.sigungu_code = o.sigungu_code
       AND f.base_time = ?
      WHERE o.time = ? AND f.lead_hours BETWEEN 1 AND 3
      ON CONFLICT(target_time, sigungu_code) DO UPDATE SET
        base_time = excluded.base_time,
        sido_code = excluded.sido_code,
        name = excluded.name,
        predicted_pop = excluded.predicted_pop,
        lead_hours = excluded.lead_hours,
        actual_rain = excluded.actual_rain,
        actual_rn1 = excluded.actual_rn1,
        actual_tmp = excluded.actual_tmp,
        updated_at = excluded.updated_at
    `,
    args: [baseTime, observationTime],
  });
  return result.rowsAffected;
}

// 예보가 관측보다 늦게 저장되거나 정정된 경우에도 검증 결과를 맞춘다.
export async function upsertAccuracyForForecastBaseTime(client: Client, baseTime: string): Promise<number> {
  const result = await client.execute({
    sql: `
      INSERT INTO forecast_verifications (
        target_time, sigungu_code, base_time, sido_code, name,
        predicted_pop, lead_hours, actual_rain, actual_rn1, actual_tmp, updated_at
      )
      SELECT o.time, o.sigungu_code, f.base_time, o.sido_code, o.name,
        f.pop, f.lead_hours, o.is_raining, o.rn1, o.tmp, datetime('now')
      FROM weather_forecasts f
      JOIN weather_observations o
        ON o.time = f.target_time AND o.sigungu_code = f.sigungu_code
      WHERE f.base_time = ? AND f.base_time = ${expectedBaseSql}
        AND f.lead_hours BETWEEN 1 AND 3
      ON CONFLICT(target_time, sigungu_code) DO UPDATE SET
        base_time = excluded.base_time,
        sido_code = excluded.sido_code,
        name = excluded.name,
        predicted_pop = excluded.predicted_pop,
        lead_hours = excluded.lead_hours,
        actual_rain = excluded.actual_rain,
        actual_rn1 = excluded.actual_rn1,
        actual_tmp = excluded.actual_tmp,
        updated_at = excluded.updated_at
    `,
    args: [baseTime],
  });
  return result.rowsAffected;
}
