import type { Client } from "@libsql/client";

// 기존 이력에서 현재 상태를 한 번 채운다. 수집 중인 행은 덮어쓰지 않는다.
export async function backfillCurrentWeather(client: Client): Promise<number> {
  const result = await client.execute(`
    INSERT INTO current_weather (
      sigungu_code, sido_code, name, time, pty, rn1, tmp,
      pop, pop_source_time, sky, sky_source_time, updated_at
    )
    SELECT
      h.sigungu_code, h.sido_code, h.name, h.time, h.pty, h.rn1, h.tmp,
      (
        SELECT previous.pop FROM hourly_weather previous
        WHERE previous.sigungu_code = h.sigungu_code
          AND previous.time <= h.time AND previous.pop IS NOT NULL
        ORDER BY previous.time DESC LIMIT 1
      ),
      (
        SELECT previous.time FROM hourly_weather previous
        WHERE previous.sigungu_code = h.sigungu_code
          AND previous.time <= h.time AND previous.pop IS NOT NULL
        ORDER BY previous.time DESC LIMIT 1
      ),
      (
        SELECT previous.sky FROM hourly_weather previous
        WHERE previous.sigungu_code = h.sigungu_code
          AND previous.time <= h.time AND previous.sky IS NOT NULL
        ORDER BY previous.time DESC LIMIT 1
      ),
      (
        SELECT previous.time FROM hourly_weather previous
        WHERE previous.sigungu_code = h.sigungu_code
          AND previous.time <= h.time AND previous.sky IS NOT NULL
        ORDER BY previous.time DESC LIMIT 1
      ),
      h.updated_at
    FROM hourly_weather h
    JOIN (
      SELECT sigungu_code, MAX(time) AS max_time
      FROM hourly_weather GROUP BY sigungu_code
    ) latest ON latest.sigungu_code = h.sigungu_code AND latest.max_time = h.time
    WHERE 1
    ON CONFLICT(sigungu_code) DO UPDATE SET
      sido_code = CASE WHEN excluded.time > current_weather.time THEN excluded.sido_code ELSE current_weather.sido_code END,
      name = CASE WHEN excluded.time > current_weather.time THEN excluded.name ELSE current_weather.name END,
      time = CASE WHEN excluded.time > current_weather.time THEN excluded.time ELSE current_weather.time END,
      pty = CASE WHEN excluded.time > current_weather.time THEN excluded.pty ELSE current_weather.pty END,
      rn1 = CASE WHEN excluded.time > current_weather.time THEN excluded.rn1 ELSE current_weather.rn1 END,
      tmp = CASE WHEN excluded.time > current_weather.time THEN excluded.tmp ELSE current_weather.tmp END,
      pop = CASE WHEN excluded.time > current_weather.time THEN excluded.pop ELSE COALESCE(current_weather.pop, excluded.pop) END,
      pop_source_time = CASE
        WHEN excluded.time > current_weather.time THEN excluded.pop_source_time
        WHEN current_weather.pop IS NULL THEN excluded.pop_source_time
        ELSE current_weather.pop_source_time END,
      sky = CASE WHEN excluded.time > current_weather.time THEN excluded.sky ELSE COALESCE(current_weather.sky, excluded.sky) END,
      sky_source_time = CASE
        WHEN excluded.time > current_weather.time THEN excluded.sky_source_time
        WHEN current_weather.sky IS NULL THEN excluded.sky_source_time
        ELSE current_weather.sky_source_time END,
      updated_at = CASE WHEN excluded.time > current_weather.time THEN excluded.updated_at ELSE current_weather.updated_at END
  `);
  return result.rowsAffected;
}
