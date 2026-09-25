import express from "express";
import cors from "cors";
import { getLatestWeather, getSidoStats } from "./weather/read.ts";
import { loadServerEnv } from "./env.ts";
import { initMonitoring, reportServerError } from "./monitoring.ts";
import type { TimingReporter } from "./weather/timing.ts";

loadServerEnv();
initMonitoring();

export const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;
const INTERNAL_ERROR = { error: "서버 내부 오류가 발생했습니다." };

function weatherTiming(route: string, res: express.Response): {
  report: TimingReporter;
  finish: () => void;
} {
  const startedAt = performance.now();
  const timings: string[] = [];
  return {
    report: (name, durationMs) => {
      timings.push(`${name};dur=${durationMs.toFixed(1)}`);
    },
    finish: () => {
      timings.push(`app;dur=${(performance.now() - startedAt).toFixed(1)}`);
      const summary = timings.join(", ");
      res.setHeader("Server-Timing", summary);
      console.info(`[weather timing] ${route}: ${summary}`);
    },
  };
}

app.use(cors());

// --- 0. 위치 기반 역지오코딩 API (네이버 클라우드 프록시) ---
app.get("/api/gc", async (req, res) => {
  try {
    const clientId =
      process.env.NAVER_CLIENT_ID || process.env.VITE_NAVER_CLIENT_ID;
    const clientSecret = process.env.NAVER_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      reportServerError(new Error("네이버 지도 API 키가 서버에 설정되어 있지 않습니다."), "api.gc");
      res.status(500).json(INTERNAL_ERROR);
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

    if (response.status >= 500) {
      throw new Error(`네이버 역지오코딩 요청 실패: HTTP ${response.status}`);
    }
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (err) {
    reportServerError(err, "api.gc");
    res.status(500).json(INTERNAL_ERROR);
  }
});

app.get("/api/weather/current", async (_req, res) => {
  const timing = weatherTiming("current", res);
  try {
    const data = await getLatestWeather(timing.report);
    timing.finish();
    res.json(data);
  } catch (err) {
    timing.finish();
    reportServerError(err, "api.weather.current");
    res.status(500).json(INTERNAL_ERROR);
  }
});

app.get("/api/weather/sido-stats", async (_req, res) => {
  const timing = weatherTiming("sido-stats", res);
  try {
    const data = await getSidoStats(timing.report);
    timing.finish();
    res.json(data);
  } catch (err) {
    timing.finish();
    reportServerError(err, "api.weather.sido-stats");
    res.status(500).json(INTERNAL_ERROR);
  }
});

if (process.argv[1]?.endsWith("api.ts")) {
  app.listen(PORT, () => {
    console.log(`=============================================`);
    console.log(`🌐 [API Server] 날씨 API 서버 시작! http://localhost:${PORT}`);
    console.log(`=============================================`);
  });
}
