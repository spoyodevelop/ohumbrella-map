import assert from "node:assert/strict";
import { test } from "node:test";

test("날씨 응답에 각 DB 조회 시간과 API 처리 시간을 표시한다", async () => {
  process.env.SENTRY_DSN = "";
  process.env.TURSO_DATABASE_URL = "file::memory:";
  const [{ app }, { db }] = await Promise.all([
    import("./api.ts"),
    import("./db.ts"),
  ]);

  await db.execute(`
    CREATE TABLE current_weather (
      time TEXT, sido_code TEXT, sigungu_code TEXT, name TEXT,
      pop INTEGER, pop_source_time TEXT, pty INTEGER, rn1 REAL,
      tmp REAL, sky INTEGER, sky_source_time TEXT, updated_at TEXT
    )
  `);
  await db.execute(`
    CREATE TABLE verified_accuracy_stats (
      sigungu_code TEXT, predicted_pop INTEGER,
      rain_count INTEGER, total_count INTEGER
    )
  `);
  await db.execute(`
    INSERT INTO current_weather VALUES (
      '2026-09-26 10:00:00', '11', '11110', '종로구',
      30, '2026-09-26 10:00:00', 0, 0,
      20, 1, '2026-09-26 10:00:00', '2026-09-26 10:01:00'
    )
  `);
  await db.execute(`
    INSERT INTO current_weather VALUES (
      '2026-09-26 09:00:00', '11', '11140', '중구',
      20, '2026-09-26 09:00:00', 0, 0,
      19, 1, '2026-09-26 09:00:00', '2026-09-26 09:01:00'
    )
  `);

  const server = app.listen(0);
  try {
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    const url = `http://127.0.0.1:${address.port}/api/weather/current`;
    const response = await fetch(url);
    assert.equal(response.status, 200);
    const body = await response.json() as { count: number; time: string | null };
    assert.equal(body.count, 2);
    assert.equal(body.time, "2026-09-26 10:00:00");
    const timing = response.headers.get("server-timing");
    assert.ok(timing);
    assert.doesNotMatch(timing, /db-max/);
    for (const name of ["db-weather", "db-accuracy", "app"]) {
      assert.match(timing, new RegExp(`(?:^|, )${name};dur=\\d+\\.\\d`));
    }

    await db.execute("DELETE FROM current_weather");
    const emptyResponse = await fetch(url);
    assert.equal(emptyResponse.status, 200);
    assert.deepEqual(await emptyResponse.json(), {
      time: null, isStale: true, count: 0, data: {},
    });
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    db.close();
  }
});
