import { useEffect, useState } from "react";
import type { CommuteResponse, CommuteSettings } from "../../shared/commute";
import { loadCommuteForecast } from "../api/commute";

interface Result {
  settings: CommuteSettings;
  data: CommuteResponse | null;
  error: string;
}

export function useCommuteForecast(settings: CommuteSettings) {
  const [result, setResult] = useState<Result | null>(null);
  const ready = Boolean(settings.home && settings.work);

  useEffect(() => {
    if (!ready) return;
    let active = true;
    const controller = new AbortController();
    loadCommuteForecast(settings, controller.signal)
      .then((data) => {
        if (active) setResult({ settings, data, error: "" });
      })
      .catch(() => {
        if (active)
          setResult({
            settings,
            data: null,
            error: "예보를 가져오지 못했어요. 다시 확인해주세요.",
          });
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [settings, ready]);

  const current = result?.settings === settings ? result : null;
  return {
    data: ready ? (current?.data ?? null) : null,
    loading: ready && !current,
    error: current?.error ?? "",
  };
}
