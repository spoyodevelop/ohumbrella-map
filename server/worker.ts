import cron from "node-cron";
import dotenv from "dotenv";
import { resolve } from "node:path";
import {
  checkCanaryNcstUpdated,
  syncAllWeather,
  getNcstBaseDateTime,
} from "./kma.ts";

dotenv.config({ path: resolve(process.cwd(), ".env.local") });

console.log(`=============================================`);
console.log(`⚙️  [Worker] 기상청 수집 & 스케줄러 워커 시작`);
console.log(`=============================================`);

let isSyncing = false;
let lastSyncedBaseTime = "";

// 1. 매시 15~40분 사이 3분 간격으로 카나리(종로) 감시
cron.schedule("15-40/3 * * * *", async () => {
  if (isSyncing) return;
  const canary = await checkCanaryNcstUpdated(lastSyncedBaseTime);
  if (canary.updated) {
    console.log(`[워커] 새 실황(${canary.baseTime}) 감지! 전국 수집 실행`);
    isSyncing = true;
    try {
      await syncAllWeather();
      lastSyncedBaseTime = canary.baseTime;
    } catch (err) {
      console.error("[워커 수집 에러]", err);
    } finally {
      isSyncing = false;
    }
  }
});

// 2. 3시간 주기 단기예보 발표 시점 (02:20, 05:20, 08:20, 11:20, 14:20, 17:20, 20:20, 23:20)
cron.schedule("20 2,5,8,11,14,17,20,23 * * *", async () => {
  if (isSyncing) return;
  console.log("[워커] 3시간 주기 단기예보 발표 시점 - 정기 동기화 시작");
  isSyncing = true;
  try {
    await syncAllWeather();
  } catch (err) {
    console.error("[워커 단기예보 에러]", err);
  } finally {
    isSyncing = false;
  }
});

// 워커 시작 시 1회 초기 수집
(async () => {
  isSyncing = true;
  try {
    console.log("[워커 초기화] 시작 시점 전국 날씨 동기화 실행...");
    await syncAllWeather();
    const { baseTime } = getNcstBaseDateTime();
    lastSyncedBaseTime = baseTime;
  } catch (err) {
    console.error("[워커 초기 수집 실패]", err);
  } finally {
    isSyncing = false;
    console.log("[워커 대기] 다음 스케줄 대기 중...");
  }
})();
