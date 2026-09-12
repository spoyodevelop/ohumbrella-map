import { useState } from "react";
import type { MapRegion } from "../types";

export type UseMapHoverDeps = {
  regions: MapRegion[];
  sidoCode: string | undefined;
  preloadSigungu: (code: string) => Promise<MapRegion[]>;
};

export type UseMapHoverResult = {
  hoveredRegion: MapRegion | undefined;
  handleRegionEnter: (region: MapRegion) => void;
  handleRegionLeave: () => void;
};

export function useMapHover({
  regions,
  sidoCode,
  preloadSigungu,
}: UseMapHoverDeps): UseMapHoverResult {
  const [hoveredCode, setHoveredCode] = useState<string | undefined>(undefined);

  const hoveredRegion: MapRegion | undefined = regions.find(
    ({ code }) => code === hoveredCode,
  );

  function handleRegionEnter(region: MapRegion) {
    setHoveredCode(region.code);
    if (sidoCode === undefined) {
      void preloadSigungu(region.code).catch(() => undefined);
    }
  }

  function handleRegionLeave() {
    setHoveredCode(undefined);
  }

  return { hoveredRegion, handleRegionEnter, handleRegionLeave };
}

