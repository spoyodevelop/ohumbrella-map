import type { RegionWeatherInfo } from "../types";
import { fetchJson } from "../lib/http";

export interface SidoStat {
  sidoCode: string;
  avgPop: number | null;
  maxPop: number | null;
  totalRain: number;
  rainingCount: number;
  totalCount: number;
  stats?: Record<number, { rate: number; samples: number }>;
}

interface CurrentWeatherResponse {
  time: string | null;
  count: number;
  data: Record<string, RegionWeatherInfo>;
}

interface SidoStatsResponse {
  time: string | null;
  stats: SidoStat[];
}

export interface WeatherSnapshot {
  weatherMap: Record<string, RegionWeatherInfo>;
  sidoStatsMap: Record<string, SidoStat>;
  weatherTime: string;
}

export async function loadWeatherSnapshot(): Promise<WeatherSnapshot> {
  const [current, sido] = await Promise.all([
    fetchJson<CurrentWeatherResponse>("/api/weather/current"),
    fetchJson<SidoStatsResponse>("/api/weather/sido-stats"),
  ]);

  const sidoStatsMap: Record<string, SidoStat> = {};
  for (const stat of sido.stats) {
    sidoStatsMap[stat.sidoCode] = stat;
  }

  return {
    weatherMap: current.data,
    sidoStatsMap,
    weatherTime: current.time ?? "",
  };
}
