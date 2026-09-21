import assert from "node:assert/strict";
import { test } from "node:test";
import { createWorkerQueue } from "./workerQueue.ts";

test("실행 중 예약된 다른 작업을 뒤이어 실행하고 같은 회차의 대기 작업은 하나로 모은다", async () => {
  const completed: string[] = [];
  let releaseFirst!: () => void;
  const waitForFirst = new Promise<void>((resolve) => { releaseFirst = resolve; });
  const enqueue = createWorkerQueue((error) => { throw error; });

  const first = enqueue("observation", async () => {
    completed.push("observation-start");
    await waitForFirst;
    completed.push("observation-end");
  });
  await enqueue("forecast", async () => { completed.push("forecast-old"); });
  await enqueue("forecast", async () => { completed.push("forecast-new"); });

  releaseFirst();
  await first;
  assert.deepEqual(completed, ["observation-start", "observation-end", "forecast-new"]);
});

test("앞선 예약 작업이 실패해도 뒤의 작업을 실행한다", async () => {
  const completed: string[] = [];
  const errors: unknown[] = [];
  let releaseFirst!: () => void;
  const waitForFirst = new Promise<void>((resolve) => { releaseFirst = resolve; });
  const enqueue = createWorkerQueue((error) => { errors.push(error); });

  const first = enqueue("observation", async () => {
    await waitForFirst;
    throw new Error("수집 실패");
  });
  await enqueue("forecast", async () => { completed.push("forecast"); });

  releaseFirst();
  await first;
  assert.equal(errors.length, 1);
  assert.deepEqual(completed, ["forecast"]);
});
