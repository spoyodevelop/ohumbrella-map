import assert from "node:assert/strict";
import { test } from "node:test";
import { createClient, type Client } from "@libsql/client";
import {
  backfillAccuracyVerifications,
  createAccuracySchema,
  expectedForecastBaseTime,
  upsertAccuracyForForecastBaseTime,
  upsertAccuracyForObservationTime,
} from "./accuracy.ts";

test("관측 시각을 직전 단기예보 발표 회차에 연결한다", () => {
  assert.equal(expectedForecastBaseTime("2026-09-21 00:00"), "2026-09-20 23:00");
  assert.equal(expectedForecastBaseTime("2026-09-21 02:00"), "2026-09-20 23:00");
  assert.equal(expectedForecastBaseTime("2026-09-21 03:00"), "2026-09-21 02:00");
  assert.equal(expectedForecastBaseTime("2026-09-21 05:00"), "2026-09-21 02:00");
  assert.equal(expectedForecastBaseTime("2026-09-21 06:00"), "2026-09-21 05:00");
  assert.equal(expectedForecastBaseTime("2027-01-01 00:00"), "2026-12-31 23:00");
  assert.throws(() => expectedForecastBaseTime("2026-02-30 00:00"));
});

async function makeDatabase(): Promise<Client> {
  const client = createClient({ url: "file::memory:" });
  await client.execute(`
    CREATE TABLE weather_observations (
      time TEXT NOT NULL, sigungu_code TEXT NOT NULL, sido_code TEXT NOT NULL,
      name TEXT NOT NULL, is_raining INTEGER NOT NULL, rn1 REAL NOT NULL, tmp REAL,
      PRIMARY KEY (time, sigungu_code)
    )
  `);
  await client.execute(`
    CREATE TABLE weather_forecasts (
      base_time TEXT NOT NULL, target_time TEXT NOT NULL, sigungu_code TEXT NOT NULL,
      pop INTEGER NOT NULL, lead_hours INTEGER NOT NULL,
      PRIMARY KEY (base_time, target_time, sigungu_code)
    )
  `);
  await createAccuracySchema(client);
  return client;
}

async function insertObservation(client: Client, time: string, code: string, rain: number): Promise<void> {
  await client.execute({
    sql: `INSERT INTO weather_observations VALUES (?, ?, '11', ?, ?, ?, 20)`,
    args: [time, code, code, rain, rain],
  });
}

async function insertForecast(client: Client, base: string, target: string, code: string, pop: number, lead: number): Promise<void> {
  await client.execute({
    sql: `INSERT INTO weather_forecasts VALUES (?, ?, ?, ?, ?)`,
    args: [base, target, code, pop, lead],
  });
}

test("백필은 정해진 회차 한 건만 고르고 빠진 회차를 이전 회차로 대체하지 않는다", async () => {
  const client = await makeDatabase();
  try {
    await insertObservation(client, "2026-09-21 00:00", "A", 0);
    await insertObservation(client, "2026-09-21 03:00", "B", 1);
    await insertObservation(client, "2026-09-21 06:00", "C", 0);
    await insertForecast(client, "2026-09-20 23:00", "2026-09-21 00:00", "A", 20, 1);
    await insertForecast(client, "2026-09-20 23:00", "2026-09-21 03:00", "B", 20, 4);
    await insertForecast(client, "2026-09-21 02:00", "2026-09-21 03:00", "B", 30, 1);
    await insertForecast(client, "2026-09-21 02:00", "2026-09-21 06:00", "C", 60, 4);

    assert.equal(await backfillAccuracyVerifications(client), 2);
    assert.equal(await backfillAccuracyVerifications(client), 0);
    const rows = await client.execute(`
      SELECT target_time, sigungu_code, base_time, predicted_pop, actual_rain
      FROM v_verified_forecast_accuracy ORDER BY sigungu_code
    `);
    assert.deepEqual(rows.rows.map((r) => ({ ...r })), [
      { target_time: "2026-09-21 00:00", sigungu_code: "A", base_time: "2026-09-20 23:00", predicted_pop: 20, actual_rain: 0 },
      { target_time: "2026-09-21 03:00", sigungu_code: "B", base_time: "2026-09-21 02:00", predicted_pop: 30, actual_rain: 1 },
    ]);
    const stats = await client.execute("SELECT SUM(total_count) AS samples FROM verified_accuracy_stats");
    assert.equal(stats.rows[0].samples, 2);
  } finally {
    client.close();
  }
});

