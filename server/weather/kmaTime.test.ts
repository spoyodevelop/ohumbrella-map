import assert from "node:assert/strict";
import { test } from "node:test";
import { calculateLeadHours, getNcstBaseDateTime, getVilageBaseDateTime } from "./kmaTime.ts";

test("실황 발표 시각은 한국 시간 40분에 다음 회차로 바뀐다", () => {
  assert.deepEqual(getNcstBaseDateTime(new Date("2026-09-20T15:39:00Z")), {
    baseDate: "20260920", baseTime: "2300",
  });
  assert.deepEqual(getNcstBaseDateTime(new Date("2026-09-20T15:40:00Z")), {
    baseDate: "20260921", baseTime: "0000",
  });
  assert.deepEqual(getNcstBaseDateTime(new Date("2026-12-31T15:39:00Z")), {
    baseDate: "20261231", baseTime: "2300",
  });
});

test("단기예보 발표 시각은 한국 시간 15분에 다음 회차로 바뀐다", () => {
  assert.deepEqual(getVilageBaseDateTime(new Date("2026-09-20T17:14:00Z")), {
    baseDate: "20260920", baseTime: "2300",
  });
  assert.deepEqual(getVilageBaseDateTime(new Date("2026-09-20T17:15:00Z")), {
    baseDate: "20260921", baseTime: "0200",
  });
  assert.deepEqual(getVilageBaseDateTime(new Date("2026-09-20T20:14:00Z")), {
    baseDate: "20260921", baseTime: "0200",
  });
  assert.deepEqual(getVilageBaseDateTime(new Date("2026-09-20T20:15:00Z")), {
    baseDate: "20260921", baseTime: "0500",
  });
});

test("예보 선행 시간은 날짜가 바뀌어도 계산한다", () => {
  assert.equal(calculateLeadHours("2026-12-31 23:00", "2027-01-01 02:00"), 3);
  assert.equal(calculateLeadHours("2026-09-21 05:00", "2026-09-21 04:00"), 0);
});
