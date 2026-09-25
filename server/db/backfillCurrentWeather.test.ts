import assert from "node:assert/strict";
import { test } from "node:test";
import { createClient } from "@libsql/client";
import { backfillCurrentWeather } from "./backfillCurrentWeather.ts";
import { createCurrentWeatherTable } from "./currentWeatherTable.ts";

test("기존 이력으로 최신 상태를 채우고 새 수집분은 보존한다", async () => {
  const client = createClient({ url: "file::memory:" });
  try {
    await client.execute(`
      CREATE TABLE hourly_weather (
        time TEXT NOT NULL, sigungu_code TEXT NOT NULL, sido_code TEXT NOT NULL,
        name TEXT NOT NULL, pty INTEGER, rn1 REAL, tmp REAL, pop INTEGER,
        sky INTEGER, updated_at TEXT NOT NULL,
        PRIMARY KEY (time, sigungu_code)
      )
    `);
    await createCurrentWeatherTable(client);
    await client.batch([
      {
        sql: "INSERT INTO hourly_weather VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        args: ["2026-09-21 04:00", "11010", "11", "지역 A", 0, 0, 20, 80, 4, "t1"],
      },
      {
        sql: "INSERT INTO hourly_weather VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        args: ["2026-09-21 07:00", "11010", "11", "지역 A", 1, 0.5, 21, null, null, "t2"],
      },
      {
        sql: "INSERT INTO hourly_weather VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        args: ["2026-09-21 07:00", "26010", "26", "지역 B", 0, 0, 19, 10, 1, "t2"],
      },
      {
        sql: `INSERT INTO current_weather
          (sigungu_code, sido_code, name, time, pty, rn1, tmp, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        args: ["11010", "11", "지역 A", "2026-09-21 07:00", 1, 0.5, 21, "new"],
      },
    ], "write");

    await backfillCurrentWeather(client);
    const rows = await client.execute(`
      SELECT sigungu_code, time, pop, pop_source_time, sky, sky_source_time, updated_at
      FROM current_weather ORDER BY sigungu_code
    `);
    assert.deepEqual(rows.rows.map((row) => ({ ...row })), [
      {
        sigungu_code: "11010", time: "2026-09-21 07:00", pop: 80,
        pop_source_time: "2026-09-21 04:00", sky: 4,
        sky_source_time: "2026-09-21 04:00", updated_at: "new",
      },
      {
        sigungu_code: "26010", time: "2026-09-21 07:00", pop: 10,
        pop_source_time: "2026-09-21 07:00", sky: 1,
        sky_source_time: "2026-09-21 07:00", updated_at: "t2",
      },
    ]);

    await client.execute(`
      UPDATE current_weather SET time = '2026-09-21 08:00', pop = 90,
        pop_source_time = '2026-09-21 08:00', updated_at = 'newer'
      WHERE sigungu_code = '11010'
    `);
    await backfillCurrentWeather(client);
    const newer = await client.execute("SELECT time, pop, pop_source_time, updated_at FROM current_weather WHERE sigungu_code = '11010'");
    assert.deepEqual({ ...newer.rows[0] }, {
      time: "2026-09-21 08:00", pop: 90,
      pop_source_time: "2026-09-21 08:00", updated_at: "newer",
    });
  } finally {
    client.close();
  }
});
