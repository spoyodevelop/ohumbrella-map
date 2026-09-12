import { useEffect, useRef, useState } from "react";
import type { MapPoint, MapRegion, MapView } from "../types";
import { MAP_CENTER } from "../constants/map";

const INITIAL_SCALE = 1.65;
const INITIAL_VIEW: MapView = {
  scale: INITIAL_SCALE,
  x: MAP_CENTER.x - MAP_CENTER.x * INITIAL_SCALE + 60.0,
  y: MAP_CENTER.y - MAP_CENTER.y * INITIAL_SCALE + 100.0,
};
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

export type UseMapViewResult = {
  svgRef: React.RefObject<SVGSVGElement | null>;
  dragged: React.RefObject<boolean>;
  view: MapView;
  isDragging: boolean;
  isPinching: boolean;
  zoomIn: () => void;
  zoomOut: () => void;
  focus: (region: MapRegion) => void;
  resetView: () => void;
  handlePointerDown: (event: React.PointerEvent<SVGSVGElement>) => void;
  handlePointerMove: (event: React.PointerEvent<SVGSVGElement>) => void;
  handlePointerUp: (event: React.PointerEvent<SVGSVGElement>) => void;
};

export function useMapView(): UseMapViewResult {
  const svgRef = useRef<SVGSVGElement>(null);
  const pointers = useRef(new Map<number, MapPoint>());
  const lastPinchDistance = useRef(0);
  const dragDistance = useRef(0);
  const dragged = useRef(false);

  const [view, setView] = useState<MapView>(INITIAL_VIEW);
  const [isDragging, setIsDragging] = useState(false);
  const [isPinching, setIsPinching] = useState(false);

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

  function resetView() {
    setView(INITIAL_VIEW);
  }

  function handlePointerDown(event: React.PointerEvent<SVGSVGElement>) {
    pointers.current.set(
      event.pointerId,
      toMapPoint(event.clientX, event.clientY),
    );
    dragDistance.current = 0;
    dragged.current = false;
    if (pointers.current.size === 2) {
      for (const id of pointers.current.keys())
        event.currentTarget.setPointerCapture(id);
      dragged.current = true;
      lastPinchDistance.current = 0;
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
    if (lastPinchDistance.current > 0) {
      zoomAt(center, Math.pow(distance / lastPinchDistance.current, 2.5));
    }
    lastPinchDistance.current = distance;
  }

  function handlePointerUp(event: React.PointerEvent<SVGSVGElement>) {
    pointers.current.delete(event.pointerId);
    if (pointers.current.size < 2) {
      lastPinchDistance.current = 0;
      setIsPinching(false);
    }
    if (pointers.current.size === 0) setIsDragging(false);
  }

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
    dragged,
    view,
    isDragging,
    isPinching,
    zoomIn: () => zoomAt(MAP_CENTER, 2.25),
    zoomOut: () => zoomAt(MAP_CENTER, 1 / 2.25),
    focus,
    resetView,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
  };
}
