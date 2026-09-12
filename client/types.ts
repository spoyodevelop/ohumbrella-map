export type MapPoint = { x: number; y: number }

export type MapView = {
  x: number
  y: number
  scale: number
}

export type RegionWeatherInfo = {
  time: string;
  sidoCode: string;
  sigunguCode: string;
  name: string;
  pop: number | null;
  kmaPop: number | null;
  pty: number;
  rn1: number;
  tmp: number | null;
  sky: number;
  isRaining: number;
  empiricalRate: number | null;
  sampleCount: number;
  updatedAt: string;
};

export type MapRegion = {
  code: string;
  name: string;
  path: string;
  rainChance: number;
  bounds: [number, number, number, number];
  label: { x: number; y: number };
  weather?: RegionWeatherInfo;
};

export type SelectionState =
  | { level: "national" }
  | { level: "sido"; sidoCode: string }
  | { level: "sigungu"; sidoCode: string; sigunguCode: string };
