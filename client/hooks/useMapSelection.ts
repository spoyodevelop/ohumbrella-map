import { useEffect } from "react";
import { reverseGeocode } from "../lib/reverseGeocode";
import type { MapRegion, SelectionState } from "../types";

export type UseMapSelectionDeps = {
  selection: SelectionState;
  setSelection: React.Dispatch<React.SetStateAction<SelectionState>>;
  sidos: MapRegion[];
  preloadSigungu: (code: string) => Promise<MapRegion[]>;
  focus: (region: MapRegion) => void;
  resetView: () => void;
  dragged: React.RefObject<boolean>;
};

export type UseMapSelectionResult = {
  currentSido: MapRegion | undefined;
  showNationalMap: () => void;
  selectRegion: (region: MapRegion) => void;
};

export function useMapSelection({
  selection,
  setSelection,
  sidos,
  preloadSigungu,
  focus,
  resetView,
  dragged,
}: UseMapSelectionDeps): UseMapSelectionResult {
  const sidoCode = selection.level !== "national" ? selection.sidoCode : undefined;
  const currentSido = sidos.find(({ code }) => code === sidoCode);

  function showNationalMap() {
    setSelection({ level: "national" });
    resetView();
  }

  function selectRegion(region: MapRegion) {
    if (dragged.current) return;
    setSelection((current) => {
      if (current.level === "national") return { level: "sido", sidoCode: region.code };
      return { level: "sigungu", sidoCode: current.sidoCode, sigunguCode: region.code };
    });
    focus(region);
  }

  // sidos 로드 완료 시 geolocation → reverse geocode → 자동 선택, 실패 시 서울
  useEffect(() => {
    if (sidos.length === 0) return;
    reverseGeocode()
      .then(({ sidoName, sigunguName }) => {
        const sido = sidos.find(({ name }) => name === sidoName);
        if (!sido) return;
        setSelection({ level: "sido", sidoCode: sido.code });
        focus(sido);
        return preloadSigungu(sido.code).then((regions) => {
          const target = regions.find(({ name }) => name === sigunguName);
          if (target) {
            setSelection({ level: "sigungu", sidoCode: sido.code, sigunguCode: target.code });
            focus(target);
          }
        });
      })
      .catch(() => {
        const seoul = sidos.find(({ code }) => code === "11");
        if (seoul) { setSelection({ level: "sido", sidoCode: "11" }); focus(seoul); }
      });
  }, [sidos]); // eslint-disable-line react-hooks/exhaustive-deps

  return { currentSido, showNationalMap, selectRegion };
}
