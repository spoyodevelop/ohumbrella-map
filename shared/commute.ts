export interface CommutePlace {
  code: string;
  name: string;
}
export const TRAVEL_HOURS = [1, 2, 3];
export interface CommuteSettings {
  version: 1;
  home: CommutePlace | null;
  work: CommutePlace | null;
  homeHour: number;
  workHour: number;
  /** Hours from departure to arrival, 1-3. */
  travelHours: number;
}
export type ForecastSource = "ultra" | "village";
export interface ForecastValue<T> {
  value: T;
  source: ForecastSource;
  issuedAt: string;
}
export interface CommuteForecast {
  targetTime: string;
  pop: ForecastValue<number> | null;
  pty: ForecastValue<number> | null;
  rain: ForecastValue<string> | null;
  temperature: ForecastValue<number> | null;
  sky: ForecastValue<number> | null;
}
/** How often it rained in a district after a given village POP forecast. */
export interface PopRecord {
  pop: number;
  rainCount: number;
  samples: number;
}
export interface PlaceRecords {
  place: CommutePlace;
  /** Ascending by POP; empty when the district has no verified forecasts yet. */
  records: PopRecord[];
}
export type CommutePointKind =
  "leaveHome" | "arriveWork" | "leaveWork" | "arriveHome";
export interface CommutePoint {
  kind: CommutePointKind;
  place: string;
  /** Korean time (YYYY-MM-DD HH:mm); later than the commute day for overnight shifts. */
  targetTime: string;
  /** "missing" means no valid precipitation probability, never treated as 0%. */
  status: "elapsed" | "ok" | "missing";
  forecast: CommuteForecast | null;
  rain: boolean;
  /** This district's record for the forecast POP, null when there is none. */
  record: PopRecord | null;
}
export type CommuteVerdict = "umbrella" | "none" | "unknown" | "elapsed";
export type CommuteDayKey = "today" | "tomorrow";
export interface CommuteDay {
  key: CommuteDayKey;
  /** Korean date of the home departure (YYYY-MM-DD). */
  date: string;
  verdict: CommuteVerdict;
  points: CommutePoint[];
}
export interface CommuteResponse {
  fetchedAt: string;
  /** Tomorrow once today's work departure hour has started. */
  defaultDay: CommuteDayKey;
  days: CommuteDay[];
  /** Null when the records could not be read; forecasts still return. */
  places: PlaceRecords[] | null;
}
