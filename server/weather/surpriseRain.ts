import type {
  SurpriseRainResponse,
  SurpriseRainSido,
} from "../../shared/weather.ts";

// 예보 강수확률이 이 값 이하였는데 비가 관측된 시간을 '아니 땐 비'로 센다.
export const SURPRISE_MAX_POP = 20;
// 지도는 관측된 비를 모두 세고, 이 값 이상은 체감되는 비로 따로 강조한다.
export const SURPRISE_HEAVY_MM = 1;
// 시군구 카드에는 최근 사례만 보여준다.
const MAX_EVENTS_PER_REGION = 30;

export interface SurpriseRainRow {
  time: string;
  sigunguCode: string;
  sidoCode: string;
  name: string;
  pop: number;
  rn1: number;
}

// rows는 최신 시각부터 정렬되어 있어야 한다.
export function assembleSurpriseRainResponse(
  range: { since: string | null; until: string | null },
  rows: readonly SurpriseRainRow[],
): SurpriseRainResponse {
  const response: SurpriseRainResponse = {
    maxPop: SURPRISE_MAX_POP,
    heavyMm: SURPRISE_HEAVY_MM,
    since: range.since,
    until: range.until,
    count: 0,
    heavyCount: 0,
    regions: {},
    sidos: {},
  };

  for (const row of rows) {
    const heavy = row.rn1 >= SURPRISE_HEAVY_MM ? 1 : 0;
    response.count += 1;
    response.heavyCount += heavy;

    let region = response.regions[row.sigunguCode];
    if (!region) {
      region = {
        sidoCode: row.sidoCode,
        name: row.name,
        count: 0,
        heavyCount: 0,
        events: [],
      };
      response.regions[row.sigunguCode] = region;
      const sido: SurpriseRainSido = (response.sidos[row.sidoCode] ??= {
        count: 0,
        heavyCount: 0,
        regionCount: 0,
      });
      sido.regionCount += 1;
    }
    region.count += 1;
    region.heavyCount += heavy;
    if (region.events.length < MAX_EVENTS_PER_REGION) {
      region.events.push({ time: row.time, pop: row.pop, rn1: row.rn1 });
    }

    const sido = response.sidos[row.sidoCode];
    sido.count += 1;
    sido.heavyCount += heavy;
  }

  return response;
}
