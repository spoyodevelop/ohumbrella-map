import assert from "node:assert/strict";
import { test } from "node:test";
import {
  forecastRound,
  groupForecastItems,
  type ForecastResult,
} from "./kmaClient.ts";
import {
  isCommuteSettings,
  isRain,
  judge,
  selectForecast,
  getCommuteForecast,
} from "./service.ts";
import type { CommutePoint } from "../../shared/commute.ts";

test("forecast publication rounds cross midnight in Korean time", () => {
  assert.equal(
    forecastRound("village", new Date("2026-11-01T15:05:00Z")).toISOString(),
    "2026-11-01T23:00:00.000Z",
  );
  assert.equal(
    forecastRound("ultra", new Date("2026-11-01T15:44:00Z")).toISOString(),
    "2026-11-01T23:30:00.000Z",
  );
  assert.equal(
    forecastRound("ultra", new Date("2026-11-01T15:45:00Z")).toISOString(),
    "2026-11-02T00:30:00.000Z",
  );
});
test("hour grouping retains ultra forecast without POP and sorts timestamps", () => {
  const rows = groupForecastItems([
    { category: "PTY", fcstDate: "20261102", fcstTime: "1800", fcstValue: "1" },
    {
      category: "RN1",
      fcstDate: "20261102",
      fcstTime: "0900",
      fcstValue: "1mm 미만",
    },
  ]);
  assert.equal(rows[0].targetTime, "2026-11-02 09:00");
  assert.equal(rows[0].values.RN1, "1mm 미만");
  assert.equal(rows.length, 2);
});
const target = "2026-11-02 18:00";
function result(
  source: "ultra" | "village",
  values: Record<string, string>,
): ForecastResult {
  return {
    source,
    status: "ok",
    issuedAt: "2026-11-02 14:00",
    hourly: [{ targetTime: target, values }],
  };
}
test("ultra fields take priority while absent or invalid fields fall back to village", () => {
  const forecast = selectForecast(target, [
    result("ultra", { PTY: "1", T1H: "-999", RN1: "1mm 미만" }),
    result("village", { POP: "70", PTY: "0", TMP: "15" }),
  ]);
  assert.equal(forecast?.pop?.value, 70);
  assert.equal(forecast?.pop?.source, "village");
  assert.equal(forecast?.pty?.source, "ultra");
  assert.equal(forecast?.rain?.value, "1mm 미만");
  assert.equal(forecast?.temperature?.value, 15);
  assert.equal(forecast?.sky, null);
  assert.equal(
    selectForecast("2026-11-03 18:00", [result("village", { POP: "70" })]),
    null,
  );
});
test("umbrella needs POP 60 or a precipitation type, and missing POP is unknown", () => {
  const forecast = (pop: number | null, pty: number | null) =>
    selectForecast(target, [
      result("village", {
        ...(pop === null ? {} : { POP: String(pop) }),
        ...(pty === null ? {} : { PTY: String(pty) }),
        TMP: "10",
      }),
    ]);
  assert.equal(isRain(forecast(30, 0)), false);
  assert.equal(isRain(forecast(60, 0)), true);
  assert.equal(isRain(forecast(20, 4)), true);
  assert.equal(isRain(forecast(null, null)), false);
  const point = (
    status: CommutePoint["status"],
    rain = false,
  ): CommutePoint => ({
    kind: "leaveHome",
    place: "집",
    targetTime: target,
    status,
    forecast: null,
    rain,
    record: null,
  });
  assert.equal(judge([point("ok"), point("ok")]), "none");
  assert.equal(judge([point("ok"), point("missing")]), "unknown");
  assert.equal(judge([point("missing"), point("ok", true)]), "umbrella");
  assert.equal(judge([point("elapsed", true), point("ok")]), "none");
  assert.equal(judge([point("elapsed"), point("elapsed")]), "elapsed");
});
test("API settings reject unknown regions and hours outside 0-23", () => {
  const settings = {
    version: 1,
    home: { code: "11110", name: "종로구" },
    work: { code: "11110", name: "종로구" },
    homeHour: 0,
    workHour: 23,
    travelHours: 1,
  };
  assert.equal(isCommuteSettings(settings), true);
  assert.equal(isCommuteSettings({ ...settings, homeHour: 24 }), false);
  assert.equal(isCommuteSettings({ ...settings, travelHours: 3 }), true);
  assert.equal(isCommuteSettings({ ...settings, travelHours: 4 }), false);
  assert.equal(
    isCommuteSettings({ ...settings, travelHours: undefined }),
    false,
  );
  assert.equal(
    isCommuteSettings({
      ...settings,
      home: { code: "xxxxx", name: "unknown" },
    }),
    false,
  );
});
test("commute days judge four points, keep the surviving source, and default to tomorrow after work", async () => {
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async (input) => {
    calls++;
    if (String(input).includes("getUltraSrtFcst"))
      throw new Error("Unavailable");
    return new Response(
      JSON.stringify({
        response: {
          header: { resultCode: "00" },
          body: {
            totalCount: 2,
            items: {
              item: [
                {
                  category: "POP",
                  fcstDate: "20261103",
                  fcstTime: "0000",
                  fcstValue: "80",
                },
                {
                  category: "PTY",
                  fcstDate: "20261103",
                  fcstTime: "0000",
                  fcstValue: "1",
                },
              ],
            },
          },
        },
      }),
      { headers: { "Content-Type": "application/json" } },
    );
  };
  const unavailable = async () => {
    throw new Error("No database");
  };
  const previous = process.env.KMA_SERVICE_KEY;
  process.env.KMA_SERVICE_KEY = "test-key";
  try {
    const settings = (homeHour: number, workHour: number, travelHours = 1) => ({
      version: 1 as const,
      home: { code: "11110", name: "집" },
      work: { code: "11110", name: "회사" },
      homeHour,
      workHour,
      travelHours,
    });
    // 12:00 in Korean time; an overnight shift leaves work the next day.
    const overnight = await getCommuteForecast(
      settings(22, 0),
      new Date("2026-11-02T03:00:00Z"),
      async (codes) => {
        assert.deepEqual(codes, ["11110"]);
        return { "11110": [{ pop: 80, rainCount: 9, samples: 12 }] };
      },
    );
    assert.equal(calls, 4);
    assert.deepEqual(overnight.days[0].points[2].record, {
      pop: 80,
      rainCount: 9,
      samples: 12,
    });
    assert.equal(overnight.days[0].points[0].record, null);
    assert.deepEqual(overnight.places, [
      {
        place: { code: "11110", name: "집" },
        records: [{ pop: 80, rainCount: 9, samples: 12 }],
      },
    ]);
    assert.equal(overnight.defaultDay, "today");
    const [today, tomorrow] = overnight.days;
    assert.equal(today.date, "2026-11-02");
    assert.deepEqual(
      today.points.map((p) => [p.kind, p.place, p.targetTime]),
      [
        ["leaveHome", "집", "2026-11-02 22:00"],
        ["arriveWork", "회사", "2026-11-02 23:00"],
        ["leaveWork", "회사", "2026-11-03 00:00"],
        ["arriveHome", "집", "2026-11-03 01:00"],
      ],
    );
    assert.equal(today.points[2].forecast?.pop?.source, "village");
    assert.equal(today.points[2].rain, true);
    assert.equal(today.points[0].status, "missing");
    assert.equal(today.verdict, "umbrella");
    assert.equal(tomorrow.date, "2026-11-03");
    assert.equal(tomorrow.points[2].targetTime, "2026-11-04 00:00");

    // At noon the morning points have passed; missing data is never "no umbrella".
    const noon = await getCommuteForecast(
      settings(8, 18),
      new Date("2026-11-02T03:00:00Z"),
      unavailable,
    );
    assert.equal(noon.defaultDay, "today");
    // A failed record read keeps the forecast.
    assert.equal(noon.places, null);
    assert.deepEqual(
      noon.days[0].points.map((p) => p.status),
      ["elapsed", "elapsed", "missing", "missing"],
    );
    assert.equal(noon.days[0].points[0].forecast, null);
    assert.equal(noon.days[0].verdict, "unknown");
    assert.equal(noon.days[1].points[0].targetTime, "2026-11-03 08:00");

    // Once the work departure hour starts, tomorrow becomes the default.
    const evening = await getCommuteForecast(
      settings(8, 18),
      new Date("2026-11-02T09:20:00Z"),
      unavailable,
    );
    assert.equal(evening.defaultDay, "tomorrow");
    assert.equal(evening.days[0].points[2].status, "elapsed");
    assert.notEqual(evening.days[0].points[3].status, "elapsed");

    // Arrival points follow the travel time.
    const longTrip = await getCommuteForecast(
      settings(8, 18, 3),
      new Date("2026-11-02T03:00:00Z"),
      unavailable,
    );
    assert.deepEqual(
      longTrip.days[1].points.map((p) => p.targetTime.slice(11)),
      ["08:00", "11:00", "18:00", "21:00"],
    );

    const night = await getCommuteForecast(
      settings(8, 18),
      new Date("2026-11-02T11:00:00Z"),
      unavailable,
    );
    assert.equal(night.days[0].verdict, "elapsed");
  } finally {
    globalThis.fetch = original;
    if (previous === undefined) delete process.env.KMA_SERVICE_KEY;
    else process.env.KMA_SERVICE_KEY = previous;
  }
});
