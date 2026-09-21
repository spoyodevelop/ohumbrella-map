import assert from "node:assert/strict";
import { test } from "node:test";
import { fetchKmaWithRetry } from "./kmaClient.ts";

function kmaResponse(code: string, items?: unknown[]): Response {
  return Response.json({
    response: {
      header: { resultCode: code, resultMsg: code === "03" ? "NO_DATA" : "RESULT" },
      body: items === undefined ? {} : { items: { item: items } },
    },
  });
}

test("정상 자료와 아직 없는 자료를 다른 결과로 반환한다", async () => {
  let calls = 0;
  const noData = await fetchKmaWithRetry("https://example.test", 3, 0, async () => {
    calls++;
    return kmaResponse("03");
  });
  assert.deepEqual(noData, { kind: "no-data" });
  assert.equal(calls, 1);

  const items = [{ category: "POP", fcstValue: "40" }];
  const available = await fetchKmaWithRetry("https://example.test", 3, 0, async () =>
    kmaResponse("00", items)
  );
  assert.deepEqual(available, { kind: "items", items });
});

test("일시적인 요청 실패는 재시도하고 정상 응답을 반환한다", async () => {
  let calls = 0;
  const result = await fetchKmaWithRetry("https://example.test", 2, 0, async () => {
    calls++;
    return calls === 1 ? new Response(null, { status: 503 }) : kmaResponse("00", [1]);
  });
  assert.equal(calls, 2);
  assert.deepEqual(result, { kind: "items", items: [1] });
});

test("반복 실패나 항목 없는 정상 응답을 자료 없음으로 숨기지 않는다", async () => {
  let failedCalls = 0;
  await assert.rejects(
    fetchKmaWithRetry("https://example.test", 2, 0, async () => {
      failedCalls++;
      return new Response(null, { status: 503 });
    }),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.match(error.message, /2회 실패/);
      assert.match(String(error.cause), /HTTP Error 503/);
      return true;
    },
  );
  assert.equal(failedCalls, 2);

  let emptyCalls = 0;
  await assert.rejects(
    fetchKmaWithRetry("https://example.test", 2, 0, async () => {
      emptyCalls++;
      return kmaResponse("00");
    }),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.match(String(error.cause), /정상 응답에 항목 없음/);
      return true;
    },
  );
  assert.equal(emptyCalls, 2);

  await assert.rejects(
    fetchKmaWithRetry("https://example.test", 1, 0, async () => kmaResponse("30")),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.match(String(error.cause), /\[30\]/);
      return true;
    },
  );
});
