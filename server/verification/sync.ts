import { db } from "../db.ts";
import { upsertAccuracyForForecastBaseTime, upsertAccuracyForObservationTime } from "./accuracy.ts";

// 실황 sync 후 정해진 발표 회차 한 건만 관측 시각·지역별로 검증한다.
export async function syncAccuracyForObservationTime(observationTime: string) {
  await upsertAccuracyForObservationTime(db, observationTime);
}

export async function syncAccuracyForForecastBaseTime(baseTime: string) {
  await upsertAccuracyForForecastBaseTime(db, baseTime);
}
