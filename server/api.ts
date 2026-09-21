import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { resolve } from "node:path";
import { getLatestWeather, getSidoStats } from "./weather/read.ts";

dotenv.config({ path: resolve(process.cwd(), ".env.local") });
dotenv.config({ path: resolve(process.cwd(), ".env") });

export const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;

app.use(cors());

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

if (process.argv[1]?.endsWith("api.ts")) {
  app.listen(PORT, () => {
    console.log(`=============================================`);
    console.log(`🌐 [API Server] 날씨 API 서버 시작! http://localhost:${PORT}`);
    console.log(`=============================================`);
  });
}
