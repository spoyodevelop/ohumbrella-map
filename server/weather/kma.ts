import dotenv from "dotenv";
import { resolve } from "node:path";
import { distinctGrids, sigunguMap, type DistinctGrid } from "./gridMap.ts";
import { calculateLeadHours, getNcstBaseDateTime, getVilageBaseDateTime } from "./kmaTime.ts";
import { parseForecastItems, parseObservationItems, type KmaForecastItem, type KmaObservationItem } from "./kmaParse.ts";
import { fetchKmaWithRetry, type KmaFetchResult } from "./kmaClient.ts";
import {
  upsertObservationsBatch,
  upsertWeatherBatch,
  upsertForecastsBatch,
  updateForecastPopBatch,
  type ObservationRecord,
  type ForecastRecord,
  type HourlyWeatherWriteRecord,
} from "./write.ts";
import {
  syncAccuracyForObservationTime,
  syncAccuracyForForecastBaseTime,
} from "../verification/sync.ts";

dotenv.config({ path: resolve(process.cwd(), ".env.local") });
dotenv.config({ path: resolve(process.cwd(), ".env") });

const BASE_URL =
  "https://apihub.kma.go.kr/api/typ02/openApi/VilageFcstInfoService_2.0";

const SERVICE_KEY = process.env.KMA_SERVICE_KEY || "bYThO5gPTpyE4TuYDw6cbg";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// 카나리 방식으로 찔러보는 용도
// 매시 40분 이후 정시 데이터가 열렸는지 1개 격자만 확인
export async function checkCanaryNcstUpdated(lastKnownBaseTime: string) {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const currentHour = kst.getUTCHours();
  const baseDate =
    kst.getUTCFullYear() +
    String(kst.getUTCMonth() + 1).padStart(2, "0") +
    String(kst.getUTCDate()).padStart(2, "0");
  const candidateBaseTime = String(currentHour).padStart(2, "0") + "00";

  if (candidateBaseTime === lastKnownBaseTime) {
    return { updated: false, baseDate, baseTime: candidateBaseTime };
  }

  const url = `${BASE_URL}/getUltraSrtNcst?pageNo=1&numOfRows=10&dataType=JSON&base_date=${baseDate}&base_time=${candidateBaseTime}&nx=60&ny=127&authKey=${SERVICE_KEY}`;

  const result = await fetchKmaWithRetry<KmaObservationItem>(url, 2, 300);
  if (result.kind === "items") {
    console.log(
      `[카나리 감지] 종로구에 실황 오픈 (${baseDate} ${candidateBaseTime})`,
    );
    return { updated: true, baseDate, baseTime: candidateBaseTime };
  }

  return { updated: false, baseDate, baseTime: candidateBaseTime };
}

