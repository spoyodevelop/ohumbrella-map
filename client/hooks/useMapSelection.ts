import { useCallback, useState } from "react";
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
  locateUser: () => Promise<void>;
  isLocating: boolean;
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
  const sidoCode =
    selection.level !== "national" ? selection.sidoCode : undefined;
  const currentSido = sidos.find(({ code }) => code === sidoCode);
  const [isLocating, setIsLocating] = useState(false);

  function showNationalMap() {
    setSelection({ level: "national" });
    resetView();
  }

  function selectRegion(region: MapRegion) {
    if (dragged.current) return;
    setSelection((current) => {
      if (current.level === "national")
        return { level: "sido", sidoCode: region.code };
      return {
        level: "sigungu",
        sidoCode: current.sidoCode,
        sigunguCode: region.code,
      };
    });
    focus(region);
  }

  // 위치 버튼 클릭 시 수동 트리거: geolocation → reverse geocode → 시도/시군구 선택 및 이동
  const locateUser = useCallback(async () => {
    if (sidos.length === 0 || isLocating) return;
    setIsLocating(true);

    try {
      const { sidoName, sigunguName } = await reverseGeocode();
      const sido = sidos.find(({ name }) => name === sidoName);
      if (!sido) {
        alert("현재 위치의 지역 정보를 찾을 수 없습니다.");
        return;
      }

      setSelection({ level: "sido", sidoCode: sido.code });
      focus(sido);

      const regions = await preloadSigungu(sido.code);
      const target = regions.find(({ name }) => name === sigunguName);
      if (target) {
        setSelection({
          level: "sigungu",
          sidoCode: sido.code,
          sigunguCode: target.code,
        });
        focus(target);
      }
    } catch (error) {
      console.warn("현재 위치를 가져오지 못했습니다:", error);
      alert("현재 위치를 가져오지 못했습니다. 브라우저 위치 권한 설정을 확인해주세요.");
    } finally {
      setIsLocating(false);
    }
  }, [sidos, isLocating, preloadSigungu, setSelection, focus]);

  return { currentSido, showNationalMap, selectRegion, locateUser, isLocating };
}
