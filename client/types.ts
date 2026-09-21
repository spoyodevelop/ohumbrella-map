import type { RegionWeatherInfo } from "../shared/weather.ts";

export type { RegionWeatherInfo } from "../shared/weather.ts";

export type MapPoint = { x: number; y: number }

export type MapView = {
  x: number
  y: number
  scale: number
}

export type MapRegion = {
  code: string;
  name: string;
  path: string;
  rainChance: number;
  bounds: [number, number, number, number];
  label: { x: number; y: number };
  weather?: RegionWeatherInfo;
  stats?: Record<number, { rate: number; samples: number }>;
  sampleCount?: number;
};

export type SelectionState =
  | { level: "national" }
  | { level: "sido"; sidoCode: string }
  | { level: "sigungu"; sidoCode: string; sigunguCode: string };
