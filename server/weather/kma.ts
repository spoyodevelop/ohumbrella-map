import { loadServerEnv, requireKmaServiceKey } from "../env.ts";
import { reportServerWarning } from "../monitoring.ts";
import { distinctGrids, sigunguMap, type DistinctGrid } from "./gridMap.ts";
import {
  calculateLeadHours,
  getNcstBaseDateTime,
  getVilageBaseDateTime,
  isLastNcstCheckOfRound,
} from "./kmaTime.ts";
import {
  parseForecastItems,
  parseObservationItems,
  type KmaForecastItem,
  type KmaObservationItem,
} from "./kmaParse.ts";
import { fetchKmaWithRetry } from "./kmaClient.ts";
import { exceedsGridFailureLimit, GridFailureError } from "./gridFailures.ts";
import { collectGrids, type GridCollectOptions } from "./gridCollector.ts";
import {
  upsertObservationsBatch,
  upsertObservationReadModelBatch,
  upsertForecastsBatch,
  updateLatestForecastReadModelBatch,
  type ObservationRecord,
  type ForecastRecord,
  type ObservationReadModelRecord,
} from "./write.ts";
import {
  syncAccuracyForObservationTime,
  syncAccuracyForForecastBaseTime,
} from "../verification/sync.ts";

loadServerEnv();

const BASE_URL =
  "https://apihub.kma.go.kr/api/typ02/openApi/VilageFcstInfoService_2.0";

function gridRegionNames(grid: DistinctGrid): string {
  return grid.sigunguCodes
    .map((code) => sigunguMap.get(code)?.name ?? code)
    .join("·");
}

// 카나리 방식으로 찔러보는 용도
// 매시 40분 이후 정시 데이터가 열렸는지 1개 격자만 확인
export async function checkCanaryNcstUpdated(
  lastKnownRound: string,
  checkedAt = new Date(),
) {
  const serviceKey = requireKmaServiceKey();
  const kst = new Date(checkedAt.getTime() + 9 * 60 * 60 * 1000);
  const lastCheckOfRound = isLastNcstCheckOfRound(checkedAt);
  const currentHour = kst.getUTCHours();
  const baseDate =
    kst.getUTCFullYear() +
    String(kst.getUTCMonth() + 1).padStart(2, "0") +
    String(kst.getUTCDate()).padStart(2, "0");
  const candidateBaseTime = String(currentHour).padStart(2, "0") + "00";

  if (`${baseDate} ${candidateBaseTime}` === lastKnownRound) {
    return {
      updated: false,
      baseDate,
      baseTime: candidateBaseTime,
      lastCheckOfRound,
    };
  }

  const url = `${BASE_URL}/getUltraSrtNcst?pageNo=1&numOfRows=10&dataType=JSON&base_date=${baseDate}&base_time=${candidateBaseTime}&nx=60&ny=127&authKey=${serviceKey}`;

  const result = await fetchKmaWithRetry<KmaObservationItem>(url, 2, 300);
  if (result.kind === "items") {
    console.log(
      `[카나리 감지] 종로구에 실황 오픈 (${baseDate} ${candidateBaseTime})`,
    );
    return {
      updated: true,
      baseDate,
      baseTime: candidateBaseTime,
      lastCheckOfRound,
    };
  }

  return {
    updated: false,
    baseDate,
    baseTime: candidateBaseTime,
    lastCheckOfRound,
  };
}

function collectOptions(label: string): GridCollectOptions<DistinctGrid> {
  return {
    onChunkDone: (done, total, chunk) =>
      console.log(
        `[${label} 진행] ${done} / ${total} 격자 완료... [처리 지역] ${chunk.map(gridRegionNames).join(", ")}`,
      ),
    onOutage: (pause, max, chunk) =>
      console.warn(
        `[${label} 장애 감지] 묶음 ${chunk.length}개 격자 전부 실패, 잠시 쉬고 다시 시도 (${pause}/${max})`,
      ),
  };
}

function logFailedGrids(
  label: string,
  failed: { grid: DistinctGrid; error: unknown }[],
) {
  for (const { grid, error } of failed) {
    console.warn(
      `[${label} 요청 실패] ${grid.gridKey} (${gridRegionNames(grid)}): 저장 건너뜀`,
      error,
    );
  }
}

function selectGrids(gridKeys?: string[]): DistinctGrid[] {
  if (!gridKeys) return distinctGrids;
  const wanted = new Set(gridKeys);
  return distinctGrids.filter((grid) => wanted.has(grid.gridKey));
}

