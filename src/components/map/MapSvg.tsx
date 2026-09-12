import type { MapRegion, MapView } from "../../types";
import styled from "@emotion/styled";

const VIEW_BOX = "0 0 780 900";

function chanceColor(chance: number) {
  return `hsl(211 ${35 + chance * 0.45}% ${78 - chance * 0.42}%)`;
}

interface RegionPathProps {
  region: MapRegion;
  selected: boolean;
  onEnter: () => void;
  onLeave: () => void;
  onSelect: () => void;
}

function RegionPath({
  region,
  selected,
  onEnter,
  onLeave,
  onSelect,
}: RegionPathProps) {
  return (
    <path
      d={region.path}
      fill={chanceColor(region.rainChance)}
      className={selected ? "region is-selected" : "region"}
      vectorEffect="non-scaling-stroke"
      onPointerEnter={onEnter}
      onPointerLeave={onLeave}
      onClick={onSelect}
    >
      <title>
        {region.name} · 강수확률 {region.rainChance}%
      </title>
    </path>
  );
}

interface RegionLabelProps {
  region: MapRegion;
  scale: number;
}

function RegionLabel({ region, scale }: RegionLabelProps) {
  return (
    <text
      className="region-label"
      transform={`translate(${region.label.x},${region.label.y}) scale(${scale})`}
      pointerEvents="none"
    >
      {region.name}
    </text>
  );
}

interface MapSvgProps {
  svgRef: React.RefObject<SVGSVGElement | null>;
  regions: MapRegion[];
  view: MapView;
  isDragging: boolean;
  isPinching: boolean;
  sidoCode: string | undefined;
  sigunguCode: string | undefined;
  currentSidoName: string | undefined;
  onPointerDown: (e: React.PointerEvent<SVGSVGElement>) => void;
  onPointerMove: (e: React.PointerEvent<SVGSVGElement>) => void;
  onPointerUp: (e: React.PointerEvent<SVGSVGElement>) => void;
  onBackgroundClick: () => void;
  onRegionEnter: (region: MapRegion) => void;
  onRegionLeave: () => void;
  onRegionSelect: (region: MapRegion) => void;
}

export function MapSvg({
  svgRef,
  regions,
  view,
  isDragging,
  isPinching,
  sidoCode,
  sigunguCode,
  currentSidoName,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onBackgroundClick,
  onRegionEnter,
  onRegionLeave,
  onRegionSelect,
}: MapSvgProps) {
  const transform = `translate(${view.x}px, ${view.y}px) scale(${view.scale})`;

  return (
    <SvgRoot
      ref={svgRef}
      viewBox={VIEW_BOX}
      role="img"
      aria-label={
        sidoCode !== undefined
          ? `${currentSidoName} 시군구 지도`
          : "대한민국 시도 지도"
      }
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <MapBackground width="780" height="900" onClick={onBackgroundClick} />

      <MapLayer
        $dragging={isDragging}
        $pinching={isPinching}
        style={{ transform }}
      >
        {regions.map((region) => (
          <RegionPath
            key={region.code}
            region={region}
            selected={region.code === sigunguCode}
            onEnter={() => onRegionEnter(region)}
            onLeave={onRegionLeave}
            onSelect={() => onRegionSelect(region)}
          />
        ))}
      </MapLayer>

      {/* 레이블은 CSS transition 없이 React state와 즉시 동기화 */}
      <LabelLayer style={{ transform }}>
        {regions.map((region) => (
          <RegionLabel
            key={region.code}
            region={region}
            scale={1 / view.scale}
          />
        ))}
      </LabelLayer>
    </SvgRoot>
  );
}

const SvgRoot = styled.svg`
  display: block;
  width: 100%;
  height: 100%;
  cursor: grab;
  touch-action: none;
  user-select: none;

  &:active {
    cursor: grabbing;
  }
`;

const MapBackground = styled.rect`
  fill: transparent;
`;

const MapLayer = styled.g<{ $dragging: boolean; $pinching: boolean }>`
  transform-box: view-box;
  transform-origin: 0 0;
  will-change: transform;
  transition: ${({ $dragging, $pinching }) =>
    $dragging || $pinching
      ? "none"
      : "transform 200ms cubic-bezier(0.22, 1, 0.36, 1)"};
`;

const LabelLayer = styled.g`
  transform-box: view-box;
  transform-origin: 0 0;
  will-change: transform;
  pointer-events: none;
`;
