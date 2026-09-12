import Database from "better-sqlite3";
import { resolve } from "node:path";
import { mkdirSync } from "node:fs";

const root = process.cwd();
const dataDir = resolve(root, "data");
mkdirSync(dataDir, { recursive: true });

const dbPath = resolve(dataDir, "weather.sqlite");
export const db = new Database(dbPath);

// 성능 최적화 PRAGMA 설정
db.pragma("journal_mode = WAL");
db.pragma("synchronous = NORMAL");

// 테이블 및 인덱스 초기화
db.exec(`
  -- 1. 실황 테이블 (1시간마다 실제 관측된 비/기온 데이터)
  CREATE TABLE IF NOT EXISTS weather_observations (
    time          TEXT NOT NULL,         -- 관측 시각 (예: '2026-09-12 15:00')
    sigungu_code  TEXT NOT NULL,         -- 시군구 코드 (예: '11010')
    sido_code     TEXT NOT NULL,         -- 시도 코드 (예: '11')
    name          TEXT NOT NULL,         -- 종로구
    is_raining    INTEGER NOT NULL,      -- 1: 비옴 (PTY>0 or RN1>0), 0: 안옴
    pty           INTEGER DEFAULT 0,     -- 강수형태 (0, 1, 2, 3...)
    rn1           REAL DEFAULT 0,        -- 1시간 강수량 (mm)
    tmp           REAL,                  -- 기온 (℃)
    created_at    TEXT NOT NULL,
    PRIMARY KEY (time, sigungu_code)
  );

  CREATE INDEX IF NOT EXISTS idx_obs_time ON weather_observations(time);
  CREATE INDEX IF NOT EXISTS idx_obs_sido ON weather_observations(sido_code, time);

  -- 2. 예보 테이블 (3시간마다 발표되는 미래 시간대별 강수확률 POP 데이터)
  CREATE TABLE IF NOT EXISTS weather_forecasts (
    base_time     TEXT NOT NULL,         -- 예보 발표 시각 (예: '2026-09-12 12:00')
    target_time   TEXT NOT NULL,         -- 예보 대상 시각 (예: '2026-09-12 15:00')
    sigungu_code  TEXT NOT NULL,         -- 시군구 코드
    sido_code     TEXT NOT NULL,         -- 시도 코드
    name          TEXT NOT NULL,
    pop           INTEGER NOT NULL,      -- 예보 강수확률 (0~100)
    lead_hours    INTEGER NOT NULL,      -- 몇 시간 전 예보인가? (예: 3)
    sky           INTEGER DEFAULT 1,     -- 하늘상태
    tmp           REAL,                  -- 예보 기온
    created_at    TEXT NOT NULL,
    PRIMARY KEY (base_time, target_time, sigungu_code)
  );

  CREATE INDEX IF NOT EXISTS idx_fcst_target ON weather_forecasts(target_time, sigungu_code);
  CREATE INDEX IF NOT EXISTS idx_fcst_base ON weather_forecasts(base_time);
  CREATE INDEX IF NOT EXISTS idx_fcst_sido ON weather_forecasts(sido_code, target_time);

  -- 3. 예보 vs 실황 대조 뷰 (분석 및 적중률 계산용 마법의 뷰)
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
    END AS is_accurate_30 -- 30% 기준 적중 여부
  FROM weather_forecasts f
  LEFT JOIN weather_observations o 
    ON f.target_time = o.time 
   AND f.sigungu_code = o.sigungu_code;

  -- 4. 지도 렌더링용 기존 통합 테이블 (호환성 유지)
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
