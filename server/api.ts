import express from "express";
import cors from "cors";
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
import { syncAllWeather } from "./kma.ts";

dotenv.config({ path: resolve(process.cwd(), ".env.local") });

export const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;

app.use(cors());
app.use(express.json());

// --- 1. 지도 렌더링용 API ---
app.get("/api/weather/current", (req, res) => {
  try {
    res.json(getLatestWeather());
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/weather/sido-stats", (req, res) => {
  try {
    res.json(getSidoStats());
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

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

// --- 2. 예보 vs 실황 검증 및 신뢰도 분석 API ---
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

app.get("/api/analysis/sido-reliability", (req, res) => {
  try {
    res.json({ stats: getSidoReliabilityStats() });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/analysis/lead-time", (req, res) => {
  try {
    res.json({ stats: getLeadTimeAccuracyStats() });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// --- 3. 수동 동기화 트리거 (보안: 로컬호스트 or 시크릿 토큰) ---
let isSyncing = false;
app.post("/api/weather/sync", async (req, res) => {
  const secretHeader = req.headers["x-sync-secret"];
  const isLocal =
    req.ip === "127.0.0.1" ||
    req.ip === "::1" ||
    req.ip === "::ffff:127.0.0.1" ||
    req.hostname === "localhost";

  if (
    !isLocal &&
    process.env.SYNC_SECRET &&
    secretHeader !== process.env.SYNC_SECRET
  ) {
    return res.status(403).json({ error: "권한이 없습니다." });
  }

  if (isSyncing) {
    return res
      .status(409)
      .json({ message: "이미 수집 동기화 작업이 진행 중입니다." });
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

// 단독 실행 시 리슨
if (process.argv[1]?.endsWith("api.ts")) {
  app.listen(PORT, () => {
    console.log(`=============================================`);
    console.log(`🌐 [API Server] 날씨 API 서버 시작! http://localhost:${PORT}`);
    console.log(`=============================================`);
  });
}
