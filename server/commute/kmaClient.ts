import { requireKmaServiceKey } from "../env.ts";
import type { ForecastSource } from "../../shared/commute.ts";

interface ApiResponse {
  response?: {
    header?: { resultCode?: string };
    body?: { totalCount?: number; items?: { item?: Item[] } };
  };
}
interface Item {
  category: string;
  fcstDate: string;
  fcstTime: string;
  fcstValue: string;
}
export interface ForecastHour {
  targetTime: string;
  values: Record<string, string>;
}
export interface ForecastResult {
  status: "ok" | "unavailable";
  source: ForecastSource;
  issuedAt: string;
  hourly: ForecastHour[];
}
const ROOT =
  "https://apihub.kma.go.kr/api/typ02/openApi/VilageFcstInfoService_2.0";
const stamp = (d: Date) => d.toISOString().slice(0, 16).replace("T", " ");

export function forecastRound(source: ForecastSource, now: Date): Date {
  const local = new Date(now.getTime() + 9 * 3600000);
  if (source === "ultra") {
    if (local.getUTCMinutes() < 45) local.setUTCHours(local.getUTCHours() - 1);
    local.setUTCMinutes(30, 0, 0);
  } else {
    local.setUTCMinutes(local.getUTCMinutes() - 15);
    while (![2, 5, 8, 11, 14, 17, 20, 23].includes(local.getUTCHours())) {
      local.setUTCHours(local.getUTCHours() - 1);
    }
    local.setUTCMinutes(0, 0, 0);
  }
  return local;
}

export function groupForecastItems(items: Item[]): ForecastHour[] {
  const grouped = new Map<string, ForecastHour>();
  for (const item of items) {
    if (!/^\d{8}$/.test(item.fcstDate) || !/^\d{4}$/.test(item.fcstTime))
      continue;
    const d = item.fcstDate;
    const targetTime = `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)} ${item.fcstTime.slice(0, 2)}:${item.fcstTime.slice(2)}`;
    const row = grouped.get(targetTime) ?? { targetTime, values: {} };
    row.values[item.category] = item.fcstValue;
    grouped.set(targetTime, row);
  }
  return [...grouped.values()].sort((a, b) =>
    a.targetTime.localeCompare(b.targetTime),
  );
}

async function fetchForecast(
  grid: { nx: number; ny: number },
  source: ForecastSource,
  now: Date,
): Promise<ForecastResult> {
  const round = forecastRound(source, now);
  const issuedAt = stamp(round);
  try {
    const items: Item[] = [];
    let totalCount = 1;
    // Through the end of the day after tomorrow, which covers tomorrow's
    // commute including an overnight shift's work departure.
    const last = new Date(now.getTime() + 9 * 3600000);
    last.setUTCDate(last.getUTCDate() + 2);
    last.setUTCHours(23, 59, 0, 0);
    const end = stamp(last);
    for (let page = 1; (page - 1) * 1000 < totalCount; page++) {
      const url = new URL(
        `${ROOT}/${source === "ultra" ? "getUltraSrtFcst" : "getVilageFcst"}`,
      );
      url.search = new URLSearchParams({
        authKey: requireKmaServiceKey(),
        pageNo: String(page),
        numOfRows: "1000",
        dataType: "JSON",
        base_date: round.toISOString().slice(0, 10).replaceAll("-", ""),
        base_time: round.toISOString().slice(11, 16).replace(":", ""),
        nx: String(grid.nx),
        ny: String(grid.ny),
      }).toString();
      const response = await fetch(url);
      if (!response.ok) throw new Error("Forecast HTTP failure");
      const data = (await response.json()) as ApiResponse;
      const body = data.response?.body;
      if (
        data.response?.header?.resultCode !== "00" ||
        !Array.isArray(body?.items?.item)
      ) {
        throw new Error("Forecast unavailable");
      }
      const received = body.items.item as Item[];
      if (!received.length) break;
      items.push(...received);
      totalCount = Number(body.totalCount ?? received.length);
    }
    const hourly = groupForecastItems(items).filter(
      (row) => row.targetTime <= end,
    );
    return {
      status: hourly.length ? "ok" : "unavailable",
      source,
      issuedAt,
      hourly,
    };
  } catch {
    return { status: "unavailable", source, issuedAt, hourly: [] };
  }
}

export async function fetchGridForecast(
  grid: { nx: number; ny: number },
  now = new Date(),
) {
  const [village, ultra] = await Promise.all([
    fetchForecast(grid, "village", now),
    fetchForecast(grid, "ultra", now),
  ]);
  return { village, ultra };
}
