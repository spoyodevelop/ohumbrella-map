import express from "express";
import cors from "cors";
import cron from "node-cron";
import dotenv from "dotenv";
import { resolve } from "node:path";
import {
  getLatestWeather,
  getSidoStats,
  getTimeSeries,
  getEmpiricalProbabilityStats,
  getSidoReliabilityStats,
  getLeadTimeAccuracyStats,
} from "./queries.ts";
import {
  checkCanaryNcstUpdated,
  syncAllWeather,
  getNcstBaseDateTime,
} from "./kma.ts";

dotenv.config({ path: resolve(process.cwd(), ".env.local") });

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;

app.use(cors());
app.use(express.json());

// --- 1. 지도 렌더링용 기본 API ---

// 전국 252개 시군구 최신 날씨 (지도 색칠용)
app.get("/api/weather/current", (req, res) => {
  try {
    const result = getLatestWeather();
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 17개 광역시도별 최신 집계 통계
app.get("/api/weather/sido-stats", (req, res) => {
  try {
    const result = getSidoStats();
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 특정 구 시계열 이력
app.get("/api/weather/timeseries/:code", (req, res) => {
  try {
    const { code } = req.params;
    const hours = req.query.hours
      ? parseInt(req.query.hours as string, 10)
      : 48;
    const result = getTimeSeries(code, hours);
    res.json({ sigunguCode: code, count: result.length, history: result });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// --- 2. 💡 [핵심: 예보 vs 실황 검증 및 신뢰도 분석 API] ---

// 기상청 예보 확률별 실제 비 온 비율 (진짜 강수확률)
// 예: 기상청이 30%라고 했을 때 실제 비가 온 비율은 몇 %인가?
app.get("/api/analysis/empirical-probability", (req, res) => {
  try {
    const minLead = req.query.minLead
      ? parseInt(req.query.minLead as string, 10)
      : 1;
    const maxLead = req.query.maxLead
      ? parseInt(req.query.maxLead as string, 10)
      : 24;
    const stats = getEmpiricalProbabilityStats(minLead, maxLead);
    res.json({ minLeadHours: minLead, maxLeadHours: maxLead, stats });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 17개 광역시도별 예보 신뢰도 & 적중률
app.get("/api/analysis/sido-reliability", (req, res) => {
  try {
    const stats = getSidoReliabilityStats();
    res.json({ stats });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 리드타임(몇 시간 전 예보인가: 1h, 3h, 6h...)별 적중률 변화
app.get("/api/analysis/lead-time", (req, res) => {
  try {
    const stats = getLeadTimeAccuracyStats();
    res.json({ stats });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// --- 3. 수동 동기화 트리거 ---
let isSyncing = false;
app.post("/api/weather/sync", async (req, res) => {
  if (isSyncing) {
    return res
      .status(409)
      .json({ message: "이미 동기화 작업이 진행 중입니다." });
  }
  isSyncing = true;
  res.json({ message: "전국 실황 및 미래 예보 수집을 시작했습니다." });

  try {
    await syncAllWeather();
  } catch (err: any) {
    console.error("[수동 수집 에러]", err);
  } finally {
    isSyncing = false;
  }
});

// --- 4. 스케줄러 ---
let lastSyncedBaseTime = "";

// 1) 매시 15~40분 사이 3분 간격 카나리 감시 -> 실황 조기 오픈 시 즉시 수집
cron.schedule("15-40/3 * * * *", async () => {
  if (isSyncing) return;
  const canary = await checkCanaryNcstUpdated(lastSyncedBaseTime);
  if (canary.updated) {
    console.log(`[스케줄러] 새 실황(${canary.baseTime}) 감지! 전국 수집 실행`);
    isSyncing = true;
    try {
      await syncAllWeather();
      lastSyncedBaseTime = canary.baseTime;
    } catch (err) {
      console.error("[스케줄러 수집 에러]", err);
    } finally {
      isSyncing = false;
    }
  }
});

// 2) 3시간 주기 단기예보 발표 시점 (02:20, 05:20, 08:20, 11:20, 14:20, 17:20, 20:20, 23:20)
cron.schedule("20 2,5,8,11,14,17,20,23 * * *", async () => {
  if (isSyncing) return;
  console.log("[스케줄러] 3시간 주기 단기예보 발표 시점 - 정기 동기화 시작");
  isSyncing = true;
  try {
    await syncAllWeather();
  } catch (err) {
    console.error("[스케줄러 단기예보 에러]", err);
  } finally {
    isSyncing = false;
  }
});

app.listen(PORT, async () => {
  console.log(`=============================================`);
  console.log(`🚀 날씨 검증/분석 백엔드 서버 시작! http://localhost:${PORT}`);
  console.log(`=============================================`);

  // 서버 시작 시 최초 1회 수집
  isSyncing = true;
  try {
    await syncAllWeather();
    const { baseTime } = getNcstBaseDateTime();
    lastSyncedBaseTime = baseTime;
  } catch (err) {
    console.error("[초기 수집 실패]", err);
  } finally {
    isSyncing = false;
  }
});
