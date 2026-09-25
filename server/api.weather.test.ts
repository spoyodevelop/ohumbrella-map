import assert from "node:assert/strict";
import { test } from "node:test";

test("날씨 API는 가져온 행에서 최신 시각을 고른다", async () => {
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
  await db.execute(`
    INSERT INTO current_weather VALUES (
      '2026-09-26 11:00:00', '26', '26110', '중구',
      40, '2026-09-26 11:00:00', 0, 0,
      21, 1, '2026-09-26 11:00:00', '2026-09-26 11:01:00'
    )
  `);

  const server = app.listen(0);
  try {
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    const baseUrl = `http://127.0.0.1:${address.port}/api/weather`;
    const response = await fetch(`${baseUrl}/current`);
    assert.equal(response.status, 200);
    const body = await response.json() as { count: number; time: string | null };
    assert.equal(body.count, 3);
    assert.equal(body.time, "2026-09-26 11:00:00");
    const sidoResponse = await fetch(`${baseUrl}/sido-stats`);
    assert.equal(sidoResponse.status, 200);
    const sidoBody = await sidoResponse.json() as {
      time: string | null;
      stats: { sidoCode: string }[];
    };
    assert.equal(sidoBody.time, "2026-09-26 11:00:00");
    assert.deepEqual(sidoBody.stats.map((stat) => stat.sidoCode), ["11", "26"]);
    await db.execute("DELETE FROM current_weather");
    const emptyResponse = await fetch(`${baseUrl}/current`);
    assert.equal(emptyResponse.status, 200);
    assert.deepEqual(await emptyResponse.json(), {
      time: null, isStale: true, count: 0, data: {},
    });
    const emptySidoResponse = await fetch(`${baseUrl}/sido-stats`);
    assert.equal(emptySidoResponse.status, 200);
    assert.deepEqual(await emptySidoResponse.json(), { time: null, stats: [] });
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    db.close();
  }
});
