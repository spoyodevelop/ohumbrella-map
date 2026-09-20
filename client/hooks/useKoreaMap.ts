import { useCallback, useMemo, useState } from "react";
import { useMapData } from "./useMapData";
import { useMapView } from "./useMapView";
import { useMapSelection } from "./useMapSelection";
import { useMapHover } from "./useMapHover";
import type { MapRegion, SelectionState } from "../types";

const INITIAL_SELECTION: SelectionState = { level: "national" };

export function useKoreaMap() {
  const [selection, setSelection] = useState<SelectionState>(INITIAL_SELECTION);

  const sidoCode =
    selection.level !== "national" ? selection.sidoCode : undefined;
  const sigunguCode =
    selection.level === "sigungu" ? selection.sigunguCode : undefined;

  const mapData = useMapData(sidoCode);
  const visibleRegions =
    sidoCode !== undefined && mapData.sigungu.length > 0
      ? mapData.sigungu
      : mapData.sidos;

  const mapView = useMapView();

  const mapSelection = useMapSelection({
    selection,
    setSelection,
    sidos: mapData.sidos,
    preloadSigungu: mapData.preloadSigungu,
    focusRegion: mapView.focusRegion,
    resetView: mapView.resetView,
    didDrag: mapView.didDrag,
  });

  const mapHover = useMapHover({
    regions: visibleRegions,
    sidoCode,
    preloadSigungu: mapData.preloadSigungu,
  });

  const selectedRegion = useMemo<MapRegion | undefined>(() => {
    if (sigunguCode) {
      return mapData.sigungu.find(({ code }) => code === sigunguCode);
    }
    if (sidoCode) {
      return mapData.sidos.find(({ code }) => code === sidoCode);
    }
    return undefined;
  }, [sigunguCode, sidoCode, mapData.sigungu, mapData.sidos]);

  const clearSelection = useCallback(() => {
    if (selection.level === "sigungu") {
      setSelection({ level: "sido", sidoCode: selection.sidoCode });
    } else if (selection.level === "sido") {
      mapSelection.showNationalMap();
    }
  }, [selection, mapSelection]);


  return {
    svgRef: mapView.svgRef,
    view: mapView.view,
    isDragging: mapView.isDragging,
    isPinching: mapView.isPinching,
    zoomIn: mapView.zoomIn,
    zoomOut: mapView.zoomOut,
    handlePointerDown: mapView.handlePointerDown,
    handlePointerMove: mapView.handlePointerMove,
    handlePointerUp: mapView.handlePointerUp,
    sidoCode,
    sigunguCode,
    currentSido: mapSelection.currentSido,
    showNationalMap: mapSelection.showNationalMap,
    selectRegion: mapSelection.selectRegion,
    locateUser: mapSelection.locateUser,
    isLocating: mapSelection.isLocating,
    clearSelection,
    selectedRegion,
    hoveredRegion: mapHover.hoveredRegion,
    handleRegionEnter: mapHover.handleRegionEnter,
    handleRegionLeave: mapHover.handleRegionLeave,
    regions: visibleRegions,
    weatherTime: mapData.weatherTime,
    loading: mapData.loading,
    error: mapData.error,
  };
}
