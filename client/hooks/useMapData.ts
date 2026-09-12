import { useCallback, useEffect, useMemo, useState } from "react";
import { loadRegionFile, sidoFile, sigunguFile } from "../lib/mapData";
import type { MapRegion, RegionWeatherInfo } from "../types";

interface SidoStat {
  sidoCode: string;
  avgPop: number;
  maxPop: number;
  totalRain: number;
  rainingCount: number;
  totalCount: number;
}

export function useMapData(sidoCode: string | undefined) {
  const [sidos, setSidos] = useState<MapRegion[]>([]);
  const [sigunguCache, setSigunguCache] = useState<Record<string, MapRegion[]>>(
    {},
  );
  const [weatherMap, setWeatherMap] = useState<
    Record<string, RegionWeatherInfo>
  >({});
  const [sidoStatsMap, setSidoStatsMap] = useState<Record<string, SidoStat>>(
    {},
  );
  const [weatherTime, setWeatherTime] = useState<string>("");
  const [error, setError] = useState("");

  // 1. 초기 1회: 전국 최신 실황 + 실측 확률 및 시도 통계 일괄 로드
  useEffect(() => {
    let active = true;

    Promise.all([
      fetch("/api/weather/current")
        .then((res) => (res.ok ? res.json() : null))
        .catch(() => null),
      fetch("/api/weather/sido-stats")
        .then((res) => (res.ok ? res.json() : null))
        .catch(() => null),
    ]).then(([currentRes, sidoRes]) => {
      if (!active) return;
      if (currentRes?.data) {
        setWeatherMap(currentRes.data);
        if (currentRes.time) setWeatherTime(currentRes.time);
      }
      if (sidoRes?.stats) {
        const smap: Record<string, SidoStat> = {};
        for (const s of sidoRes.stats) {
          smap[s.sidoCode] = s;
        }
        setSidoStatsMap(smap);
      }
    });

    return () => {
      active = false;
    };
  }, []);

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
        const weather = weatherMap[r.code];
        if (!weather) return r;
        return {
          ...r,
          rainChance: resolveRainChance(weather, r.rainChance),
          weather,
        };
      });
    },
    [weatherMap],
  );

  // 날씨 데이터 매핑 함수 (시도)
  const enrichedSidos = useMemo(() => {
    return sidos.map((s) => {
      const stat = sidoStatsMap[s.code];
      if (!stat) return s;
      return {
        ...s,
        rainChance: Math.round(stat.avgPop),
      };
    });
  }, [sidos, sidoStatsMap]);

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
    weatherTime,
    loading,
    error,
    preloadSigungu,
  };
}
