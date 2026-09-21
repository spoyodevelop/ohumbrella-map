import { db } from "../db.ts";
import { upsertAccuracyForForecastBaseTime, upsertAccuracyForObservationTime } from "./accuracy.ts";
import { latestKnownPopForH } from "../weather/sql.ts";

// 5. 실황 sync 후 정해진 발표 회차 한 건만 관측 시각·지역별로 검증한다.
export async function syncAccuracyForObservationTime(observationTime: string) {
  await upsertAccuracyForObservationTime(db, observationTime);
}

export async function syncAccuracyForForecastBaseTime(baseTime: string) {
  await upsertAccuracyForForecastBaseTime(db, baseTime);
}

// 기상청 예보 확률별 실제 강수 확률 (Empirical Rain Probability)
export async function getEmpiricalProbabilityStats(
  minLeadHours = 1,
  maxLeadHours = 12,
) {
  const res = await db.execute({
    sql: `
      SELECT
        predicted_pop as predictedPop,
        COUNT(*) as totalForecasts,
        SUM(actual_rain) as actualRainedCount,
        ROUND(100.0 * SUM(actual_rain) / COUNT(*), 1) as empiricalRainRate
      FROM forecast_verifications
      WHERE actual_rain IS NOT NULL
        AND lead_hours BETWEEN ? AND ?
      GROUP BY predicted_pop
      ORDER BY predicted_pop ASC
    `,
    args: [minLeadHours, maxLeadHours],
  });

  return res.rows;
}

// 특정 지역 & 강수확률(POP) 기준 실측/경험적 강수 확률 및 현재 현황 조회
export interface RegionProbabilityInsight {
  code: string;
  name: string;
  sidoCode: string;
  current: {
    time: string | null;
    kmaPop: number | null;
    isRaining: number;
    pty: number;
    rn1: number;
    tmp: number | null;
    sky: number;
  } | null;
  empirical: {
    targetPop: number;
    actualRainRate: number | null;
    sampleCount: number;
    sidoRainRate: number | null;
    sidoSampleCount: number;
    nationalRainRate: number | null;
    nationalSampleCount: number;
  };
}

export async function getRegionProbabilityInsight(
  sigunguCode: string,
  targetPop?: number,
): Promise<RegionProbabilityInsight | null> {
  const currentRes = await db.execute({
    sql: `
      SELECT
        time,
        sido_code as sidoCode,
        sigungu_code as sigunguCode,
        name,
        ${latestKnownPopForH} as kmaPop,
        pty,
        rn1,
        tmp,
        sky
      FROM hourly_weather h
      WHERE h.sigungu_code = ?
      ORDER BY h.time DESC
      LIMIT 1
    `,
    args: [sigunguCode],
  });

  const current = currentRes.rows[0] as unknown as
    | {
        time: string;
        sidoCode: string;
        sigunguCode: string;
        name: string;
        kmaPop: number | null;
        pty: number;
        rn1: number;
        tmp: number | null;
        sky: number;
      }
    | undefined;

  if (!current) {
    return null;
  }

  const sidoCode = current.sidoCode;
  const sigunguName = current.name;
  const popToQuery = targetPop ?? current.kmaPop ?? 30;

  const [localRes, sidoRes, nationalRes] = await Promise.all([
    db.execute({
      sql: `
        SELECT
          COUNT(*) as sampleCount,
          ROUND(100.0 * SUM(actual_rain) / COUNT(*), 1) as actualRainRate
        FROM forecast_verifications
        WHERE sigungu_code = ? AND predicted_pop = ? AND actual_rain IS NOT NULL
      `,
      args: [sigunguCode, popToQuery],
    }),
    db.execute({
      sql: `
        SELECT
          COUNT(*) as sidoSampleCount,
          ROUND(100.0 * SUM(actual_rain) / COUNT(*), 1) as sidoRainRate
        FROM forecast_verifications
        WHERE sido_code = ? AND predicted_pop = ? AND actual_rain IS NOT NULL
      `,
      args: [sidoCode, popToQuery],
    }),
    db.execute({
      sql: `
        SELECT
          COUNT(*) as nationalSampleCount,
          ROUND(100.0 * SUM(actual_rain) / COUNT(*), 1) as nationalRainRate
        FROM forecast_verifications
        WHERE predicted_pop = ? AND actual_rain IS NOT NULL
      `,
      args: [popToQuery],
    }),
  ]);

  const localRow = localRes.rows[0] as unknown as {
    sampleCount: number;
    actualRainRate: number | null;
  };
  const sidoRow = sidoRes.rows[0] as unknown as {
    sidoSampleCount: number;
    sidoRainRate: number | null;
  };
  const nationalRow = nationalRes.rows[0] as unknown as {
    nationalSampleCount: number;
    nationalRainRate: number | null;
  };

  const isRaining = current.pty > 0 || current.rn1 > 0 ? 1 : 0;

  return {
    code: sigunguCode,
    name: sigunguName,
    sidoCode,
    current: {
      time: current.time,
      kmaPop: current.kmaPop,
      isRaining,
      pty: current.pty,
      rn1: current.rn1,
      tmp: current.tmp,
      sky: current.sky,
    },
    empirical: {
      targetPop: popToQuery,
      actualRainRate: localRow?.actualRainRate ?? null,
      sampleCount: Number(localRow?.sampleCount ?? 0),
      sidoRainRate: sidoRow?.sidoRainRate ?? null,
      sidoSampleCount: Number(sidoRow?.sidoSampleCount ?? 0),
      nationalRainRate: nationalRow?.nationalRainRate ?? null,
      nationalSampleCount: Number(nationalRow?.nationalSampleCount ?? 0),
    },
  };
}
