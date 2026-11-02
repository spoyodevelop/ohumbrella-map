import assert from "node:assert/strict";
import { test } from "node:test";
import { createClient } from "@libsql/client";
import { createAccuracySchema } from "../verification/accuracy.ts";
import {
  assembleSurpriseRainResponse,
  type SurpriseRainRow,
} from "./surpriseRain.ts";

const row = (
  time: string,
  sigunguCode: string,
  pop: number,
  rn1: number,
): SurpriseRainRow => ({
  time,
  sigunguCode,
  sidoCode: sigunguCode.slice(0, 2),
  name: sigunguCode === "11110" ? "종로구" : "중구",
  pop,
  rn1,
});

test("아니 땐 비 응답은 시군구와 시도별로 건수와 1mm 이상 건수를 센다", () => {
  const range = { since: "2026-09-17 01:00", until: "2026-11-02 23:00" };
  const response = assembleSurpriseRainResponse(range, [
    row("2026-10-20 15:00", "11110", 0, 1.2),
    row("2026-10-20 14:00", "11110", 20, 0.4),
    row("2026-10-19 09:00", "11140", 20, 1),
  ]);

  assert.equal(response.maxPop, 20);
  assert.equal(response.count, 3);
  assert.equal(response.heavyCount, 2);
  assert.deepEqual(response.regions["11110"], {
    sidoCode: "11",
    name: "종로구",
    count: 2,
    heavyCount: 1,
    events: [
      { time: "2026-10-20 15:00", pop: 0, rn1: 1.2 },
      { time: "2026-10-20 14:00", pop: 20, rn1: 0.4 },
    ],
  });
  assert.deepEqual(response.sidos["11"], {
    count: 3,
    heavyCount: 2,
    regionCount: 2,
  });
});

test("아니 땐 비 응답은 시군구마다 최근 사례 30건만 담는다", () => {
  const rows = Array.from({ length: 35 }, (_, i) =>
    row(
      `2026-10-01 ${String(23 - (i % 24)).padStart(2, "0")}:00`,
      "11110",
      0,
      0.1,
    ),
  );
  const region = assembleSurpriseRainResponse(
    { since: null, until: null },
    rows,
  ).regions["11110"];
  assert.equal(region.count, 35);
  assert.equal(region.events.length, 30);
});

test("아니 땐 비 조회는 부분 인덱스를 탄다", async () => {
  const client = createClient({ url: "file::memory:" });
  try {
    await createAccuracySchema(client);
    const plan = await client.execute(`
      EXPLAIN QUERY PLAN
      SELECT target_time FROM forecast_verifications
      WHERE actual_rain = 1 AND predicted_pop <= 20
      ORDER BY target_time DESC
    `);
    assert.match(
      plan.rows.map((r) => String(r.detail)).join("\n"),
      /idx_verifications_surprise/,
    );
  } finally {
    client.close();
  }
});
