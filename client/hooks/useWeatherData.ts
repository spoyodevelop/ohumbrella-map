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

    loadWeatherSnapshot()
      .then((loadedSnapshot) => {
        if (isEffectActive) setWeatherSnapshot(loadedSnapshot);
      })
      .catch((reason: unknown) => {
        if (isEffectActive) {
          setErrorMessage(
            reason instanceof Error ? reason.message : String(reason),
          );
        }
      });

    return () => {
      isEffectActive = false;
    };
  }, []);

  return { ...weatherSnapshot, errorMessage };
}
