import { useState } from "react";
import type { MapRegion } from "../types";

export type UseMapHoverDeps = {
  regions: MapRegion[];
  sigunguCode: string | undefined;
  sidoCode: string | undefined;
  preloadSigungu: (code: string) => Promise<MapRegion[]>;
};

export type UseMapHoverResult = {
  activeRegion: MapRegion | undefined;
  handleRegionEnter: (region: MapRegion) => void;
  handleRegionLeave: () => void;
};

export function useMapHover({
  regions,
  sigunguCode,
  sidoCode,
  preloadSigungu,
}: UseMapHoverDeps): UseMapHoverResult {
  const [hoveredCode, setHoveredCode] = useState<string | undefined>(undefined);

  const activeRegion: MapRegion | undefined =
    regions.find(({ code }) => code === hoveredCode) ??
    regions.find(({ code }) => code === sigunguCode);

  function handleRegionEnter(region: MapRegion) {
    setHoveredCode(region.code);
    if (sidoCode === undefined) {
      void preloadSigungu(region.code).catch(() => undefined);
    }
  }

  function handleRegionLeave() {
    setHoveredCode(undefined);
  }

  return { activeRegion, handleRegionEnter, handleRegionLeave };
}
