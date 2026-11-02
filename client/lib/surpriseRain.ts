import type { SurpriseRainResponse } from "../api/surpriseRain";

// 아니 땐 비는 아 맞다 우산의 기록이라 amber 계열로 칠한다.
export function surpriseRainColor(count: number, maxCount: number): string {
  if (count <= 0 || maxCount <= 0) return "#1b212d";
  const t = Math.sqrt(Math.min(count / maxCount, 1));
  return `hsl(${36 + t * 7} ${55 + t * 41}% ${20 + t * 38}%)`;
}

export function surpriseRainCount(
  data: SurpriseRainResponse | null,
  code: string,
): number {
  if (!data) return 0;
  return code.length === 5
    ? (data.regions[code]?.count ?? 0)
    : (data.sidos[code]?.count ?? 0);
}
