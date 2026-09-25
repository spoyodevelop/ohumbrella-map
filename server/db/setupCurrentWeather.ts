import { db } from "../db.ts";
import { createCurrentWeatherTable } from "./currentWeatherTable.ts";
import { backfillCurrentWeather } from "./backfillCurrentWeather.ts";

try {
  await createCurrentWeatherTable(db);
  const affected = await backfillCurrentWeather(db);
  console.log(`current_weather 초기 채우기 완료: ${affected}행 반영`);
} catch (error) {
  console.error("current_weather 초기 채우기 실패:", error);
  process.exitCode = 1;
}
