import { useCallback, useEffect, useMemo, useState } from "react";
import { loadRegionFile, sidoFile, sigunguFile } from "../lib/mapData";
import type { MapRegion, RegionWeatherInfo } from "../types";
import { useWeatherData } from "./useWeatherData";

export function useMapData(sidoCode: string | undefined) {
  const weatherData = useWeatherData();
  const [sidoRegions, setSidoRegions] = useState<MapRegion[]>([]);
  const [sigunguRegionsBySidoCode, setSigunguRegionsBySidoCode] = useState<
    Record<string, MapRegion[]>
  >({});
  const [mapErrorMessage, setMapErrorMessage] = useState("");

  useEffect(() => {
    let isEffectActive = true;
    loadRegionFile(sidoFile)
      .then((loadedRegions) => {
        if (isEffectActive) setSidoRegions(loadedRegions);
      })
      .catch((reason: unknown) => {
        if (isEffectActive) {
          setMapErrorMessage(
            reason instanceof Error ? reason.message : String(reason),
          );
        }
      });
    return () => {
      isEffectActive = false;
    };
  }, []);

  useEffect(() => {
    if (sidoCode === undefined || sidoCode in sigunguRegionsBySidoCode) return;
    let isEffectActive = true;
    loadRegionFile(sigunguFile(sidoCode))
      .then((loadedRegions) => {
        if (isEffectActive) {
          setSigunguRegionsBySidoCode((currentRegions) => ({
            ...currentRegions,
            [sidoCode]: loadedRegions,
          }));
        }
      })
      .catch((reason: unknown) => {
        if (isEffectActive) {
          setMapErrorMessage(
            reason instanceof Error ? reason.message : String(reason),
          );
        }
      });
    return () => {
      isEffectActive = false;
    };
  }, [sidoCode, sigunguRegionsBySidoCode]);

  function resolveRainChance(
    regionWeather: RegionWeatherInfo,
    fallbackRainChance: number,
  ): number {
    if (regionWeather.kmaPop != null) return regionWeather.kmaPop;
    if (regionWeather.empiricalRate != null) {
      return Math.round(regionWeather.empiricalRate);
    }
    return fallbackRainChance;
  }

  const attachWeatherToSigunguRegions = useCallback(
    (regions: MapRegion[]) => {
      return regions.map((region) => {
        const regionWeather = weatherData.weatherMap[region.code];
        if (!regionWeather) return region;
        return {
          ...region,
          rainChance: resolveRainChance(regionWeather, region.rainChance),
          weather: regionWeather,
        };
      });
    },
    [weatherData.weatherMap],
  );

  const sidoRegionsWithWeather = useMemo(() => {
    return sidoRegions.map((region) => {
      const sidoWeatherStats = weatherData.sidoStatsMap[region.code];
      if (!sidoWeatherStats) return region;
      return {
        ...region,
        rainChance: Math.round(sidoWeatherStats.avgPop),
        stats: sidoWeatherStats.stats,
        sampleCount: sidoWeatherStats.totalCount,
      };
    });
  }, [sidoRegions, weatherData.sidoStatsMap]);

  const sigunguRegionsWithWeather = useMemo(() => {
    if (!sidoCode || !sigunguRegionsBySidoCode[sidoCode]) return [];
    return attachWeatherToSigunguRegions(
      sigunguRegionsBySidoCode[sidoCode],
    );
  }, [sidoCode, sigunguRegionsBySidoCode, attachWeatherToSigunguRegions]);

  const isLoading =
    sidoRegions.length === 0 ||
    (sidoCode !== undefined && !(sidoCode in sigunguRegionsBySidoCode));

  const preloadSigungu = useCallback(
    (code: string): Promise<MapRegion[]> => {
      if (code in sigunguRegionsBySidoCode) {
        return Promise.resolve(
          attachWeatherToSigunguRegions(sigunguRegionsBySidoCode[code]),
        );
      }
      return loadRegionFile(sigunguFile(code)).then((loadedRegions) => {
        setSigunguRegionsBySidoCode((currentRegions) => ({
          ...currentRegions,
          [code]: loadedRegions,
        }));
        return attachWeatherToSigunguRegions(loadedRegions);
      });
    },
    [sigunguRegionsBySidoCode, attachWeatherToSigunguRegions],
  );

  return {
    sidos: sidoRegionsWithWeather,
    sigungu: sigunguRegionsWithWeather,
    weatherTime: weatherData.weatherTime,
    loading: isLoading,
    error: mapErrorMessage || weatherData.errorMessage,
    preloadSigungu,
  };
}
