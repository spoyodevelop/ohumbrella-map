import { db } from "../db.ts";
import { backfillAccuracyVerifications, createAccuracySchema } from "../verification/accuracy.ts";

let migrationPromise: Promise<void> | null = null;

// 명시적 명령에서만 스키마를 준비하고 빠진 검증 결과를 보충한다.
export async function migrateDb() {
  if (migrationPromise) return migrationPromise;

  migrationPromise = (async () => {
    console.log(`🔨 [DB 스키마] 테이블 및 뷰(View) 존재 여부 검사 및 생성 시작...`);
    await db.execute(`
    CREATE TABLE IF NOT EXISTS weather_observations (
      time          TEXT NOT NULL,
      sigungu_code  TEXT NOT NULL,
      sido_code     TEXT NOT NULL,
      name          TEXT NOT NULL,
      is_raining    INTEGER NOT NULL,
      pty           INTEGER DEFAULT 0,
      rn1           REAL DEFAULT 0,
      tmp           REAL,
      created_at    TEXT NOT NULL,
      PRIMARY KEY (time, sigungu_code)
    );
  `);

    await db.execute(`
    CREATE INDEX IF NOT EXISTS idx_obs_time ON weather_observations(time);
  `);
    await db.execute(`
    CREATE INDEX IF NOT EXISTS idx_obs_sido ON weather_observations(sido_code, time);
  `);

    await db.execute(`
    CREATE TABLE IF NOT EXISTS weather_forecasts (
      base_time     TEXT NOT NULL,
      target_time   TEXT NOT NULL,
      sigungu_code  TEXT NOT NULL,
      sido_code     TEXT NOT NULL,
      name          TEXT NOT NULL,
      pop           INTEGER NOT NULL,
      lead_hours    INTEGER NOT NULL,
      sky           INTEGER DEFAULT 1,
      tmp           REAL,
      created_at    TEXT NOT NULL,
      PRIMARY KEY (base_time, target_time, sigungu_code)
    );
  `);

    await db.execute(`
    CREATE INDEX IF NOT EXISTS idx_fcst_target ON weather_forecasts(target_time, sigungu_code);
  `);
    await db.execute(`
    CREATE INDEX IF NOT EXISTS idx_fcst_base ON weather_forecasts(base_time);
  `);
    await db.execute(`
    CREATE INDEX IF NOT EXISTS idx_fcst_sido ON weather_forecasts(sido_code, target_time);
  `);

    await db.execute(`
    CREATE TABLE IF NOT EXISTS hourly_weather (
      time          TEXT NOT NULL,
      sido_code     TEXT NOT NULL,
      sigungu_code  TEXT NOT NULL,
      name          TEXT NOT NULL,
      pop           INTEGER,
      pty           INTEGER DEFAULT 0,
      rn1           REAL DEFAULT 0,
      tmp           REAL,
      sky           INTEGER DEFAULT 1,
      updated_at    TEXT NOT NULL,
      PRIMARY KEY (time, sigungu_code)
    );
  `);

    await db.execute(`
    CREATE INDEX IF NOT EXISTS idx_weather_time ON hourly_weather(time);
  `);
    await db.execute(`
    CREATE INDEX IF NOT EXISTS idx_weather_sido_time ON hourly_weather(sido_code, time);
  `);
    await db.execute(`
    CREATE INDEX IF NOT EXISTS idx_weather_sigungu_time ON hourly_weather(sigungu_code, time);
  `);

    await db.execute("DROP VIEW IF EXISTS v_forecast_accuracy");
    await db.execute("DROP TABLE IF EXISTS forecast_accuracy_stats");
    await createAccuracySchema(db);
    // 이전 버전 워커가 돌아가는 동안 생긴 표본도 명시적 마이그레이션 때 보충한다.
    // 이미 검증한 관측은 기본키와 INSERT OR IGNORE로 중복 계산하지 않는다.
    const inserted = await backfillAccuracyVerifications(db);
    console.log(`[DB 스키마] 한 관측당 한 예보 검증 결과 ${inserted}건 보충`);

    console.log(`✅ [DB 스키마] 모든 테이블, 인덱스, 뷰 준비 완료!`);
  })().catch((err) => {
    migrationPromise = null;
    throw err;
  });

  return migrationPromise;
}
