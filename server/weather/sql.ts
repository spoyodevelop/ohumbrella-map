// 이전 예보값은 조회할 때만 찾는다. 실황 행의 빈 pop/sky는 그대로 둔다.
function latestKnownFieldForH(column: "pop" | "sky", selected: "value" | "time") {
  const field = selected === "time" ? "previous.time" : `previous.${column}`;
  return `(
    SELECT ${field}
    FROM hourly_weather previous
    WHERE previous.sigungu_code = h.sigungu_code
      AND previous.time <= h.time
      AND previous.${column} IS NOT NULL
    ORDER BY previous.time DESC
    LIMIT 1
  )`;
}

export const latestKnownPopForH = latestKnownFieldForH("pop", "value");
export const latestKnownPopTimeForH = latestKnownFieldForH("pop", "time");
export const latestKnownSkyForH = latestKnownFieldForH("sky", "value");
export const latestKnownSkyTimeForH = latestKnownFieldForH("sky", "time");
