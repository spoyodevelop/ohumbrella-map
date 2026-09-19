import { createClient, type Client } from "@libsql/client";
import { resolve, dirname } from "node:path";
import { mkdirSync } from "node:fs";
import dotenv from "dotenv";

// .env.local과 .env 둘 다 순서대로 확인하여 로드
dotenv.config({ path: resolve(process.cwd(), ".env.local") });
dotenv.config({ path: resolve(process.cwd(), ".env") });

const tursoUrl = process.env.TURSO_DATABASE_URL;
const tursoAuthToken = process.env.TURSO_AUTH_TOKEN;

let client: Client;

if (tursoUrl) {
  console.log(`=============================================`);
  console.log(`☁️  [DB] Turso 원격 클라우드 DB 연결 성공!`);
  console.log(`   Endpoint: ${tursoUrl}`);
  console.log(`=============================================`);
  client = createClient({
    url: tursoUrl,
    authToken: tursoAuthToken,
  });
} else {
  const dbPath = process.env.DATABASE_PATH
    ? resolve(process.cwd(), process.env.DATABASE_PATH)
    : resolve(process.cwd(), "data", "weather.sqlite");
  mkdirSync(dirname(dbPath), { recursive: true });
  console.log(`=============================================`);
  console.warn(`📁 [DB 주의] TURSO_DATABASE_URL 환경변수 없음!`);
  console.warn(`   -> 로컬 SQLite 파일 모드로 동작합니다: ${dbPath}`);
  console.log(`=============================================`);
  client = createClient({
    url: `file:${dbPath}`,
  });
}

export const db = client;

let initPromise: Promise<void> | null = null;

// 초기 테이블 생성 (원격 DB 또는 로컬 DB에 없을 경우 생성)
export async function initDb() {
  if (initPromise) return initPromise;

  initPromise = (async () => {
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

    await db.execute(`DROP VIEW IF EXISTS v_forecast_accuracy;`);
    await db.execute(`
    CREATE VIEW v_forecast_accuracy AS
    SELECT 
      f.target_time,
      f.base_time,
      f.sigungu_code,
      f.sido_code,
      f.name,
      f.lead_hours,
      f.pop AS predicted_pop,
      o.is_raining AS actual_rain,
      o.rn1 AS actual_rn1,
      o.tmp AS actual_tmp,
      CASE 
        WHEN o.is_raining IS NULL THEN NULL
        WHEN (f.pop >= 30 AND o.is_raining = 1) OR (f.pop < 30 AND o.is_raining = 0) THEN 1
        ELSE 0
      END AS is_accurate_30
    FROM weather_forecasts f
    LEFT JOIN weather_observations o 
      ON f.target_time = o.time 
     AND f.sigungu_code = o.sigungu_code;
  `);
    // 예보 정확도 집계 테이블 (시군구 × pop_bucket → 누적 카운터)
    // 조회 비용: 항상 최대 2,772 rows (sigungu 252 × pop bucket 최대 11)
    await db.execute(`
    CREATE TABLE IF NOT EXISTS forecast_accuracy_stats (
      sigungu_code  TEXT     NOT NULL,
      predicted_pop INTEGER  NOT NULL,
      rain_count    INTEGER  NOT NULL DEFAULT 0,
      total_count   INTEGER  NOT NULL DEFAULT 0,
      updated_at    TEXT     NOT NULL,
      PRIMARY KEY (sigungu_code, predicted_pop)
    );
  `);

    // 테이블이 비어있으면 기존 v_forecast_accuracy 데이터로 일회성 backfill
    const statsCountRes = await db.execute(
      `SELECT COUNT(*) as cnt FROM forecast_accuracy_stats`
    );
    const statsCount = (statsCountRes.rows[0]?.cnt as number) ?? 0;
    if (statsCount === 0) {
      console.log(`🔄 [DB 스키마] forecast_accuracy_stats 초기 backfill 실행...`);
      await db.execute(`
        INSERT OR IGNORE INTO forecast_accuracy_stats
          (sigungu_code, predicted_pop, rain_count, total_count, updated_at)
        SELECT
          sigungu_code,
          predicted_pop,
          SUM(actual_rain)   AS rain_count,
          COUNT(*)           AS total_count,
          datetime('now')    AS updated_at
        FROM v_forecast_accuracy
        WHERE actual_rain IS NOT NULL
        GROUP BY sigungu_code, predicted_pop
      `);
      console.log(`✅ [DB 스키마] forecast_accuracy_stats backfill 완료`);
    }

    console.log(`✅ [DB 스키마] 모든 테이블, 인덱스, 뷰 준비 완료!`);
  })().catch((err) => {
    initPromise = null;
    throw err;
  });

  return initPromise;
}