// --------------------------------------------------------------------------
// 1. [실황 전용 수집] 1시간마다 1회만 호출 (getUltraSrtNcst만 238콜)
// --------------------------------------------------------------------------
export async function syncObservations(
  round = getNcstBaseDateTime(),
): Promise<number> {
  const serviceKey = requireKmaServiceKey();
  const { baseDate: ncstDate, baseTime: ncstTime } = round;
  const obsTimeStr = `${ncstDate.slice(0, 4)}-${ncstDate.slice(4, 6)}-${ncstDate.slice(6, 8)} ${ncstTime.slice(0, 2)}:00`;
  const createdAt = new Date().toISOString();

  console.log(`[실황 수집] 관측기준: ${obsTimeStr} (238개 격자)`);

  const { results, failed, outagePauses } = await collectGrids(
    distinctGrids,
    (grid) =>
      fetchKmaWithRetry<KmaObservationItem>(
        `${BASE_URL}/getUltraSrtNcst?pageNo=1&numOfRows=10&dataType=JSON&base_date=${ncstDate}&base_time=${ncstTime}&nx=${grid.nx}&ny=${grid.ny}&authKey=${serviceKey}`,
        3,
        400,
      ),
    collectOptions("실황"),
  );
  logFailedGrids("실황", failed);
  const failedGridKeys = failed.map((f) => f.grid.gridKey);

  const observationsToInsert: ObservationRecord[] = [];
  const hourlyToInsert: ObservationReadModelRecord[] = [];
  let missingGrids = 0;

  for (const { grid, value: result } of results) {
    if (result.kind === "no-data") {
      console.warn(
        `[실황 자료 없음] ${grid.gridKey} (${gridRegionNames(grid)}): 저장 건너뜀`,
      );
      missingGrids++;
      continue;
    }

    const { pty, rn1, tmp, isRaining } = parseObservationItems(result.items);

    for (const code of grid.sigunguCodes) {
      const sigungu = sigunguMap.get(code);
      const sidoCode = sigungu?.sidoCode ?? code.slice(0, 2);
      const name = sigungu?.name ?? code;

      observationsToInsert.push({
        time: obsTimeStr,
        sigunguCode: code,
        sidoCode,
        name,
        isRaining,
        pty,
        rn1,
        tmp,
        createdAt,
      });

      // 지도 렌더링용 실황 업데이트
      hourlyToInsert.push({
        time: obsTimeStr,
        sidoCode,
        sigunguCode: code,
        name,
        pty,
        rn1,
        tmp,
        updatedAt: createdAt,
      });
    }
  }

  console.log(`\n[실황 저장] ${observationsToInsert.length}건 DB 저장 완료!`);
  if (observationsToInsert.length === 0) {
    throw new Error(
      `실황 수집 실패: ${ncstDate} ${ncstTime}의 모든 격자에 자료가 없습니다.`,
    );
  }

  await upsertObservationsBatch(observationsToInsert);
  await upsertObservationReadModelBatch(hourlyToInsert);
  // 이 관측 시각에 매칭되는 예보들로 정확도 집계 누적
  await syncAccuracyForObservationTime(obsTimeStr);

  if (exceedsGridFailureLimit(failedGridKeys.length, distinctGrids.length)) {
    throw new GridFailureError(
      `실황 수집 실패: ${ncstDate} ${ncstTime} 격자 ${failedGridKeys.length}/${distinctGrids.length}개 요청 실패`,
      failedGridKeys,
    );
  }

  if (missingGrids > 0 || failedGridKeys.length > 0 || outagePauses > 0) {
    reportServerWarning("실황 수집에서 일부 격자 누락", "worker.observation", {
      baseTime: obsTimeStr,
      missingGrids,
      failedGrids: failedGridKeys.length,
      failedGridKeys: failedGridKeys.join(","),
      outagePauses,
      totalGrids: distinctGrids.length,
    });
  }

  return observationsToInsert.length;
}

export interface ForecastSyncResult {
  saved: number;
  failedGridKeys: string[];
}

