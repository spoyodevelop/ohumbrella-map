import assert from "node:assert/strict";
import { test } from "node:test";
import {
  assembleCurrentWeatherResponse,
  isObservationStale,
  type CurrentWeatherRow,
  type VerifiedPopBucketRow,
} from "./currentResponse.ts";

const NOW = new Date("2026-09-20T19:30:00Z");

test("현재 날씨 응답은 관측값과 POP별 표본을 지역·시도 단위로 조립한다", () => {
  const rows: CurrentWeatherRow[] = [
    {
      time: "2026-09-21 04:00",
      sidoCode: "11",
      sigunguCode: "A",
      name: "A 지역",
      kmaPop: 30,
      kmaPopSourceTime: "2026-09-21 04:00",
      pty: 0,
      rn1: 0,
      tmp: 20,
      sky: 3,
      skySourceTime: "2026-09-21 04:00",
      updatedAt: "2026-09-21T04:00:00Z",
    },
    {
      time: "2026-09-21 04:00",
      sidoCode: "11",
      sigunguCode: "B",
      name: "B 지역",
      kmaPop: null,
      kmaPopSourceTime: null,
      pty: 0,
      rn1: 0.3,
      tmp: null,
      sky: null,
      skySourceTime: null,
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

  assert.deepEqual(assembleCurrentWeatherResponse("2026-09-21 04:00", rows, buckets, NOW), {
    time: "2026-09-21 04:00",
    isStale: false,
    count: 2,
    data: {
      A: {
        ...rows[0],
        isStale: false,
        isRaining: false,
        empiricalRate: 50,
        sampleCount: 2,
        sidoEmpiricalRate: 60,
        sidoSampleCount: 5,
        stats: { 30: { rate: 50, samples: 2 }, 60: { rate: 25, samples: 4 } },
        sidoStats: { 30: { rate: 60, samples: 5 }, 60: { rate: 25, samples: 4 } },
      },
      B: {
        ...rows[1],
        isStale: false,
        isRaining: true,
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
    kmaPop: null,
    kmaPopSourceTime: null,
    pty: 0,
    rn1: 0,
    tmp: null,
    sky: 1,
    skySourceTime: "2026-09-21 04:00",
    updatedAt: "2026-09-21T04:00:00Z",
  };

  assert.deepEqual(assembleCurrentWeatherResponse(row.time, [row], [], NOW), {
    time: row.time,
    isStale: false,
    count: 1,
    data: {
      A: {
        ...row,
        isStale: false,
        isRaining: false,
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

test("관측 시각이 두 시간 이상 지나면 지역과 전체 응답을 오래됨으로 표시한다", () => {
  const row: CurrentWeatherRow = {
    time: "2026-09-21 02:00",
    sidoCode: "11",
    sigunguCode: "A",
    name: "A 지역",
    kmaPop: null,
    kmaPopSourceTime: null,
    pty: 0,
    rn1: 0,
    tmp: null,
    sky: 1,
    skySourceTime: "2026-09-21 02:00",
    updatedAt: "2026-09-20T17:40:00Z",
  };

  assert.equal(isObservationStale("2026-09-21 04:00", NOW), false);
  assert.equal(isObservationStale("2026-09-21 02:30", NOW), true);
  const result = assembleCurrentWeatherResponse("2026-09-21 04:00", [row], [], NOW);
  assert.equal(result.isStale, true);
  assert.equal(result.data.A.isStale, true);
});

test("DB 조회 행의 추가 필드는 API 응답에 섞이지 않는다", () => {
  const row = {
    time: "2026-09-21 04:00",
    sidoCode: "11",
    sigunguCode: "A",
    name: "A 지역",
    kmaPop: 30,
    kmaPopSourceTime: "2026-09-21 04:00",
    pty: 0,
    rn1: 0,
    tmp: 20,
    sky: 1,
    skySourceTime: "2026-09-21 04:00",
    updatedAt: "2026-09-21T04:00:00Z",
    internalColumn: "DB 전용 값",
  };

  const result = assembleCurrentWeatherResponse(row.time, [row], []);
  assert.equal(Object.hasOwn(result.data.A, "internalColumn"), false);
});
