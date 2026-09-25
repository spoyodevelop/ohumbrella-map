import assert from "node:assert/strict";
import { test } from "node:test";

test("실황을 다시 수집해도 조회용 테이블의 예보 POP와 SKY는 유지한다", async () => {
  process.env.TURSO_DATABASE_URL = "file::memory:";
  process.env.SENTRY_DSN = "";
  const { db, assertDbReady } = await import("../db.ts");
  const { migrateDb } = await import("../db/schema.ts");
  const { upsertObservationReadModelBatch, updateLatestForecastReadModelBatch } = await import("./write.ts");
  await assert.rejects(assertDbReady, /DB 마이그레이션/);
  await migrateDb();
  await assert.doesNotReject(assertDbReady);

  const observation = {
    time: "2026-09-21 04:00",
    sidoCode: "11",
    sigunguCode: "11010",
    name: "테스트 지역",
    pty: 0,
    rn1: 0,
    tmp: 20,
    updatedAt: "2026-09-20T19:40:00Z",
  };
  await upsertObservationReadModelBatch([observation]);
  await updateLatestForecastReadModelBatch([{
    sigunguCode: observation.sigunguCode,
    pop: 80,
    sky: 4,
    updatedAt: "2026-09-20T19:50:00Z",
  }]);
  await upsertObservationReadModelBatch([{ ...observation, pty: 1, rn1: 0.5 }]);

  const result = await db.execute({
    sql: "SELECT pop, sky, pty, rn1 FROM hourly_weather WHERE time = ? AND sigungu_code = ?",
    args: [observation.time, observation.sigunguCode],
  });
  assert.deepEqual({ ...result.rows[0] }, { pop: 80, sky: 4, pty: 1, rn1: 0.5 });

  const later = { ...observation, time: "2026-09-21 07:00", updatedAt: "2026-09-20T22:40:00Z" };
  await upsertObservationReadModelBatch([later]);
  const stored = await db.execute({
    sql: "SELECT pop, sky FROM hourly_weather WHERE time = ? AND sigungu_code = ?",
    args: [later.time, later.sigunguCode],
  });
  assert.deepEqual({ ...stored.rows[0] }, { pop: null, sky: null });

  const { getLatestWeather, getSidoStats } = await import("./read.ts");
  const current = await getLatestWeather();
  assert.equal(current.data[later.sigunguCode].kmaPop, 80);
  assert.equal(current.data[later.sigunguCode].sky, 4);
  assert.equal(current.data[later.sigunguCode].kmaPopSourceTime, observation.time);
  assert.equal(current.data[later.sigunguCode].skySourceTime, observation.time);

  const latest = await db.execute({
    sql: "SELECT time, pty, rn1, pop, pop_source_time, sky, sky_source_time FROM current_weather WHERE sigungu_code = ?",
    args: [later.sigunguCode],
  });
  assert.deepEqual({ ...latest.rows[0] }, {
    time: later.time,
    pty: 0,
    rn1: 0,
    pop: 80,
    pop_source_time: observation.time,
    sky: 4,
    sky_source_time: observation.time,
  });

  const sido = await getSidoStats();
  assert.equal(sido.time, later.time);
  assert.deepEqual(sido.stats, [{
    sidoCode: observation.sidoCode,
    avgPop: 80,
    maxPop: 80,
    totalRain: 0,
    rainingCount: 0,
    totalCount: 1,
    stats: {},
  }]);
});
