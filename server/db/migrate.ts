import { migrateDb } from "./schema.ts";

try {
  await migrateDb();
} catch (error) {
  console.error("DB 마이그레이션 실패:", error);
  process.exitCode = 1;
}
