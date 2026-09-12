import dotenv from "dotenv";
import { resolve } from "node:path";
import { syncAllWeather } from "./kma.ts";

dotenv.config({ path: resolve(process.cwd(), ".env.local") });

console.log(`=============================================`);
console.log(`🔄 [CLI Sync] 1회성 날씨 수집 실행`);
console.log(`=============================================`);

syncAllWeather()
  .then((result) => {
    console.log(`[완료] 실황 ${result.obsCount}건, 예보 ${result.fcstCount}건 동기화 성공!`);
    process.exit(0);
  })
  .catch((err) => {
    console.error("[실패] 수집 도중 에러 발생:", err);
    process.exit(1);
  });
