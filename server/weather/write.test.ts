import assert from "node:assert/strict";
import { test } from "node:test";

test("새 실황은 해당 시각의 최신 예보를 받고 재수집은 이를 보존하며 늦은 예보도 반영한다", async () => {
  process.env.TURSO_DATABASE_URL = "file::memory:";
  process.env.SENTRY_DSN = "";
  const { db, assertDbReady } = await import("../db.ts");
  const { migrateDb } = await import("../db/schema.ts");
  const { upsertForecastsBatch, upsertObservationReadModelBatch, updateLatestForecastReadModelBatch } = await import("./write.ts");
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
  const forecast = {
    baseTime: "2026-09-21 02:00",
    targetTime: observation.time,
    sigunguCode: observation.sigunguCode,
    sidoCode: observation.sidoCode,
    name: observation.name,
    pop: 40,
    leadHours: 2,
    sky: 3,
    tmp: 19,
    createdAt: "2026-09-20T17:15:00Z",
  };
  await upsertForecastsBatch([
    forecast,
    { ...forecast, baseTime: "2026-09-21 03:00", pop: 80, sky: 4 },
    { ...forecast, baseTime: "2026-09-21 05:00", pop: 10, sky: 1 },
    { ...forecast, targetTime: "2026-09-21 05:00", baseTime: "2026-09-21 03:00", pop: 20, sky: 1 },
  ]);
  await upsertObservationReadModelBatch([observation]);
  await upsertObservationReadModelBatch([{ ...observation, pty: 1, rn1: 0.5 }]);

  const result = await db.execute({
    sql: "SELECT pop, sky, pty, rn1 FROM hourly_weather WHERE time = ? AND sigungu_code = ?",
    args: [observation.time, observation.sigunguCode],
  });
  assert.deepEqual({ ...result.rows[0] }, { pop: 80, sky: 4, pty: 1, rn1: 0.5 });

  const later = { ...observation, time: "2026-09-21 06:00", updatedAt: "2026-09-20T21:40:00Z" };
  await upsertObservationReadModelBatch([later]);
  await updateLatestForecastReadModelBatch([{
    sigunguCode: later.sigunguCode,
    updatedAt: "2026-09-20T21:50:00Z",
  }]);
  const withoutForecast = await db.execute({
    sql: "SELECT pop, sky FROM hourly_weather WHERE time = ? AND sigungu_code = ?",
    args: [later.time, later.sigunguCode],
  });
  assert.deepEqual({ ...withoutForecast.rows[0] }, { pop: null, sky: null });

  await upsertForecastsBatch([{ ...forecast, targetTime: later.time, baseTime: "2026-09-21 05:00", pop: 60, sky: 3 }]);
  await updateLatestForecastReadModelBatch([{
    sigunguCode: later.sigunguCode,
    updatedAt: "2026-09-20T22:15:00Z",
  }]);
  const withForecast = await db.execute({
    sql: "SELECT pop, sky FROM hourly_weather WHERE time = ? AND sigungu_code = ?",
    args: [later.time, later.sigunguCode],
  });
  assert.deepEqual({ ...withForecast.rows[0] }, { pop: 60, sky: 3 });
});
