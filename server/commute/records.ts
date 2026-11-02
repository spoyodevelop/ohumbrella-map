import type { PopRecord } from "../../shared/commute.ts";

export type LoadRecords = (
  codes: string[],
) => Promise<Record<string, PopRecord[]>>;

// The database is imported lazily so forecasts keep working without it.
export const loadRecords: LoadRecords = async (codes) => {
  const { db } = await import("../db.ts");
  const res = await db.execute({
    sql: `
      SELECT
        sigungu_code AS code,
        predicted_pop AS pop,
        rain_count AS rainCount,
        total_count AS samples
      FROM verified_accuracy_stats
      WHERE total_count > 0
        AND sigungu_code IN (${codes.map(() => "?").join(", ")})
      ORDER BY predicted_pop ASC
    `,
    args: codes,
  });
  const byCode: Record<string, PopRecord[]> = Object.fromEntries(
    codes.map((code) => [code, []]),
  );
  for (const row of res.rows) {
    byCode[String(row.code)].push({
      pop: Number(row.pop),
      rainCount: Number(row.rainCount),
      samples: Number(row.samples),
    });
  }
  return byCode;
};
