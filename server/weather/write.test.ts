import assert from "node:assert/strict";
import { test } from "node:test";

test("실황을 다시 수집해도 조회용 테이블의 예보 POP와 SKY는 유지한다", async () => {
  process.env.TURSO_DATABASE_URL = "file::memory:";
  process.env.SENTRY_DSN = "";
  const { db, initDb } = await import("../db.ts");
  const { upsertObservationReadModelBatch, updateLatestForecastReadModelBatch } = await import("./write.ts");
  await initDb();

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
});
