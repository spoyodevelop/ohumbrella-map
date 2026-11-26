import cron from "node-cron";
import https from "node:https";
import { reportServerError } from "./monitoring.ts";
import {
  getNcstBaseDateTime,
  getVilageBaseDateTime,
  isLastNcstCheckOfRound,
} from "./weather/kmaTime.ts";
import { createWorkerQueue } from "./workerQueue.ts";
import { GridFailureError } from "./weather/gridFailures.ts";
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
// 재수집할 예보 회차. gridKeys가 없으면 전체 격자를 다시 받는다.
let pendingForecast: { key: string; gridKeys?: string[] } | null = null;
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

export function startWorker(
  registerSchedule: RegisterSchedule = registerKstSchedule,
) {
  if (workerStarted) {
    throw new Error("수집 워커가 이미 시작되었습니다.");
  }

  // 매시간 40~58분 사이 2분 간격으로 새 실황 확인
  registerSchedule("40-58/2 * * * *", async () => {
    const checkedAt = new Date();
    const round = getNcstBaseDateTime(checkedAt);
    await enqueue(
      `observation:${round.baseDate}:${round.baseTime}`,
      async () => {
        let canary: Awaited<ReturnType<typeof checkCanaryNcstUpdated>>;
        try {
          canary = await checkCanaryNcstUpdated(
            lastSyncedObservationRound,
            checkedAt,
          );
        } catch (err) {
          // 카나리 1개 요청 실패는 2분 뒤 다음 확인에서 다시 본다.
          // 회차의 마지막 확인(58분)에서도 실패할 때만 헬스체크를 울린다.
          console.error("[워커 실황 카나리 에러]", err);
          reportServerError(err, "worker.observation.canary");
          if (isLastNcstCheckOfRound(checkedAt)) {
            await pingHealthcheck(process.env.HEALTHCHECK_NCST_URL, err);
          }
          return;
        }

        try {
          if (canary.updated) {
            console.log(
              `[워커] 새 실황(${canary.baseTime}) 감지! 전국 실황 수집 실행`,
            );
            await syncObservations(round);
            lastSyncedObservationRound = `${canary.baseDate} ${canary.baseTime}`;
            await pingHealthcheck(process.env.HEALTHCHECK_NCST_URL);
          } else if (
            canary.lastCheckOfRound &&
            `${canary.baseDate} ${canary.baseTime}` !==
              lastSyncedObservationRound
          ) {
            throw new Error(
              `실황 ${canary.baseDate} ${canary.baseTime} 자료가 58분까지 열리지 않았습니다.`,
            );
          }
        } catch (err) {
          console.error("[워커 실황 확인·수집 에러]", err);
          reportServerError(err, "worker.observation");
          await pingHealthcheck(process.env.HEALTHCHECK_NCST_URL, err);
        }
      },
    );
  });

  async function collectForecast(
    round: ReturnType<typeof currentForecastRound>,
    gridKeys?: string[],
    isRetry = false,
  ): Promise<void> {
    try {
      const { failedGridKeys } = await syncForecasts(round, gridKeys);
      // 한도 안의 실패 격자도 다음 재시도 때 조용히 다시 받는다.
      pendingForecast = failedGridKeys.length
        ? { key: round.key, gridKeys: failedGridKeys }
        : null;
      await pingHealthcheck(process.env.HEALTHCHECK_FCST_URL);
    } catch (err) {
      pendingForecast = {
        key: round.key,
        gridKeys:
          err instanceof GridFailureError ? err.failedGridKeys : gridKeys,
      };
      console.error("[워커 단기예보 에러]", err);
      reportServerError(err, "worker.forecast");
      if (isRetry) await pingHealthcheck(process.env.HEALTHCHECK_FCST_URL, err);
    }
  }

  // 02:20부터 3시간마다 단기예보 수집
  registerSchedule("20 2,5,8,11,14,17,20,23 * * *", async () => {
    console.log("[워커] 3시간 주기 단기예보 발표 시점 - 정기 예보 수집 시작");
    const round = currentForecastRound();
    await enqueue(`forecast:${round.key}`, () => collectForecast(round));
  });

  // 실패한 발표 회차의 실패 격자만 10분 간격으로 다시 수집한다.
  registerSchedule("5,15,25,35,45,55 * * * *", async () => {
    if (!pendingForecast) return;
    const round = currentForecastRound();
    if (round.key !== pendingForecast.key) {
      pendingForecast = null;
      return;
    }
    console.log(
      `[워커] 단기예보 ${round.key} 재시도 (${pendingForecast.gridKeys ? `${pendingForecast.gridKeys.length}개` : "전체"} 격자)`,
    );
    await enqueue(`forecast:${round.key}`, async () => {
      const pending = pendingForecast;
      if (pending?.key === round.key)
        await collectForecast(round, pending.gridKeys, true);
    });
  });

  workerStarted = true;
  console.log("[워커 대기] 정해진 수집 시각을 기다립니다.");
}
