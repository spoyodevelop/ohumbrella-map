import assert from "node:assert/strict";
import { test } from "node:test";
import { exceedsGridFailureLimit } from "./gridFailures.ts";

test("238개 격자 중 23개 실패까지는 회차를 유지한다", () => {
  assert.equal(exceedsGridFailureLimit(0, 238), false);
  assert.equal(exceedsGridFailureLimit(1, 238), false);
  assert.equal(exceedsGridFailureLimit(23, 238), false);
});

test("238개 격자 중 24개 이상 실패하면 회차 실패로 본다", () => {
  assert.equal(exceedsGridFailureLimit(24, 238), true);
  assert.equal(exceedsGridFailureLimit(238, 238), true);
});

test("격자가 없으면 실패 한도를 넘지 않는다", () => {
  assert.equal(exceedsGridFailureLimit(0, 0), false);
});