// --------------------------------------------------------------------------
// 1. [실황 전용 수집] 1시간마다 1회만 호출 (getUltraSrtNcst만 238콜)
// --------------------------------------------------------------------------
export async function syncObservations(): Promise<number> {
  const { baseDate: ncstDate, baseTime: ncstTime } = getNcstBaseDateTime();
  const obsTimeStr = `${ncstDate.slice(0, 4)}-${ncstDate.slice(4, 6)}-${ncstDate.slice(6, 8)} ${ncstTime.slice(0, 2)}:00`;
  const createdAt = new Date().toISOString();

  console.log(`[실황 수집] 관측기준: ${obsTimeStr} (238개 격자)`);

  const observationsToInsert: ObservationRecord[] = [];
  const hourlyToInsert: HourlyWeatherWriteRecord[] = [];
  const chunkSize = 12;

  for (let i = 0; i < distinctGrids.length; i += chunkSize) {
    const chunk = distinctGrids.slice(i, i + chunkSize);

    const chunkResults = await Promise.all(
      chunk.map(async (grid: DistinctGrid) => {
        const ncstUrl = `${BASE_URL}/getUltraSrtNcst?pageNo=1&numOfRows=10&dataType=JSON&base_date=${ncstDate}&base_time=${ncstTime}&nx=${grid.nx}&ny=${grid.ny}&authKey=${SERVICE_KEY}`;
        let result: KmaFetchResult<KmaObservationItem>;
        try {
          result = await fetchKmaWithRetry<KmaObservationItem>(ncstUrl, 3, 400);
        } catch (error) {
          throw new Error(`실황 격자 ${grid.gridKey} 요청 실패`, { cause: error });
        }
        if (result.kind === "no-data") {
          console.warn(`[실황 자료 없음] ${grid.gridKey}: 저장 건너뜀`);
          return { obsList: [], hourList: [] };
        }

        const { pty, rn1, tmp, isRaining } = parseObservationItems(result.items);

        const obsList: ObservationRecord[] = [];
        const hourList: HourlyWeatherWriteRecord[] = [];

        for (const code of grid.sigunguCodes) {
          const sigungu = sigunguMap.get(code);
          const sidoCode = sigungu?.sidoCode ?? code.slice(0, 2);
          const name = sigungu?.name ?? code;

          obsList.push({
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
          hourList.push({
            time: obsTimeStr,
            sidoCode,
            sigunguCode: code,
            name,
            pop: null, // 기존 POP 보존(COALESCE)
            pty,
            rn1,
            tmp,
            sky: 1,
            updatedAt: createdAt,
          });
        }

        return { obsList, hourList };
      }),
    );

    for (const res of chunkResults) {
      observationsToInsert.push(...res.obsList);
      hourlyToInsert.push(...res.hourList);
    }

    process.stdout.write(
      `\r[실황 진행] ${Math.min(i + chunkSize, distinctGrids.length)} / ${distinctGrids.length} 격자 완료...`,
    );
    await sleep(150);
  }

  console.log(`\n[실황 저장] ${observationsToInsert.length}건 DB 저장 완료!`);
  if (observationsToInsert.length === 0) return 0;

  await upsertObservationsBatch(observationsToInsert);
  await upsertWeatherBatch(hourlyToInsert);
  // 이 관측 시각에 매칭되는 예보들로 정확도 집계 누적
  await syncAccuracyForObservationTime(obsTimeStr);

  return observationsToInsert.length;
}

// --------------------------------------------------------------------------
// 2. [단기예보 전용 수집] 3시간마다 딱 1회만 호출 (getVilageFcst만 238콜)
// --------------------------------------------------------------------------
export async function syncForecasts(): Promise<number> {
  const { baseDate: fcstDate, baseTime: fcstTime } = getVilageBaseDateTime();
  const baseTimeStr = `${fcstDate.slice(0, 4)}-${fcstDate.slice(4, 6)}-${fcstDate.slice(6, 8)} ${fcstTime.slice(0, 2)}:00`;
  const createdAt = new Date().toISOString();

  console.log(`[단기예보 수집] 발표기준: ${baseTimeStr} (238개 격자)`);

  const forecastsToInsert: ForecastRecord[] = [];
  const forecastPopUpdates: { sigunguCode: string; pop: number; sky: number; updatedAt: string }[] = [];
  const chunkSize = 12;

  for (let i = 0; i < distinctGrids.length; i += chunkSize) {
    const chunk = distinctGrids.slice(i, i + chunkSize);

    const chunkResults = await Promise.all(
      chunk.map(async (grid: DistinctGrid) => {
        const fcstUrl = `${BASE_URL}/getVilageFcst?pageNo=1&numOfRows=150&dataType=JSON&base_date=${fcstDate}&base_time=${fcstTime}&nx=${grid.nx}&ny=${grid.ny}&authKey=${SERVICE_KEY}`;
        let result: KmaFetchResult<KmaForecastItem>;
        try {
          result = await fetchKmaWithRetry<KmaForecastItem>(fcstUrl, 2, 400);
        } catch (error) {
          throw new Error(`예보 격자 ${grid.gridKey} 요청 실패`, { cause: error });
        }
        if (result.kind === "no-data") {
          console.warn(`[예보 자료 없음] ${grid.gridKey}: 저장·지도 갱신 건너뜀`);
          return { fcstList: [] as ForecastRecord[], popUpdates: [] };
        }

        const fcstList: ForecastRecord[] = [];
        const popUpdates: { sigunguCode: string; pop: number; sky: number; updatedAt: string }[] = [];
        const validForecasts = parseForecastItems(result.items);
        if (validForecasts.length === 0) {
          console.warn(`[예보 누락] ${grid.gridKey}: 유효한 POP 값 없음, 저장·지도 갱신 건너뜀`);
          return { fcstList, popUpdates };
        }

        const currentPop = validForecasts[0].pop;
        const currentSky = validForecasts[0].sky;

        for (const code of grid.sigunguCodes) {
          const sigungu = sigunguMap.get(code);
          const sidoCode = sigungu?.sidoCode ?? code.slice(0, 2);
          const name = sigungu?.name ?? code;

          for (const val of validForecasts) {
            const leadHours = calculateLeadHours(baseTimeStr, val.targetTime);
            fcstList.push({
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
          popUpdates.push({
            sigunguCode: code,
            pop: currentPop,
            sky: currentSky,
            updatedAt: createdAt,
          });
        }

        return { fcstList, popUpdates };
      }),
    );

    for (const res of chunkResults) {
      forecastsToInsert.push(...res.fcstList);
      forecastPopUpdates.push(...res.popUpdates);
    }

    process.stdout.write(
      `\r[단기예보 진행] ${Math.min(i + chunkSize, distinctGrids.length)} / ${distinctGrids.length} 격자 완료...`,
    );
    await sleep(150);
  }

  console.log(`\n[단기예보 저장] ${forecastsToInsert.length}건 DB 저장 완료!`);
  await upsertForecastsBatch(forecastsToInsert);
  await syncAccuracyForForecastBaseTime(baseTimeStr);
  await updateForecastPopBatch(forecastPopUpdates);

  return forecastsToInsert.length;
}

// 초기화 또는 전체 수동 동기화용 함수
export async function syncAllWeather(): Promise<{
  obsCount: number;
  fcstCount: number;
}> {
  console.log(`[전체 동기화] 실황 및 단기예보 순차 실행...`);
  const obsCount = await syncObservations();
  const fcstCount = await syncForecasts();
  return { obsCount, fcstCount };
}
