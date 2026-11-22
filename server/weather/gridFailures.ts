// 기상청 격자 요청이 일부 실패해도 회차 전체를 버리지 않는다.
// 실패 비율이 이 값을 넘을 때만 회차 실패로 보고 헬스체크를 울린다.
export const MAX_FAILED_GRID_RATIO = 0.1;

export function exceedsGridFailureLimit(
  failedGrids: number,
  totalGrids: number,
  maxRatio = MAX_FAILED_GRID_RATIO,
): boolean {
  if (totalGrids <= 0) return false;
  return failedGrids / totalGrids > maxRatio;
}
