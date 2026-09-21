export function getNcstBaseDateTime(d = new Date()) {
  const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  let hours = kst.getUTCHours();
  const minutes = kst.getUTCMinutes();

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

export function calculateLeadHours(baseStr: string, targetStr: string): number {
  const parseTime = (str: string) => {
    const [d, t] = str.split(" ");
    const [year, mon, day] = d.split("-").map(Number);
    const [hour, min] = t.split(":").map(Number);
    return new Date(Date.UTC(year, mon - 1, day, hour, min)).getTime();
  };
  const diffMs = parseTime(targetStr) - parseTime(baseStr);
  return Math.max(0, Math.round(diffMs / (1000 * 60 * 60)));
}
