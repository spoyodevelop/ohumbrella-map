// 서버 시각("YYYY-MM-DD HH:MM")은 모두 한국 시간이라 시간대 표기 없이 읽기 쉬운 말로 바꾼다.

function hourLabel(hour: number): string {
  if (hour === 0) return "밤 12시";
  if (hour < 6) return `새벽 ${hour}시`;
  if (hour < 12) return `오전 ${hour}시`;
  if (hour === 12) return "낮 12시";
  return `오후 ${hour - 12}시`;
}

// "2026-11-03" → "11월 3일"
export function formatDay(time: string, showYear = false): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(time);
  return match
    ? `${showYear ? `${match[1]}년 ` : ""}${Number(match[2])}월 ${Number(match[3])}일`
    : time;
}

// "2026-11-03 09:00" → "11월 3일 오전 9시"
export function formatHour(time: string, showYear = false): string {
  const match = /^\d{4}-\d{2}-\d{2} (\d{2})/.exec(time);
  return match
    ? `${formatDay(time, showYear)} ${hourLabel(Number(match[1]))}`
    : time;
}

// 연도가 바뀌는 기간만 연도를 붙인다. "9월 13일~11월 3일"
export function formatPeriod(since: string, until: string): string {
  const showYear = since.slice(0, 4) !== until.slice(0, 4);
  return `${formatDay(since, showYear)}~${formatDay(until, showYear)}`;
}
