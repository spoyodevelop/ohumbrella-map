import dotenv from "dotenv";
import { resolve } from "node:path";
import { distinctGrids, sigunguMap, type DistinctGrid } from "./gridMap.ts";
import {
  upsertObservationsBatch,
  upsertForecastsBatch,
  upsertWeatherBatch,
  type ObservationRecord,
  type ForecastRecord,
  type WeatherRecord,
} from "./queries.ts";

dotenv.config({ path: resolve(process.cwd(), ".env.local") });

const BASE_URL =
  "https://apihub.kma.go.kr/api/typ02/openApi/VilageFcstInfoService_2.0";

const SERVICE_KEY = process.env.KMA_SERVICE_KEY || "bYThO5gPTpyE4TuYDw6cbg";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchKmaWithRetry(
  url: string,
  maxTries = 3,
  initialDelay = 400,
): Promise<any[]> {
  let delay = initialDelay;
  let lastErrMsg = "";

  for (let tries = 1; tries <= maxTries; tries++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (!res.ok) {
        throw new Error(`HTTP Error ${res.status}`);
      }
      const data = await res.json();
      const header = data?.response?.header;
      if (!header) {
        throw new Error("응답 헤더 없음");
      }

      const code = header.resultCode;

      // 00: 정상 응답 -> 데이터 반환
      if (code === "00") {
        return data.response.body?.items?.item ?? [];
      }

      // 03: NODATA_ERROR - 데이터가 아직 없거나 관측값 없음 (정상 대기 상태, 재시도 없이 즉시 소모)
      if (code === "03") {
        return [];
      }

      // 그 외 00이 아닌 모든 코드는 에러로 간주하여 catch에서 재시도 진행
      throw new Error(`[${code}] ${header.resultMsg}`);
    } catch (err: any) {
      lastErrMsg = err?.message || String(err);
      if (tries < maxTries) {
        await sleep(delay);
        delay *= 2;
      }
    }
  }

  // ⚠️ maxTries까지 끝까지 재시도했음에도 실패한 경우:
  // 에러를 밖으로 던지지 않고 그 자리에서 소모하여 빈 배열([]) 반환
  console.warn(`[KMA 재시도 실패 / 에러 소모] 최종 실패 (${lastErrMsg}) -> [] 반환`);
  return [];
}

export function getNcstBaseDateTime(d = new Date()) {
  const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  let hours = kst.getUTCHours();
  let minutes = kst.getUTCMinutes();

  // 초단기실황: 매시 30분 생성, 40분 이후 API 제공
  // 따라서 40분 이전에는 직전 시간대 정시 데이터가 최신
  if (minutes < 40) {
    hours -= 1;
    if (hours < 0) {
      hours = 23;
      kst.setUTCDate(kst.getUTCDate() - 1);
    }
  }

  const baseDate =
    kst.getUTCFullYear() +
    String(kst.getUTCMonth() + 1).padStart(2, "0") +
    String(kst.getUTCDate()).padStart(2, "0");
  const baseTime = String(hours).padStart(2, "0") + "00";

  return { baseDate, baseTime };
}

export function getVilageBaseDateTime(d = new Date()) {
  const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  const hours = kst.getUTCHours();
  const minutes = kst.getUTCMinutes();

  const baseHours = [2, 5, 8, 11, 14, 17, 20, 23];
  let selectedHour = 23;
  let dayOffset = 0;

  if (hours < 2 || (hours === 2 && minutes < 15)) {
    selectedHour = 23;
    dayOffset = -1;
  } else {
    for (let i = baseHours.length - 1; i >= 0; i--) {
      const bh = baseHours[i];
      if (hours > bh || (hours === bh && minutes >= 15)) {
        selectedHour = bh;
        break;
      }
    }
  }

  if (dayOffset < 0) {
    kst.setUTCDate(kst.getUTCDate() - 1);
  }

  const baseDate =
    kst.getUTCFullYear() +
    String(kst.getUTCMonth() + 1).padStart(2, "0") +
    String(kst.getUTCDate()).padStart(2, "0");
  const baseTime = String(selectedHour).padStart(2, "0") + "00";

  return { baseDate, baseTime };
}

