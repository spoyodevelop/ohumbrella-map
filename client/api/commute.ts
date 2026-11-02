import type { CommuteResponse, CommuteSettings } from "../../shared/commute";
import { fetchJson } from "../lib/http";
export function loadCommuteForecast(
  settings: CommuteSettings,
  signal: AbortSignal,
) {
  return fetchJson<CommuteResponse>("/api/weather/commute", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(settings),
    signal,
  });
}
