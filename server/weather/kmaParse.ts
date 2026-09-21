export interface KmaObservationItem {
  category: string;
  obsrValue: string;
}

export interface KmaForecastItem {
  category: string;
  fcstDate: string;
  fcstTime: string;
  fcstValue: string;
}

function parseKmaNumber(val: number): number | null {
  return Number.isNaN(val) || val <= -900 || val >= 900 ? null : val;
}

function parsePty(val: number): number {
  if (val === 1 || val === 5) return 1;
  if (val === 2 || val === 6) return 2;
  if (val === 3 || val === 7) return 3;
  return 0;
}

export function parseObservationItems(items: KmaObservationItem[]) {
  let pty = 0;
  let rn1 = 0;
  let tmp: number | null = null;

  for (const item of items) {
    const val = parseFloat(item.obsrValue);
    if (item.category === "PTY") {
      pty = parsePty(val);
    } else if (item.category === "RN1") {
      rn1 = parseKmaNumber(val) ?? 0;
    } else if (item.category === "T1H") {
      tmp = parseKmaNumber(val);
    }
  }

  return { pty, rn1, tmp, isRaining: pty > 0 || rn1 > 0 ? 1 : 0 };
}

export interface ParsedForecast {
  targetTime: string;
  pop: number;
  sky: number;
  tmp: number | null;
}

export function parseForecastItems(items: KmaForecastItem[]): ParsedForecast[] {
  const targetMap = new Map<
    string,
    { pop: number | null; sky: number; tmp: number | null }
  >();

  for (const item of items) {
    const fDate = item.fcstDate;
    const fTime = item.fcstTime;
    const targetTime = `${fDate.slice(0, 4)}-${fDate.slice(4, 6)}-${fDate.slice(6, 8)} ${fTime.slice(0, 2)}:00`;

    if (!targetMap.has(targetTime)) {
      targetMap.set(targetTime, { pop: null, sky: 1, tmp: null });
    }
    const currentEntry = targetMap.get(targetTime)!;

    if (item.category === "POP") {
      const pop = Number(item.fcstValue);
      currentEntry.pop = item.fcstValue.trim() !== "" &&
        Number.isInteger(pop) && pop >= 0 && pop <= 100 ? pop : null;
    } else if (item.category === "SKY") {
      currentEntry.sky = parseInt(item.fcstValue, 10);
    } else if (item.category === "TMP") {
      currentEntry.tmp = parseKmaNumber(parseFloat(item.fcstValue));
    }
  }

  return [...targetMap.entries()].flatMap(([targetTime, val]) =>
    val.pop === null ? [] : [{ targetTime, pop: val.pop, sky: val.sky, tmp: val.tmp }]
  );
}
