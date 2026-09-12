import Database from "better-sqlite3";
import { resolve, dirname } from "node:path";
import { mkdirSync } from "node:fs";
import dotenv from "dotenv";

dotenv.config({ path: resolve(process.cwd(), ".env.local") });

// DATABASE_PATH 환경변수가 있으면 해당 경로 사용, 없으면 기본 data/weather.sqlite
const dbPath = process.env.DATABASE_PATH
  ? resolve(process.cwd(), process.env.DATABASE_PATH)
  : resolve(process.cwd(), "data", "weather.sqlite");

mkdirSync(dirname(dbPath), { recursive: true });

export const db = new Database(dbPath);

// 멀티 프로세스 동시성 및 초고속 읽기/쓰기 최적화 PRAGMA
db.pragma("journal_mode = WAL");
db.pragma("synchronous = NORMAL");
db.pragma("busy_timeout = 5000"); // 다른 프로세스가 쓸 때 5초간 대기 (충돌 방지)

// 테이블 및 인덱스 초기화
db.exec(`
  -- 1. 실황 테이블 (1시간마다 실제 관측된 비/기온 데이터)
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

  CREATE INDEX IF NOT EXISTS idx_obs_time ON weather_observations(time);
  CREATE INDEX IF NOT EXISTS idx_obs_sido ON weather_observations(sido_code, time);

  -- 2. 예보 테이블 (3시간마다 발표되는 미래 시간대별 강수확률 POP 데이터)
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

  CREATE INDEX IF NOT EXISTS idx_fcst_target ON weather_forecasts(target_time, sigungu_code);
  CREATE INDEX IF NOT EXISTS idx_fcst_base ON weather_forecasts(base_time);
  CREATE INDEX IF NOT EXISTS idx_fcst_sido ON weather_forecasts(sido_code, target_time);

  -- 3. 예보 vs 실황 대조 뷰
  DROP VIEW IF EXISTS v_forecast_accuracy;
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

  -- 4. 지도 렌더링용 기존 통합 테이블
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

  CREATE INDEX IF NOT EXISTS idx_weather_time ON hourly_weather(time);
  CREATE INDEX IF NOT EXISTS idx_weather_sido_time ON hourly_weather(sido_code, time);
  CREATE INDEX IF NOT EXISTS idx_weather_sigungu_time ON hourly_weather(sigungu_code, time);
`);
