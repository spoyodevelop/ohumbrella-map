import type {
  CommuteDay,
  CommuteDayKey,
  CommuteForecast,
  CommutePoint,
  CommuteResponse,
  CommuteVerdict,
  CommuteSettings,
  ForecastValue,
} from "../../shared/commute.ts";
import { commuteGrids } from "./grids.ts";
import { TRAVEL_HOURS } from "../../shared/commute.ts";
import { fetchGridForecast, type ForecastResult } from "./kmaClient.ts";
import { loadRecords, type LoadRecords } from "./records.ts";

export function isCommuteSettings(value: unknown): value is CommuteSettings {
  if (!value || typeof value !== "object") return false;
  const s = value as CommuteSettings;
  return (
    s.version === 1 &&
    [s.homeHour, s.workHour].every(
      (h) => Number.isInteger(h) && h >= 0 && h <= 23,
    ) &&
    TRAVEL_HOURS.includes(s.travelHours) &&
    [s.home, s.work].every(
      (p) =>
        p &&
        typeof p.name === "string" &&
        typeof p.code === "string" &&
        Object.hasOwn(commuteGrids, p.code),
    )
  );
}
export function selectForecast(
  targetTime: string,
  results: ForecastResult[],
): CommuteForecast | null {
  function value<T>(
    keys: string[],
    parse: (v: string) => T | null,
  ): ForecastValue<T> | null {
    for (const result of results) {
      const row = result.hourly.find((h) => h.targetTime === targetTime);
      if (!row) continue;
      for (const key of keys) {
        const raw = row.values[key];
        if (raw == null || !raw.trim()) continue;
        const parsed = parse(raw);
        if (parsed !== null)
          return {
            value: parsed,
            source: result.source,
            issuedAt: result.issuedAt,
          };
      }
    }
    return null;
  }
  const numeric = (raw: string) => {
    const n = Number(raw);
    return Number.isFinite(n) && n > -900 && n < 900 ? n : null;
  };
  const result: CommuteForecast = {
    targetTime,
    pop: value(["POP"], (raw) => {
      const n = numeric(raw);
      return n !== null && n >= 0 && n <= 100 ? n : null;
    }),
    pty: value(["PTY"], (raw) => {
      const n = numeric(raw);
      return n !== null && [0, 1, 2, 3, 4, 5, 6, 7].includes(n) ? n : null;
    }),
    rain: value(["RN1", "PCP"], (raw) => (raw.startsWith("-") ? null : raw)),
    temperature: value(["T1H", "TMP"], numeric),
    sky: value(["SKY"], (raw) => {
      const n = numeric(raw);
      return n !== null && [1, 3, 4].includes(n) ? n : null;
    }),
  };
  return [
    result.pop,
    result.pty,
    result.rain,
    result.temperature,
    result.sky,
  ].some(Boolean)
    ? result
    : null;
}
// Short-term POP is issued as 0/20/30 or 60 and above, with nothing between.
export const UMBRELLA_POP = 60;
export function isRain(forecast: CommuteForecast | null): boolean {
  if (!forecast) return false;
  return (
    (forecast.pop?.value ?? 0) >= UMBRELLA_POP ||
    (forecast.pty !== null && forecast.pty.value !== 0)
  );
}
export function judge(points: CommutePoint[]): CommuteVerdict {
  const upcoming = points.filter((p) => p.status !== "elapsed");
  if (!upcoming.length) return "elapsed";
  if (upcoming.some((p) => p.rain)) return "umbrella";
  return upcoming.some((p) => p.status === "missing") ? "unknown" : "none";
}
function addHours(date: Date, hours: number) {
  return new Date(date.getTime() + hours * 3600000);
}
export async function getCommuteForecast(
  settings: CommuteSettings,
  now = new Date(),
  records: LoadRecords = loadRecords,
): Promise<CommuteResponse> {
  const places = [settings.home!, settings.work!];
  const codes = [...new Set(places.map((p) => p.code))];
  const [fetched, byCode] = await Promise.all([
    Promise.all(
      places.map((p) => fetchGridForecast(commuteGrids[p.code], now)),
    ),
    // Records are context for the forecast, so a failed read only drops them.
    records(codes).catch(() => null),
  ]);
  const local = new Date(now.getTime() + 9 * 3600000);
  // Forecasts start from the next hour, so the current hour counts as elapsed.
  const currentHour = new Date(local);
  currentHour.setUTCMinutes(0, 0, 0);
  const departures = (key: CommuteDayKey) => {
    const home = new Date(currentHour);
    if (key === "tomorrow") home.setUTCDate(home.getUTCDate() + 1);
    home.setUTCHours(settings.homeHour);
    const work = new Date(home);
    // Overnight shifts leave work on the following day.
    if (settings.workHour <= settings.homeHour)
      work.setUTCDate(work.getUTCDate() + 1);
    work.setUTCHours(settings.workHour);
    return [home, work];
  };
  const days = (["today", "tomorrow"] as const).map((key): CommuteDay => {
    const [leaveHome, leaveWork] = departures(key);
    const points = (
      [
        ["leaveHome", 0, leaveHome],
        ["arriveWork", 1, addHours(leaveHome, settings.travelHours)],
        ["leaveWork", 1, leaveWork],
        ["arriveHome", 0, addHours(leaveWork, settings.travelHours)],
      ] as const
    ).map(([kind, placeIndex, target]): CommutePoint => {
      const targetTime = target.toISOString().slice(0, 16).replace("T", " ");
      const elapsed = target <= currentHour;
      const source = fetched[placeIndex];
      const forecast = elapsed
        ? null
        : selectForecast(targetTime, [source.ultra, source.village]);
      const pop = forecast?.pop?.value;
      return {
        kind,
        place: places[placeIndex].name,
        targetTime,
        status: elapsed ? "elapsed" : forecast?.pop ? "ok" : "missing",
        forecast,
        rain: isRain(forecast),
        record:
          byCode?.[places[placeIndex].code]?.find((r) => r.pop === pop) ?? null,
      };
    });
    return {
      key,
      date: leaveHome.toISOString().slice(0, 10),
      verdict: judge(points),
      points,
    };
  });
  const [, todayWork] = departures("today");
  return {
    fetchedAt: now.toISOString(),
    defaultDay: todayWork <= currentHour ? "tomorrow" : "today",
    days,
    places: byCode
      ? codes.map((code) => ({
          place: places.find((p) => p.code === code)!,
          records: byCode[code] ?? [],
        }))
      : null,
  };
}
