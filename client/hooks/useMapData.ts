import { useCallback, useEffect, useMemo, useState } from "react";
import { loadRegionFile, sidoFile, sigunguFile } from "../lib/mapData";
import type { MapRegion, RegionWeatherInfo } from "../types";
import { useWeatherData } from "./useWeatherData";

export function useMapData(sidoCode: string | undefined) {
  const weather = useWeatherData();
  const [sidos, setSidos] = useState<MapRegion[]>([]);
  const [sigunguCache, setSigunguCache] = useState<Record<string, MapRegion[]>>(
    {},
  );
  const [error, setError] = useState("");

  // 2. 시도 지도 경계 로드
  useEffect(() => {
    let active = true;
    loadRegionFile(sidoFile)
      .then((regions) => {
        if (active) setSidos(regions);
      })
      .catch((reason: unknown) => {
        if (active)
          setError(reason instanceof Error ? reason.message : String(reason));
      });
    return () => {
      active = false;
    };
  }, []);

  // 3. 특정 시도 진입 시 시군구 경계 로드
  useEffect(() => {
    if (sidoCode === undefined || sidoCode in sigunguCache) return;
    let active = true;
    loadRegionFile(sigunguFile(sidoCode))
      .then((regions) => {
        if (active)
          setSigunguCache((prev) => ({ ...prev, [sidoCode]: regions }));
      })
      .catch((reason: unknown) => {
        if (active)
          setError(reason instanceof Error ? reason.message : String(reason));
      });
    return () => {
      active = false;
    };
  }, [sidoCode, sigunguCache]);

  function resolveRainChance(
    weather: RegionWeatherInfo,
    fallback: number,
  ): number {
    if (weather.kmaPop != null) return weather.kmaPop;
    if (weather.empiricalRate != null) return Math.round(weather.empiricalRate);
    return fallback;
  }

  // 날씨 데이터 매핑 함수 (시군구)
  const enrichSigungu = useCallback(
    (rawList: MapRegion[]) => {
      return rawList.map((r) => {
        const regionWeather = weather.weatherMap[r.code];
        if (!regionWeather) return r;
        return {
          ...r,
          rainChance: resolveRainChance(regionWeather, r.rainChance),
          weather: regionWeather,
        };
      });
    },
    [weather.weatherMap],
  );

  // 날씨 데이터 매핑 함수 (시도)
  const enrichedSidos = useMemo(() => {
    return sidos.map((s) => {
      const stat = weather.sidoStatsMap[s.code];
      if (!stat) return s;
      return {
        ...s,
        rainChance: Math.round(stat.avgPop),
        stats: stat.stats,
        sampleCount: stat.totalCount,
      };
    });
  }, [sidos, weather.sidoStatsMap]);

  const enrichedSigungu = useMemo(() => {
    if (!sidoCode || !sigunguCache[sidoCode]) return [];
    return enrichSigungu(sigunguCache[sidoCode]);
  }, [sidoCode, sigunguCache, enrichSigungu]);

  const loading =
    sidos.length === 0 ||
    (sidoCode !== undefined && !(sidoCode in sigunguCache));

  const preloadSigungu = useCallback(
    (code: string): Promise<MapRegion[]> => {
      if (code in sigunguCache)
        return Promise.resolve(enrichSigungu(sigunguCache[code]));
      return loadRegionFile(sigunguFile(code)).then((regions) => {
        setSigunguCache((prev) => ({ ...prev, [code]: regions }));
        return enrichSigungu(regions);
      });
    },
    [sigunguCache, enrichSigungu],
  );

  return {
    sidos: enrichedSidos,
    sigungu: enrichedSigungu,
    weatherTime: weather.weatherTime,
    loading,
    error: error || weather.error,
    preloadSigungu,
  };
}
