import { useState } from "react";
import { TRAVEL_HOURS, type CommuteSettings } from "../../shared/commute";
const KEY = "ohumbrella.commute.v1";
export const DEFAULT_SETTINGS: CommuteSettings = {
  version: 1,
  home: null,
  work: null,
  homeHour: 8,
  workHour: 18,
  travelHours: 1,
};
// Earlier builds allowed 24 for end-of-day midnight; it is the next day's 00시 now.
const normalizeHour = (h: number) => (h === 24 ? 0 : h);
function load(): CommuteSettings {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) ?? "null");
    if (
      s?.version !== 1 ||
      ![s.homeHour, s.workHour].every(
        (h) => Number.isInteger(h) && h >= 0 && h <= 24,
      )
    )
      return DEFAULT_SETTINGS;
    if (
      ![s.home, s.work].every(
        (p) =>
          p === null ||
          (typeof p?.code === "string" &&
            /^\d{5}$/.test(p.code) &&
            typeof p.name === "string"),
      )
    )
      return DEFAULT_SETTINGS;
    return {
      ...s,
      homeHour: normalizeHour(s.homeHour),
      workHour: normalizeHour(s.workHour),
      // Settings saved before travel time existed fall back to the default.
      travelHours: TRAVEL_HOURS.includes(s.travelHours)
        ? s.travelHours
        : DEFAULT_SETTINGS.travelHours,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}
export function useCommuteSettings() {
  const [saved, setSaved] = useState(load);
  const [draft, setDraft] = useState(saved);
  const [storageError, setStorageError] = useState("");
  function save() {
    setSaved({ ...draft });
    try {
      localStorage.setItem(KEY, JSON.stringify(draft));
      setStorageError("");
    } catch {
      setStorageError(
        "이 기기에 저장하지 못했어요. 현재 화면에서는 확인할 수 있어요.",
      );
    }
  }
  return { saved, draft, setDraft, save, storageError };
}
