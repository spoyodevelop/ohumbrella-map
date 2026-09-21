import assert from "node:assert/strict";
import { test } from "node:test";

test("마이그레이션은 사용하지 않는 정확도 통계 테이블을 삭제한다", async () => {
  process.env.TURSO_DATABASE_URL = "file::memory:";
  process.env.SENTRY_DSN = "";
  const { db } = await import("../db.ts");
  const { migrateDb } = await import("./schema.ts");

  await db.execute("CREATE TABLE forecast_accuracy_stats (id INTEGER PRIMARY KEY)");
  await db.execute("INSERT INTO forecast_accuracy_stats (id) VALUES (1)");
  await migrateDb();

  const result = await db.execute(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'forecast_accuracy_stats'",
  );
  assert.equal(result.rows.length, 0);
});
