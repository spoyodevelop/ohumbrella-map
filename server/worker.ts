import cron from "node-cron";
import https from "node:https";
import { reportServerError } from "./monitoring.ts";
import { getNcstBaseDateTime, getVilageBaseDateTime } from "./weather/kmaTime.ts";
import { createWorkerQueue } from "./workerQueue.ts";
import {
  checkCanaryNcstUpdated,
  syncObservations,
  syncForecasts,
} from "./weather/kma.ts";

type RegisterSchedule = (expression: string, task: () => Promise<void>) => void;

const registerKstSchedule: RegisterSchedule = (expression, task) => {
  cron.schedule(expression, task, { timezone: "Asia/Seoul" });
};

let lastSyncedObservationRound = "";
let pendingForecastRound: string | null = null;
let workerStarted = false;
const enqueue = createWorkerQueue((error) => {
  console.error("[워커 예약 작업 에러]", error);
  reportServerError(error, "worker.queue");
});

function currentForecastRound() {
  const { baseDate, baseTime } = getVilageBaseDateTime();
  return { baseDate, baseTime, key: `${baseDate} ${baseTime}` };
}

/**
 * Healthchecks.io Ping 신호 전송
 * @param urlStr Healthchecks Ping URL
 * @param error 실패 시 에러 객체 또는 메시지 (/fail 엔드포인트 호출)
 */
function pingHealthcheck(urlStr?: string, error?: unknown): Promise<void> {
  if (!urlStr) return Promise.resolve();
  return new Promise((res) => {
    try {
      const targetUrl = new URL(error ? `${urlStr}/fail` : urlStr);
      const body = error ? String(error) : "OK";
      const req = https.request(
        targetUrl,
        {
          method: "POST",
          family: 4, // VPS 환경의 IPv6 라우팅 타임아웃 방지
          headers: {
            "Content-Type": "text/plain",
            "Content-Length": Buffer.byteLength(body),
          },
          timeout: 10000,
        },
        (response) => {
          console.log(
            `📡 [Healthcheck] Ping 완료 (${error ? "FAIL" : "SUCCESS"}, HTTP ${response.statusCode}): ${targetUrl.pathname}`,
          );
          res();
        },
      );
      req.on("error", (e) => {
        console.error("⚠️ [Healthcheck] Ping 전송 실패:", e);
        res();
      });
      req.on("timeout", () => {
        req.destroy();
        console.error("⚠️ [Healthcheck] Ping 타임아웃");
        res();
      });
      req.write(body);
      req.end();
    } catch (e) {
      console.error("⚠️ [Healthcheck] URL 처리 실패:", e);
      res();
    }
  });
}

export function startWorker(registerSchedule: RegisterSchedule = registerKstSchedule) {
  if (workerStarted) {
    throw new Error("수집 워커가 이미 시작되었습니다.");
  }

  // 매시간 40~58분 사이 2분 간격으로 새 실황 확인
  registerSchedule("40-58/2 * * * *", async () => {
    const checkedAt = new Date();
    const round = getNcstBaseDateTime(checkedAt);
    await enqueue(`observation:${round.baseDate}:${round.baseTime}`, async () => {
      try {
        const canary = await checkCanaryNcstUpdated(lastSyncedObservationRound, checkedAt);
        if (canary.updated) {
          console.log(`[워커] 새 실황(${canary.baseTime}) 감지! 전국 실황 수집 실행`);
          await syncObservations(round);
          lastSyncedObservationRound = `${canary.baseDate} ${canary.baseTime}`;
          await pingHealthcheck(process.env.HEALTHCHECK_NCST_URL);
        } else if (canary.lastCheckOfRound && `${canary.baseDate} ${canary.baseTime}` !== lastSyncedObservationRound) {
          throw new Error(`실황 ${canary.baseDate} ${canary.baseTime} 자료가 58분까지 열리지 않았습니다.`);
        }
      } catch (err) {
        console.error("[워커 실황 확인·수집 에러]", err);
        reportServerError(err, "worker.observation");
        await pingHealthcheck(process.env.HEALTHCHECK_NCST_URL, err);
      }
    });
  });

  async function collectForecast(round: ReturnType<typeof currentForecastRound>): Promise<void> {
    try {
      await syncForecasts(round);
      pendingForecastRound = null;
      await pingHealthcheck(process.env.HEALTHCHECK_FCST_URL);
    } catch (err) {
      pendingForecastRound = round.key;
      console.error("[워커 단기예보 에러]", err);
      reportServerError(err, "worker.forecast");
      await pingHealthcheck(process.env.HEALTHCHECK_FCST_URL, err);
    }
  }

  // 02:20부터 3시간마다 단기예보 수집
  registerSchedule("20 2,5,8,11,14,17,20,23 * * *", async () => {
    console.log("[워커] 3시간 주기 단기예보 발표 시점 - 정기 예보 수집 시작");
    const round = currentForecastRound();
    await enqueue(`forecast:${round.key}`, () => collectForecast(round));
  });

  // 실패한 발표 회차만 10분 간격으로 다시 수집한다.
  registerSchedule("5,15,25,35,45,55 * * * *", async () => {
    if (!pendingForecastRound) return;
    const round = currentForecastRound();
    if (round.key !== pendingForecastRound) {
      pendingForecastRound = null;
      return;
    }
    console.log(`[워커] 단기예보 ${round.key} 재시도`);
    await enqueue(`forecast:${round.key}`, async () => {
      if (pendingForecastRound === round.key) await collectForecast(round);
    });
  });

  workerStarted = true;
  console.log("[워커 대기] 정해진 수집 시각을 기다립니다.");
}
