import type { SurpriseRainResponse } from "../../shared/weather.ts";
import { fetchJson } from "../lib/http";

export type {
  SurpriseRainEvent,
  SurpriseRainResponse,
} from "../../shared/weather.ts";

export function loadSurpriseRain(): Promise<SurpriseRainResponse> {
  return fetchJson<SurpriseRainResponse>("/api/weather/surprise-rain");
}
