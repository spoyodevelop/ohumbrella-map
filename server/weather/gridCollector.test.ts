import assert from "node:assert/strict";
import { test } from "node:test";
import { collectGrids } from "./gridCollector.ts";

function recorder() {
  const sleeps: number[] = [];
  return {
    sleeps,
    sleep: async (ms: number) => {
      sleeps.push(ms);
    },
  };
}

const base = {
  chunkSize: 3,
  chunkGapMs: 1,
  outagePauseMs: 1000,
  maxOutagePauses: 2,
  finalRetryDelayMs: 500,
};

test("모두 성공하면 쉬지 않고 결과를 돌려준다", async () => {
  const { sleep, sleeps } = recorder();
  const r = await collectGrids([1, 2, 3, 4], async (g) => g * 10, {
    ...base,
    sleep,
  });
  assert.deepEqual(
    r.results.map((x) => x.value).sort((a, b) => a - b),
    [10, 20, 30, 40],
  );
  assert.equal(r.failed.length, 0);
  assert.equal(r.outagePauses, 0);
  assert.deepEqual(sleeps, [1, 1]);
});

test("묶음이 통째로 실패하면 쉬었다가 같은 묶음을 다시 보낸다", async () => {
  const { sleep, sleeps } = recorder();
  let down = 2; // 첫 묶음 두 번 시도 동안 장애
  const r = await collectGrids(
    [1, 2, 3, 4, 5, 6],
    async (g) => {
      if (down > 0 && g <= 3) throw new Error("timeout");
      return g;
    },
    {
      ...base,
      sleep: async (ms) => {
        if (ms === base.outagePauseMs) down--;
        await sleep(ms);
      },
    },
  );
  assert.equal(r.failed.length, 0);
  assert.equal(r.results.length, 6);
  assert.equal(r.outagePauses, 2);
  assert.deepEqual(sleeps, [1000, 1000, 1, 1]);
});

test("일부만 실패한 묶음은 장애로 보지 않고 회차 끝에 한 번 더 받는다", async () => {
  const { sleep, sleeps } = recorder();
  const calls = new Map<number, number>();
  const r = await collectGrids(
    [1, 2, 3],
    async (g) => {
      const n = (calls.get(g) ?? 0) + 1;
      calls.set(g, n);
      if (g === 2 && n === 1) throw new Error("timeout");
      return g;
    },
    { ...base, sleep },
  );
  assert.equal(r.failed.length, 0);
  assert.equal(r.outagePauses, 0);
  assert.equal(calls.get(2), 2);
  assert.deepEqual(sleeps, [1, 500, 1]);
});

test("장애 대기 한도를 넘기면 실패로 남기고 끝까지 진행한다", async () => {
  const { sleep } = recorder();
  const r = await collectGrids(
    [1, 2, 3, 4, 5, 6],
    async () => {
      throw new Error("down");
    },
    { ...base, sleep },
  );
  assert.equal(r.results.length, 0);
  assert.equal(r.failed.length, 6);
  assert.equal(r.outagePauses, 2);
});
