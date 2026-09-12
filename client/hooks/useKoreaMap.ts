import { useState } from "react";
import { useMapData } from "./useMapData";
import { useMapView } from "./useMapView";
import { useMapSelection } from "./useMapSelection";
import { useMapHover } from "./useMapHover";
import type { SelectionState } from "../types";

const INITIAL_SELECTION: SelectionState = { level: "national" };

export function useKoreaMap() {
  const [selection, setSelection] = useState<SelectionState>(INITIAL_SELECTION);

  const sidoCode =
    selection.level !== "national" ? selection.sidoCode : undefined;
  const sigunguCode =
    selection.level === "sigungu" ? selection.sigunguCode : undefined;

  const mapData = useMapData(sidoCode);
  const regions = mapData.sigungu.length > 0 ? mapData.sigungu : mapData.sidos;

  const mapView = useMapView();

  const mapSelection = useMapSelection({
    selection,
    setSelection,
    sidos: mapData.sidos,
    preloadSigungu: mapData.preloadSigungu,
    focus: mapView.focus,
    resetView: mapView.resetView,
    dragged: mapView.dragged,
  });

  const mapHover = useMapHover({
    regions,
    sigunguCode,
    sidoCode,
    preloadSigungu: mapData.preloadSigungu,
  });

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
    activeRegion: mapHover.activeRegion,
    handleRegionEnter: mapHover.handleRegionEnter,
    handleRegionLeave: mapHover.handleRegionLeave,
    regions,
    loading: mapData.loading,
    error: mapData.error,
  };
}
