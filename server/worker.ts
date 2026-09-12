import cron from "node-cron";
import dotenv from "dotenv";
import { resolve } from "node:path";
import {
  checkCanaryNcstUpdated,
  syncObservations,
  syncForecasts,
  syncAllWeather,
  getNcstBaseDateTime,
} from "./kma.ts";

dotenv.config({ path: resolve(process.cwd(), ".env.local") });

console.log(`=============================================`);
console.log(`⚙️  [Worker] 기상청 수집 & 스케줄러 워커 시작`);
console.log(`=============================================`);

let isSyncing = false;
let lastSyncedBaseTime = "";

// 1. [매시간 실황 수집] 매시 40~58분 사이 2분 간격 카나리 감시
// 초단기실황은 매시 30분 생성 후 40분 이후 제공되므로 40분부터 확인
cron.schedule("40-58/2 * * * *", async () => {
  if (isSyncing) return;
  const canary = await checkCanaryNcstUpdated(lastSyncedBaseTime);
  if (canary.updated) {
    console.log(`[워커] 새 실황(${canary.baseTime}) 감지! 전국 실황 수집 실행`);
    isSyncing = true;
    try {
      await syncObservations();
      lastSyncedBaseTime = canary.baseTime;
    } catch (err) {
      console.error("[워커 실황 수집 에러]", err);
    } finally {
      isSyncing = false;
    }
  }
});

// 2. [3시간 주기 단기예보 수집] 02:20, 05:20, 08:20, 11:20, 14:20, 17:20, 20:20, 23:20
// 하루 딱 8회만 실행되어 미래 24시간 치 POP 예보 수집
cron.schedule("20 2,5,8,11,14,17,20,23 * * *", async () => {
  if (isSyncing) return;
  console.log("[워커] 3시간 주기 단기예보 발표 시점 - 정기 예보 수집 시작");
  isSyncing = true;
  try {
    await syncForecasts();
  } catch (err) {
    console.error("[워커 단기예보 에러]", err);
  } finally {
    isSyncing = false;
  }
});

// 워커 시작 시 1회 초기 전체 동기화 (실황 1회 + 예보 1회)
(async () => {
  isSyncing = true;
  try {
    console.log("[워커 초기화] 시작 시점 실황 및 예보 초기 동기화 실행...");
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
