import { useEffect, useState } from "react";
import { loadRegionFile, sidoFile, sigunguFile } from "../lib/mapData";
import type { MapRegion } from "../types";

export function useMapData(sidoCode: string | undefined) {
  const [sidos, setSidos] = useState<MapRegion[]>([]);
  const [sigunguCache, setSigunguCache] = useState<Record<string, MapRegion[]>>(
    {},
  );
  const [error, setError] = useState("");

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
  }, [sidoCode]);
  const sigungu = sidoCode !== undefined ? (sigunguCache[sidoCode] ?? []) : [];
  const loading =
    sidos.length === 0 ||
    (sidoCode !== undefined && !(sidoCode in sigunguCache));

  const preloadSigungu = (code: string): Promise<MapRegion[]> => {
    if (code in sigunguCache) return Promise.resolve(sigunguCache[code]!);
    return loadRegionFile(sigunguFile(code)).then((regions) => {
      setSigunguCache((prev) => ({ ...prev, [code]: regions }));
      return regions;
    });
  };

  return {
    sidos,
    sigungu,
    loading,
    error,
    preloadSigungu,
  };
}
