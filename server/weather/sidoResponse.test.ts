import assert from "node:assert/strict";
import { test } from "node:test";
import {
  assembleSidoStatsResponse,
  type SidoPopBucketRow,
  type SidoStatRow,
} from "./sidoResponse.ts";

test("시도 통계 응답은 POP가 없을 때 null과 빈 통계를 유지한다", () => {
  const rows: SidoStatRow[] = [
    {
      sidoCode: "26",
      avgPop: null,
      maxPop: null,
      totalRain: 0,
      rainingCount: 0,
      totalCount: 2,
    },
  ];

  assert.deepEqual(assembleSidoStatsResponse("2026-09-21 04:00", rows, []), {
    time: "2026-09-21 04:00",
    stats: [{ ...rows[0], stats: {} }],
  });
});

test("시도 통계 응답은 확률별 실제 강수율을 계산하고 DB 전용 필드를 제외한다", () => {
  const rows = [
    {
      sidoCode: "11",
      avgPop: 30,
      maxPop: 60,
      totalRain: 1.2,
      rainingCount: 1,
      totalCount: 2,
      internalColumn: "DB 전용 값",
    },
  ];
  const buckets: SidoPopBucketRow[] = [
    { sidoCode: "11", predictedPop: 30, rainCount: 2, samples: 3 },
    { sidoCode: "11", predictedPop: 60, rainCount: 1, samples: 4 },
  ];
  const originalRows = structuredClone(rows);
  const originalBuckets = structuredClone(buckets);

  assert.deepEqual(assembleSidoStatsResponse("2026-09-21 04:00", rows, buckets), {
    time: "2026-09-21 04:00",
    stats: [
      {
        sidoCode: "11",
        avgPop: 30,
        maxPop: 60,
        totalRain: 1.2,
        rainingCount: 1,
        totalCount: 2,
        stats: { 30: { rate: 66.7, samples: 3 }, 60: { rate: 25, samples: 4 } },
      },
    ],
  });
  assert.deepEqual(rows, originalRows);
  assert.deepEqual(buckets, originalBuckets);
});