// --------------------------------------------------------------------------
// 2. [단기예보 전용 수집] 3시간마다 딱 1회만 호출 (getVilageFcst만 238콜)
// gridKeys를 주면 그 격자만 다시 받는다 (실패 격자 재수집용).
// --------------------------------------------------------------------------
export async function syncForecasts(
  round = getVilageBaseDateTime(),
  gridKeys?: string[],
): Promise<ForecastSyncResult> {
  const serviceKey = requireKmaServiceKey();
  const { baseDate: fcstDate, baseTime: fcstTime } = round;
  const baseTimeStr = `${fcstDate.slice(0, 4)}-${fcstDate.slice(4, 6)}-${fcstDate.slice(6, 8)} ${fcstTime.slice(0, 2)}:00`;
  const createdAt = new Date().toISOString();
  const grids = selectGrids(gridKeys);

  console.log(
    `[단기예보 수집] 발표기준: ${baseTimeStr} (${grids.length}개 격자${gridKeys ? ", 실패 격자 재수집" : ""})`,
  );

  const { results, failed, outagePauses } = await collectGrids(
    grids,
    (grid) =>
      fetchKmaWithRetry<KmaForecastItem>(
        `${BASE_URL}/getVilageFcst?pageNo=1&numOfRows=150&dataType=JSON&base_date=${fcstDate}&base_time=${fcstTime}&nx=${grid.nx}&ny=${grid.ny}&authKey=${serviceKey}`,
        2,
        400,
      ),
    collectOptions("단기예보"),
  );
  logFailedGrids("예보", failed);
  const failedGridKeys = failed.map((f) => f.grid.gridKey);

  const forecastsToInsert: ForecastRecord[] = [];
  const forecastPopUpdates: {
    sigunguCode: string;
    pop: number;
    sky: number;
    updatedAt: string;
  }[] = [];
  let missingGrids = 0;
  let invalidPopGrids = 0;

  for (const { grid, value: result } of results) {
    if (result.kind === "no-data") {
      console.warn(
        `[예보 자료 없음] ${grid.gridKey} (${gridRegionNames(grid)}): 저장·지도 갱신 건너뜀`,
      );
      missingGrids++;
      continue;
    }

    const validForecasts = parseForecastItems(result.items);
    if (validForecasts.length === 0) {
      console.warn(
        `[예보 누락] ${grid.gridKey}: 유효한 POP 값 없음, 저장·지도 갱신 건너뜀`,
      );
      invalidPopGrids++;
      continue;
    }

    const currentPop = validForecasts[0].pop;
    const currentSky = validForecasts[0].sky;

    for (const code of grid.sigunguCodes) {
      const sigungu = sigunguMap.get(code);
      const sidoCode = sigungu?.sidoCode ?? code.slice(0, 2);
      const name = sigungu?.name ?? code;

      for (const val of validForecasts) {
        const leadHours = calculateLeadHours(baseTimeStr, val.targetTime);
        forecastsToInsert.push({
          baseTime: baseTimeStr,
          targetTime: val.targetTime,
          sigunguCode: code,
          sidoCode,
          name,
          pop: val.pop,
          leadHours,
          sky: val.sky,
          tmp: val.tmp,
          createdAt,
        });
      }

      // 최신 실황 row에 검증된 예보만 반영한다.
      forecastPopUpdates.push({
        sigunguCode: code,
        pop: currentPop,
        sky: currentSky,
        updatedAt: createdAt,
      });
    }
  }

  console.log(`\n[단기예보 저장] ${forecastsToInsert.length}건 DB 저장 완료!`);
  if (forecastsToInsert.length > 0) {
    await upsertForecastsBatch(forecastsToInsert);
    await syncAccuracyForForecastBaseTime(baseTimeStr);
    await updateLatestForecastReadModelBatch(forecastPopUpdates);
  }

  // 실패 비율은 재수집이어도 전체 격자 기준으로 본다.
  if (
    exceedsGridFailureLimit(failedGridKeys.length, distinctGrids.length) ||
    (forecastsToInsert.length === 0 && failedGridKeys.length > 0)
  ) {
    throw new GridFailureError(
      `예보 수집 실패: ${fcstDate} ${fcstTime} 격자 ${failedGridKeys.length}/${distinctGrids.length}개 요청 실패`,
      failedGridKeys,
    );
  }
  if (forecastsToInsert.length === 0) {
    throw new Error(
      `예보 수집 실패: ${fcstDate} ${fcstTime}의 모든 격자에 유효한 자료가 없습니다.`,
    );
  }

  if (
    missingGrids > 0 ||
    invalidPopGrids > 0 ||
    failedGridKeys.length > 0 ||
    outagePauses > 0
  ) {
    reportServerWarning("예보 수집에서 일부 격자 누락", "worker.forecast", {
      baseTime: baseTimeStr,
      missingGrids,
      invalidPopGrids,
      failedGrids: failedGridKeys.length,
      failedGridKeys: failedGridKeys.join(","),
      outagePauses,
      totalGrids: distinctGrids.length,
      requestedGrids: grids.length,
    });
  }

  return { saved: forecastsToInsert.length, failedGridKeys };
}