test("이미 백필한 뒤 새 원본이 들어와도 재실행으로 빠진 표본만 보충한다", async () => {
  const client = await makeDatabase();
  try {
    await insertForecast(client, "2026-09-21 02:00", "2026-09-21 03:00", "A", 30, 1);
    await insertObservation(client, "2026-09-21 03:00", "A", 0);
    assert.equal(await backfillAccuracyVerifications(client), 1);

    await insertForecast(client, "2026-09-21 02:00", "2026-09-21 04:00", "B", 40, 2);
    await insertObservation(client, "2026-09-21 04:00", "B", 1);
    assert.equal(await backfillAccuracyVerifications(client), 1);
    assert.equal(await backfillAccuracyVerifications(client), 0);

    const counts = await client.execute("SELECT SUM(total_count) AS samples FROM verified_accuracy_stats");
    assert.equal(counts.rows[0].samples, 2);
  } finally {
    client.close();
  }
});

test("동일 관측을 반복 처리하거나 정정해도 표본은 한 건이다", async () => {
  const client = await makeDatabase();
  try {
    const time = "2026-09-21 05:00";
    await insertObservation(client, time, "A", 0);
    await insertForecast(client, "2026-09-21 02:00", time, "A", 30, 3);

    assert.equal(await upsertAccuracyForObservationTime(client, time), 1);
    assert.equal(await upsertAccuracyForObservationTime(client, time), 1);
    let stats = await client.execute("SELECT total_count, rain_count FROM verified_accuracy_stats");
    assert.equal(stats.rows[0].total_count, 1);
    assert.equal(stats.rows[0].rain_count, 0);

    await client.execute({
      sql: "UPDATE weather_observations SET is_raining = 1, rn1 = 1 WHERE time = ? AND sigungu_code = ?",
      args: [time, "A"],
    });
    await upsertAccuracyForObservationTime(client, time);
    stats = await client.execute("SELECT total_count, rain_count FROM verified_accuracy_stats");
    assert.equal(stats.rows[0].total_count, 1);
    assert.equal(stats.rows[0].rain_count, 1);

    await client.execute({
      sql: "UPDATE weather_forecasts SET pop = 20 WHERE base_time = ? AND target_time = ? AND sigungu_code = ?",
      args: ["2026-09-21 02:00", time, "A"],
    });
    await upsertAccuracyForForecastBaseTime(client, "2026-09-21 02:00");
    stats = await client.execute("SELECT predicted_pop, total_count, rain_count FROM verified_accuracy_stats");
    assert.deepEqual(stats.rows.map((r) => ({ ...r })), [
      { predicted_pop: 20, total_count: 1, rain_count: 1 },
    ]);
  } finally {
    client.close();
  }
});

test("늦게 들어온 정해진 발표 회차는 기존 관측과 결합한다", async () => {
  const client = await makeDatabase();
  try {
    const time = "2026-09-21 06:00";
    await insertObservation(client, time, "A", 1);
    await insertForecast(client, "2026-09-21 02:00", time, "A", 20, 4);
    assert.equal(await upsertAccuracyForObservationTime(client, time), 0);

    await insertForecast(client, "2026-09-21 05:00", time, "A", 30, 1);
    assert.equal(await upsertAccuracyForForecastBaseTime(client, "2026-09-21 05:00"), 1);
    assert.equal(await upsertAccuracyForForecastBaseTime(client, "2026-09-21 05:00"), 1);
    const rows = await client.execute("SELECT base_time, predicted_pop, actual_rain FROM forecast_verifications");
    assert.deepEqual(rows.rows.map((r) => ({ ...r })), [
      { base_time: "2026-09-21 05:00", predicted_pop: 30, actual_rain: 1 },
    ]);
    const stats = await client.execute("SELECT total_count, rain_count FROM verified_accuracy_stats");
    assert.equal(stats.rows[0].total_count, 1);
    assert.equal(stats.rows[0].rain_count, 1);
  } finally {
    client.close();
  }
});
