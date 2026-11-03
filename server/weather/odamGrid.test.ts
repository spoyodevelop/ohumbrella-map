import assert from "node:assert/strict";
import test from "node:test";
import {
  mapOdamPty,
  odamGridIndex,
  parseOdamPty,
  ODAM_WIDTH,
  ODAM_HEIGHT,
} from "./odamGrid.ts";

test("KMA 좌측하단부터 행 단위로 좌표를 매핑한다", () => {
  assert.equal(odamGridIndex(1, 1), 0);
  assert.equal(odamGridIndex(149, 1), 148);
  assert.equal(odamGridIndex(1, 2), 149);
  assert.equal(odamGridIndex(149, 253), 37696);
  assert.throws(() => odamGridIndex(0, 1));
  const values = Array(ODAM_WIDTH * ODAM_HEIGHT).fill(-99);
  values[odamGridIndex(60, 127)] = 1;
  const result = mapOdamPty(values.join(","), [
    {
      code: "test",
      name: "test",
      nx: 60,
      ny: 127,
      lat: 0,
      lon: 0,
      sidoCode: "test",
    },
  ]);
  assert.equal(result[0]?.pty, 1);
  assert.equal(result[0]?.hasPrecipitation, true);
  assert.equal(parseOdamPty(values.join(","))[0], null);
});

test("HTTP 200 오류 본문과 잘못된 값은 자료로 취급하지 않는다", () => {
  assert.throws(() => parseOdamPty("# dfs_file_read error (-1)"));
  const values = Array(ODAM_WIDTH * ODAM_HEIGHT).fill(0);
  values[0] = 99;
  assert.throws(() => parseOdamPty(values.join(",")));
});
