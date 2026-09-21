import assert from "node:assert/strict";
import { test } from "node:test";
import {
  assembleCurrentWeatherResponse,
  type CurrentWeatherRow,
  type VerifiedPopBucketRow,
} from "./current-weather-response.ts";

test("현재 날씨 응답은 관측값과 POP별 표본을 지역·시도 단위로 조립한다", () => {
  const rows: CurrentWeatherRow[] = [
    {
      time: "2026-09-21 04:00",
      sidoCode: "11",
      sigunguCode: "A",
      name: "A 지역",
      pop: 30,
      kmaPop: 30,
      pty: 0,
      rn1: 0,
      tmp: 20,
      sky: 3,
      updatedAt: "2026-09-21T04:00:00Z",
    },
    {
      time: "2026-09-21 04:00",
      sidoCode: "11",
      sigunguCode: "B",
      name: "B 지역",
      pop: null,
      kmaPop: null,
      pty: 0,
      rn1: 0.3,
      tmp: null,
      sky: 1,
      updatedAt: "2026-09-21T04:00:00Z",
    },
  ];
  const buckets: VerifiedPopBucketRow[] = [
    { sigungu_code: "A", sido_code: "11", predicted_pop: 30, rain_count: 1, rate: 50, samples: 2 },
    { sigungu_code: "B", sido_code: "11", predicted_pop: 30, rain_count: 2, rate: 66.7, samples: 3 },
    { sigungu_code: "A", sido_code: "11", predicted_pop: 60, rain_count: 1, rate: 25, samples: 4 },
  ];
  const originalRows = structuredClone(rows);
  const originalBuckets = structuredClone(buckets);

  assert.deepEqual(assembleCurrentWeatherResponse("2026-09-21 04:00", rows, buckets), {
    time: "2026-09-21 04:00",
    count: 2,
    data: {
      A: {
        ...rows[0],
        isRaining: 0,
        empiricalRate: 50,
        sampleCount: 2,
        sidoEmpiricalRate: 60,
        sidoSampleCount: 5,
        stats: { 30: { rate: 50, samples: 2 }, 60: { rate: 25, samples: 4 } },
        sidoStats: { 30: { rate: 60, samples: 5 }, 60: { rate: 25, samples: 4 } },
      },
      B: {
        ...rows[1],
        isRaining: 1,
        empiricalRate: null,
        sampleCount: 0,
        sidoEmpiricalRate: null,
        sidoSampleCount: 0,
        stats: { 30: { rate: 66.7, samples: 3 } },
        sidoStats: { 30: { rate: 60, samples: 5 }, 60: { rate: 25, samples: 4 } },
      },
    },
  });
  assert.deepEqual(rows, originalRows);
  assert.deepEqual(buckets, originalBuckets);
});

test("표본이 없는 지역도 응답 기본값을 유지한다", () => {
  const row: CurrentWeatherRow = {
    time: "2026-09-21 04:00",
    sidoCode: "11",
    sigunguCode: "A",
    name: "A 지역",
    pop: null,
    kmaPop: null,
    pty: 0,
    rn1: 0,
    tmp: null,
    sky: 1,
    updatedAt: "2026-09-21T04:00:00Z",
  };

  assert.deepEqual(assembleCurrentWeatherResponse(row.time, [row], []), {
    time: row.time,
    count: 1,
    data: {
      A: {
        ...row,
        isRaining: 0,
        empiricalRate: null,
        sampleCount: 0,
        sidoEmpiricalRate: null,
        sidoSampleCount: 0,
        stats: {},
        sidoStats: {},
      },
    },
  });
});
