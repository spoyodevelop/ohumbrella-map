import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { resolve } from "node:path";
import {
  getLatestWeather,
  getSidoStats,
  getTimeSeries,
  getForecastTimeline,
  getRegionProbabilityInsight,
  getEmpiricalProbabilityStats,
  getSidoReliabilityStats,
  getLeadTimeAccuracyStats,
} from "./queries.ts";
import { syncAllWeather } from "./kma.ts";

dotenv.config({ path: resolve(process.cwd(), ".env.local") });
dotenv.config({ path: resolve(process.cwd(), ".env") });

export const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;

app.use(cors());
app.use(express.json());

// --- 0. 위치 기반 역지오코딩 API (네이버 클라우드 프록시) ---
app.get("/api/gc", async (req, res) => {
  try {
    const clientId =
      process.env.NAVER_CLIENT_ID || process.env.VITE_NAVER_CLIENT_ID;
    const clientSecret = process.env.NAVER_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      res.status(500).json({
        error: "네이버 지도 API 키가 서버에 설정되어 있지 않습니다.",
      });
      return;
    }

    const { coords, output = "json", orders = "admcode" } = req.query;
    if (!coords) {
      res.status(400).json({ error: "coords 파라미터가 필요합니다." });
      return;
    }

    const targetUrl = new URL(
      "https://naveropenapi.apigw.ntruss.com/map-reversegeocode/v2/gc",
    );
    targetUrl.searchParams.set("coords", String(coords));
    targetUrl.searchParams.set("output", String(output));
    targetUrl.searchParams.set("orders", String(orders));

    const response = await fetch(targetUrl.toString(), {
      headers: {
        "X-NCP-APIGW-API-KEY-ID": clientId,
        "X-NCP-APIGW-API-KEY": clientSecret,
      },
    });

    const data = await response.json();
    res.status(response.status).json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// --- 1. 지도 렌더링용 API ---
app.get("/api/weather/current", async (_req, res) => {
  try {
    const data = await getLatestWeather();
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/weather/sido-stats", async (_req, res) => {
  try {
    const data = await getSidoStats();
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/weather/timeseries/:code", async (req, res) => {
  try {
    const { code } = req.params;
    const hours = req.query.hours
      ? parseInt(req.query.hours as string, 10)
      : 48;
    const result = await getTimeSeries(code, hours);
    res.json({ sigunguCode: code, count: result.length, history: result });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 단기예보 24시간 타임라인 API
app.get("/api/weather/forecast/:code", async (req, res) => {
  try {
    const { code } = req.params;
    const hours = req.query.hours
      ? parseInt(req.query.hours as string, 10)
      : 24;
    const result = await getForecastTimeline(code, hours);
    res.json({ sigunguCode: code, count: result.length, forecasts: result });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 특정 시군구 코드 & 강수확률(POP) 기준 실측/경험적 강수 확률 및 현재 현황 API
app.get("/api/weather/probability", async (req, res) => {
  try {
    const code = req.query.code as string | undefined;
    if (!code) {
      return res
        .status(400)
        .json({ error: "code 쿼리 파라미터(예: 11240)가 필요합니다." });
    }
    const pop = req.query.pop
      ? parseInt(req.query.pop as string, 10)
      : undefined;

    const insight = await getRegionProbabilityInsight(code, pop);
    if (!insight) {
      return res
        .status(404)
        .json({ error: `코드 '${code}'에 해당하는 시군구를 찾을 수 없습니다.` });
    }

    res.json(insight);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// --- 2. 예보 vs 실황 검증 및 신뢰도 분석 API ---
app.get("/api/analysis/empirical-probability", async (req, res) => {
  try {
    const minLead = req.query.minLead
      ? parseInt(req.query.minLead as string, 10)
      : 1;
    const maxLead = req.query.maxLead
      ? parseInt(req.query.maxLead as string, 10)
      : 24;
    const stats = await getEmpiricalProbabilityStats(minLead, maxLead);
    res.json({ minLeadHours: minLead, maxLeadHours: maxLead, stats });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/analysis/sido-reliability", async (_req, res) => {
  try {
    const stats = await getSidoReliabilityStats();
    res.json({ stats });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/analysis/lead-time", async (_req, res) => {
  try {
    const stats = await getLeadTimeAccuracyStats();
    res.json({ stats });
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
