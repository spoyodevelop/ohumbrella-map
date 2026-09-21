import assert from "node:assert/strict";
import { test } from "node:test";
import { parseForecastItems, parseObservationItems, type KmaForecastItem } from "./kmaParse.ts";

test("실황 원본의 강수형태를 내부 코드로 모으고 결측 기온을 제외한다", () => {
  assert.deepEqual(parseObservationItems([
    { category: "PTY", obsrValue: "5" },
    { category: "RN1", obsrValue: "0" },
    { category: "T1H", obsrValue: "-900" },
  ]), { pty: 1, rn1: 0, tmp: null, isRaining: 1 });

  assert.deepEqual(parseObservationItems([
    { category: "PTY", obsrValue: "0" },
    { category: "RN1", obsrValue: "0.3" },
    { category: "T1H", obsrValue: "18.5" },
  ]), { pty: 0, rn1: 0.3, tmp: 18.5, isRaining: 1 });

  for (const [raw, expected] of [[4, 1], [6, 2], [7, 3]]) {
    assert.deepEqual(parseObservationItems([
      { category: "PTY", obsrValue: String(raw) },
      { category: "RN1", obsrValue: "0" },
    ]), { pty: expected, rn1: 0, tmp: null, isRaining: 1 });
  }
});

test("예보는 시각별 POP·SKY·TMP를 합치고 유효한 POP만 남긴다", () => {
  const item = (fcstTime: string, category: string, fcstValue: string): KmaForecastItem => ({
    fcstDate: "20260921", fcstTime, category, fcstValue,
  });
  assert.deepEqual(parseForecastItems([
    item("0600", "SKY", "3"),
    item("0600", "POP", "40"),
    item("0600", "TMP", "-900"),
    item("0700", "POP", ""),
    item("0800", "POP", "101"),
    item("0900", "POP", "0"),
    item("0900", "TMP", "19"),
  ]), [
    { targetTime: "2026-09-21 06:00", pop: 40, sky: 3, tmp: null },
    { targetTime: "2026-09-21 09:00", pop: 0, sky: 1, tmp: 19 },
  ]);
});
