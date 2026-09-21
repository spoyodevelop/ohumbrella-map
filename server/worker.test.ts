import assert from "node:assert/strict";
import { test } from "node:test";

test("워커 시작은 정해진 수집 작업만 등록하고 중복 시작을 막는다", async () => {
  process.env.TURSO_DATABASE_URL = "file::memory:";
  const { startWorker } = await import("./worker.ts");
  const schedules: string[] = [];

  startWorker((expression) => {
    schedules.push(expression);
  });

  assert.deepEqual(schedules, [
    "40-58/2 * * * *",
    "20 2,5,8,11,14,17,20,23 * * *",
  ]);
  assert.throws(() => startWorker(() => {}), /이미 시작/);
});
