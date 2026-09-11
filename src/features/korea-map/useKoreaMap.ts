import { useEffect, useRef, useState } from "react";
import { useMapData } from "./useMapData";
import type { MapPoint, MapRegion, MapView } from "./types";

const INITIAL_VIEW: MapView = { x: 0, y: 0, scale: 1 };
const MAP_CENTER = { x: 390, y: 450 };
const MIN_SCALE = 0.8;
const MAX_SCALE = 12;

function zoomView(current: MapView, point: MapPoint, factor: number): MapView {
  const scale = Math.min(
    MAX_SCALE,
    Math.max(MIN_SCALE, current.scale * factor),
  );
  const ratio = scale / current.scale;
  return {
    scale,
    x: point.x - (point.x - current.x) * ratio,
    y: point.y - (point.y - current.y) * ratio,
  };
}

export function useKoreaMap() {
  const svgRef = useRef<SVGSVGElement>(null);
  const pointers = useRef(new Map<number, MapPoint>());
  const lastPinchDistance = useRef<number | null>(null);
  const dragDistance = useRef(0);
  const dragged = useRef(false);
  const [selectedSido, setSelectedSido] = useState<string | null>('11');
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const [hoveredCode, setHoveredCode] = useState<string | null>(null);
  const [view, setView] = useState<MapView>(INITIAL_VIEW);
  const [isDragging, setIsDragging] = useState(false);
  const [isPinching, setIsPinching] = useState(false);
  const { sidos, sigungu, loading, error, preloadSigungu } =
    useMapData(selectedSido);

  // sigungu 로딩 중에는 sidos를 폴백으로 표시 (빈 화면 방지)
  const regions = selectedSido
    ? (sigungu.length > 0 ? sigungu : sidos)
    : sidos;
  const activeRegion =
    regions.find(({ code }) => code === hoveredCode) ??
    regions.find(({ code }) => code === selectedCode) ??
    null;
  const currentSido = sidos.find(({ code }) => code === selectedSido) ?? null;

  function toMapPoint(clientX: number, clientY: number): MapPoint {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    return new DOMPoint(clientX, clientY).matrixTransform(
      svg.getScreenCTM()?.inverse(),
    );
  }

  function zoomAt(point: MapPoint, factor: number) {
    setView((current) => zoomView(current, point, factor));
  }

  function focus(region: MapRegion) {
    const [minX, minY, maxX, maxY] = region.bounds;
    const scale = Math.min(
      MAX_SCALE,
      Math.max(
        1.5,
        Math.min(
          560 / Math.max(1, maxX - minX),
          650 / Math.max(1, maxY - minY),
        ),
      ),
    );
    setView({
      scale,
      x: MAP_CENTER.x - ((minX + maxX) / 2) * scale,
      y: MAP_CENTER.y - ((minY + maxY) / 2) * scale,
    });
  }

  function showNationalMap() {
    setSelectedSido(null);
    setSelectedCode(null);
    setHoveredCode(null);
    setView(INITIAL_VIEW);
  }

  function selectRegion(region: MapRegion) {
    if (dragged.current) return;
    if (!selectedSido) {
      setSelectedSido(region.code);
      setSelectedCode(null);
    } else {
      setSelectedCode(region.code);
    }
    setHoveredCode(null);
    focus(region);
  }

  function handlePointerDown(event: React.PointerEvent<SVGSVGElement>) {
    pointers.current.set(
      event.pointerId,
      toMapPoint(event.clientX, event.clientY),
    );
    dragDistance.current = 0;
    dragged.current = false;

    if (pointers.current.size === 2) {
      for (const pointerId of pointers.current.keys()) {
        event.currentTarget.setPointerCapture(pointerId);
      }
      dragged.current = true;
      lastPinchDistance.current = null;
      setIsPinching(true);
    }
  }

  function handlePointerMove(event: React.PointerEvent<SVGSVGElement>) {
    if (!pointers.current.has(event.pointerId)) return;
    const point = toMapPoint(event.clientX, event.clientY);

    const previous = pointers.current.get(event.pointerId);
    pointers.current.set(event.pointerId, point);
    if (!previous) return;

    if (pointers.current.size === 1) {
      const dx = point.x - previous.x;
      const dy = point.y - previous.y;
      dragDistance.current += Math.hypot(dx, dy);
      if (!dragged.current && dragDistance.current < 5) return;
      if (!dragged.current) {
        dragged.current = true;
        event.currentTarget.setPointerCapture(event.pointerId);
        setIsDragging(true);
      }
      setView((current) => ({
        ...current,
        x: current.x + dx,
        y: current.y + dy,
      }));
      return;
    }

    const [first, second] = [...pointers.current.values()];
    const distance = Math.hypot(second.x - first.x, second.y - first.y);
    const center = { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 };
    if (lastPinchDistance.current) {
      // 지수 적용: 손가락 조금만 벌려도 충분히 확대
      zoomAt(center, Math.pow(distance / lastPinchDistance.current, 2.5));
    }
    lastPinchDistance.current = distance;
  }

  function handlePointerUp(event: React.PointerEvent<SVGSVGElement>) {
    pointers.current.delete(event.pointerId);
    if (pointers.current.size < 2) {
      lastPinchDistance.current = null;
      setIsPinching(false);
    }
    if (pointers.current.size === 0) setIsDragging(false);
  }

  // sidos 로드 완료 시 서울 bounds로 초기 뷰 설정
  useEffect(() => {
    if (sidos.length === 0) return
    const seoul = sidos.find(({ code }) => code === '11')
    if (seoul) focus(seoul)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sidos])

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(
        svg.getScreenCTM()?.inverse(),
      );
      setView((current) =>
        zoomView(current, point, Math.exp(-event.deltaY * 0.0014)),
      );
    };

    svg.addEventListener("wheel", handleWheel, { passive: false });
    return () => svg.removeEventListener("wheel", handleWheel);
  }, []);

  return {
    svgRef,
    regions,
    activeRegion,
    currentSido,
    selectedSido,
    selectedCode,
    view,
    isDragging,
    isPinching,
    loading,
    error,
    zoomIn: () => zoomAt(MAP_CENTER, 2.25),
    zoomOut: () => zoomAt(MAP_CENTER, 1 / 2.25),
    showNationalMap,
    selectRegion,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handleRegionEnter: (region: MapRegion) => {
      setHoveredCode(region.code);
      if (!selectedSido)
        void preloadSigungu(region.code).catch(() => undefined);
    },
    handleRegionLeave: () => setHoveredCode(null),
  };
}