function calculateLeadHours(baseStr: string, targetStr: string): number {
  const parseTime = (str: string) => {
    const [d, t] = str.split(" ");
    const [year, mon, day] = d.split("-").map(Number);
    const [hour, min] = t.split(":").map(Number);
    return new Date(Date.UTC(year, mon - 1, day, hour, min)).getTime();
  };
  const diffMs = parseTime(targetStr) - parseTime(baseStr);
  return Math.max(0, Math.round(diffMs / (1000 * 60 * 60)));
}

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

  // 재시도 2회 수행 후 실패해도 그 자리에서 []로 소모되므로 try-catch 불필요
  const items = await fetchKmaWithRetry(url, 2, 300);
  if (items.length > 0) {
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
  const hourlyToInsert: WeatherRecord[] = [];
  const chunkSize = 12;

  for (let i = 0; i < distinctGrids.length; i += chunkSize) {
    const chunk = distinctGrids.slice(i, i + chunkSize);

    const chunkResults = await Promise.all(
      chunk.map(async (grid: DistinctGrid) => {
        let pty = 0;
        let rn1 = 0;
        let tmp: number | null = null;

        const ncstUrl = `${BASE_URL}/getUltraSrtNcst?pageNo=1&numOfRows=10&dataType=JSON&base_date=${ncstDate}&base_time=${ncstTime}&nx=${grid.nx}&ny=${grid.ny}&authKey=${SERVICE_KEY}`;
        // 끝까지 재시도하고 안 되면 []로 소모되어 반환됨
        const items = await fetchKmaWithRetry(ncstUrl, 3, 400);
        for (const item of items) {
          const val = parseFloat(item.obsrValue);
          if (item.category === "PTY") {
            if (val === 1 || val === 5) pty = 1;
            else if (val === 2 || val === 6) pty = 2;
            else if (val === 3 || val === 7) pty = 3;
            else pty = 0;
          } else if (item.category === "RN1") {
            rn1 = isNaN(val) || val <= -900 || val >= 900 ? 0 : val;
          } else if (item.category === "T1H") {
            tmp = isNaN(val) || val <= -900 || val >= 900 ? null : val;
          }
        }

        const isRaining = pty > 0 || rn1 > 0 ? 1 : 0;

        const obsList: ObservationRecord[] = [];
        const hourList: WeatherRecord[] = [];

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
  upsertObservationsBatch(observationsToInsert);
  upsertWeatherBatch(hourlyToInsert);

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
  const hourlyToInsert: WeatherRecord[] = [];
  const chunkSize = 12;

  for (let i = 0; i < distinctGrids.length; i += chunkSize) {
    const chunk = distinctGrids.slice(i, i + chunkSize);

    const chunkResults = await Promise.all(
      chunk.map(async (grid: DistinctGrid) => {
        const targetMap = new Map<
          string,
          { pop: number; sky: number; tmp: number | null }
        >();

        const fcstUrl = `${BASE_URL}/getVilageFcst?pageNo=1&numOfRows=150&dataType=JSON&base_date=${fcstDate}&base_time=${fcstTime}&nx=${grid.nx}&ny=${grid.ny}&authKey=${SERVICE_KEY}`;
        // 끝까지 재시도하고 안 되면 []로 소모되어 반환됨
        const items = await fetchKmaWithRetry(fcstUrl, 2, 400);
        for (const item of items) {
          const fDate = item.fcstDate;
          const fTime = item.fcstTime;
          const targetTimeStr = `${fDate.slice(0, 4)}-${fDate.slice(4, 6)}-${fDate.slice(6, 8)} ${fTime.slice(0, 2)}:00`;

          if (!targetMap.has(targetTimeStr)) {
            targetMap.set(targetTimeStr, { pop: 0, sky: 1, tmp: null });
          }
          const currentEntry = targetMap.get(targetTimeStr)!;

          if (item.category === "POP") {
            currentEntry.pop = parseInt(item.fcstValue, 10);
          } else if (item.category === "SKY") {
            currentEntry.sky = parseInt(item.fcstValue, 10);
          } else if (item.category === "TMP") {
            const val = parseFloat(item.fcstValue);
            currentEntry.tmp = isNaN(val) || val <= -900 || val >= 900 ? null : val;
          }
        }

        const fcstList: ForecastRecord[] = [];
        const hourList: WeatherRecord[] = [];

        const firstFcst = targetMap.values().next().value;
        const currentPop = firstFcst ? firstFcst.pop : 20;
        const currentSky = firstFcst ? firstFcst.sky : 1;

        for (const code of grid.sigunguCodes) {
          const sigungu = sigunguMap.get(code);
          const sidoCode = sigungu?.sidoCode ?? code.slice(0, 2);
          const name = sigungu?.name ?? code;

          for (const [targetTimeStr, val] of targetMap.entries()) {
            const leadHours = calculateLeadHours(baseTimeStr, targetTimeStr);
            fcstList.push({
              baseTime: baseTimeStr,
              targetTime: targetTimeStr,
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

          // 지도 렌더링용 POP 업데이트
          hourList.push({
            time: baseTimeStr,
            sidoCode,
            sigunguCode: code,
            name,
            pop: currentPop,
            pty: 0,
            rn1: 0,
            tmp: null,
            sky: currentSky,
            updatedAt: createdAt,
          });
        }

        return { fcstList, hourList };
      }),
    );

    for (const res of chunkResults) {
      forecastsToInsert.push(...res.fcstList);
      hourlyToInsert.push(...res.hourList);
    }

    process.stdout.write(
      `\r[단기예보 진행] ${Math.min(i + chunkSize, distinctGrids.length)} / ${distinctGrids.length} 격자 완료...`,
    );
    await sleep(150);
  }

  console.log(`\n[단기예보 저장] ${forecastsToInsert.length}건 DB 저장 완료!`);
  upsertForecastsBatch(forecastsToInsert);
  upsertWeatherBatch(hourlyToInsert);

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
