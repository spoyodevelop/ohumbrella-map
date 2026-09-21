import type { RegionWeatherInfo } from "../types";
import type {
  CurrentWeatherResponse,
  SidoStat,
  SidoStatsResponse,
} from "../../shared/weather.ts";
import { fetchJson } from "../lib/http";

export type { SidoStat } from "../../shared/weather.ts";

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
