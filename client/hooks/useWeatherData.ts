import { useEffect, useState } from "react";
import {
  loadWeatherSnapshot,
  type WeatherSnapshot,
} from "../api/weather";

interface WeatherDataState extends WeatherSnapshot {
  errorMessage: string;
}

const EMPTY_WEATHER_SNAPSHOT: WeatherSnapshot = {
  weatherMap: {},
  sidoStatsMap: {},
  weatherTime: "",
};

export function useWeatherData(): WeatherDataState {
  const [weatherSnapshot, setWeatherSnapshot] = useState<WeatherSnapshot>(
    EMPTY_WEATHER_SNAPSHOT,
  );
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let isEffectActive = true;

    let isRefreshing = false;
    async function refresh() {
      if (!isEffectActive || isRefreshing) return;
      isRefreshing = true;
      try {
        const loadedSnapshot = await loadWeatherSnapshot();
        if (isEffectActive) {
          setWeatherSnapshot(loadedSnapshot);
          setErrorMessage("");
        }
      } catch (reason: unknown) {
        if (isEffectActive) {
          setErrorMessage(reason instanceof Error ? reason.message : String(reason));
        }
      } finally {
        isRefreshing = false;
      }
    }

    void refresh();
    // 매시간 들어오는 실황을 열린 화면에도 반영한다.
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, 60_000);
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      isEffectActive = false;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  return { ...weatherSnapshot, errorMessage };
}
