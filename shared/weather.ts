export interface ProbabilityBucket {
  rate: number;
  samples: number;
}

export interface RegionWeatherInfo {
  time: string;
  isStale: boolean;
  sidoCode: string;
  sigunguCode: string;
  name: string;
  pop: number | null;
  kmaPop: number | null;
  pty: number;
  rn1: number;
  tmp: number | null;
  sky: number;
  updatedAt: string;
  isRaining: 0 | 1;
  empiricalRate: number | null;
  sampleCount: number;
  sidoEmpiricalRate: number | null;
  sidoSampleCount: number;
  stats: Record<number, ProbabilityBucket>;
  sidoStats: Record<number, ProbabilityBucket>;
}

export interface CurrentWeatherResponse {
  time: string | null;
  isStale: boolean;
  count: number;
  data: Record<string, RegionWeatherInfo>;
}

export interface SidoStat {
  sidoCode: string;
  avgPop: number | null;
  maxPop: number | null;
  totalRain: number;
  rainingCount: number;
  totalCount: number;
  stats: Record<number, ProbabilityBucket>;
}

export interface SidoStatsResponse {
  time: string | null;
  stats: SidoStat[];
}
