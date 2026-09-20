import { useEffect, useState } from "react";
import {
  loadWeatherSnapshot,
  type WeatherSnapshot,
} from "../api/weather";

interface WeatherData extends WeatherSnapshot {
  error: string;
}

const EMPTY_WEATHER: WeatherSnapshot = {
  weatherMap: {},
  sidoStatsMap: {},
  weatherTime: "",
};

export function useWeatherData(): WeatherData {
  const [weather, setWeather] = useState<WeatherSnapshot>(EMPTY_WEATHER);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    loadWeatherSnapshot()
      .then((snapshot) => {
        if (active) setWeather(snapshot);
      })
      .catch((reason: unknown) => {
        if (active) {
          setError(reason instanceof Error ? reason.message : String(reason));
        }
      });

    return () => {
      active = false;
    };
  }, []);

  return { ...weather, error };
}
