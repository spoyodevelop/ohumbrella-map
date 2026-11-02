import type { SurpriseRainResponse } from "../api/surpriseRain";

// 아니 땐 비 지도 색. 단계 색은 index.css의 --surprise-map-* 토큰에 둔다.
// 선형으로 섞어 적게 기록된 곳은 어둡게 두고, 많이 기록된 곳만 드러나게 한다.
export function surpriseRainColor(count: number, maxCount: number): string {
  if (count <= 0 || maxCount <= 0) return "var(--surprise-map-empty)";
  const percent = Math.round(Math.min(count / maxCount, 1) * 100);
  return `color-mix(in oklab, var(--surprise-map-high) ${percent}%, var(--surprise-map-low))`;
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
