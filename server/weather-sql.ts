// 최신 실황 row에 새 예보가 없으면 같은 지역의 마지막 유효 POP를 표시한다.
// 이 값은 조회용 fallback이며 예보 이력이나 정확도 통계에는 기록하지 않는다.
export const latestKnownPopForH = `COALESCE(h.pop, (
  SELECT previous.pop
  FROM hourly_weather previous
  WHERE previous.sigungu_code = h.sigungu_code
    AND previous.time <= h.time
    AND previous.pop IS NOT NULL
  ORDER BY previous.time DESC
  LIMIT 1
))`;
