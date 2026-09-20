import type { MapRegion } from "../../types";
import styled from "@emotion/styled";
import {
  MAP_HEIGHT,
  MAP_VIEWBOX,
  MAP_WIDTH,
} from "../../constants/map";

function chanceColor(chance: number) {
  return `hsl(211 ${35 + chance * 0.45}% ${78 - chance * 0.42}%)`;
}

interface RegionPathProps {
  region: MapRegion;
  selected: boolean;
  onSelect: () => void;
}

function RegionPath({
  region,
  selected,
  onSelect,
}: RegionPathProps) {
  return (
    <path
      d={region.path}
      fill={chanceColor(region.rainChance)}
      className={selected ? "region is-selected" : "region"}
      vectorEffect="non-scaling-stroke"
      onClick={onSelect}
    >
      <title>{region.name}</title>
    </path>
  );
}

function getShortRegionName(name: string): string {
  const shortNames: Record<string, string> = {
    서울특별시: "서울",
    부산광역시: "부산",
    대구광역시: "대구",
    인천광역시: "인천",
    광주광역시: "광주",
    대전광역시: "대전",
    울산광역시: "울산",
    세종특별자치시: "세종",
    경기도: "경기",
    강원특별자치도: "강원",
    강원도: "강원",
    충청북도: "충북",
    충청남도: "충남",
    전라북도: "전북",
    전북특별자치도: "전북",
    전라남도: "전남",
    경상북도: "경북",
    경상남도: "경남",
    제주특별자치도: "제주",
    제주도: "제주",
  };
  return shortNames[name] || name;
}

interface RegionLabelProps {
  region: MapRegion;
}

function RegionLabel({ region }: RegionLabelProps) {
  return (
    <text
      className="region-label"
      style={{
        transform: `translate(${region.label.x}px, ${region.label.y}px) scale(var(--map-inverse-scale, 1))`,
      }}
      pointerEvents="none"
    >
      {getShortRegionName(region.name)}
    </text>
  );
}

interface MapSvgProps {
  svgRef: React.RefObject<SVGSVGElement | null>;
  regions: MapRegion[];
  isDragging: boolean;
  isWheelZooming: boolean;
  sidoCode: string | undefined;
  sigunguCode: string | undefined;
  currentSidoName: string | undefined;
  onPointerDown: (e: React.PointerEvent<SVGSVGElement>) => void;
  onPointerMove: (e: React.PointerEvent<SVGSVGElement>) => void;
  onPointerUp: (e: React.PointerEvent<SVGSVGElement>) => void;
  onBackgroundClick: () => void;
  onRegionSelect: (region: MapRegion) => void;
}

export function MapSvg({
  svgRef,
  regions,
  isDragging,
  isWheelZooming,
  sidoCode,
  sigunguCode,
  currentSidoName,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onBackgroundClick,
  onRegionSelect,
}: MapSvgProps) {
  return (
    <SvgRoot
      ref={svgRef}
      viewBox={MAP_VIEWBOX}
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
      <MapBackground
        width={MAP_WIDTH}
        height={MAP_HEIGHT}
        onClick={onBackgroundClick}
      />

      <MapLayer
        $dragging={isDragging}
        $wheelZooming={isWheelZooming}
      >
        {regions.map((region) => (
          <RegionPath
            key={region.code}
            region={region}
            selected={region.code === sigunguCode}
            onSelect={() => onRegionSelect(region)}
          />
        ))}
      </MapLayer>

      <LabelLayer>
        {regions.map((region) => (
          <RegionLabel key={region.code} region={region} />
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
  touch-action: pinch-zoom;
  user-select: none;

  &:active {
    cursor: grabbing;
  }
`;

const MapBackground = styled.rect`
  fill: transparent;
`;

const MapLayer = styled.g<{
  $dragging: boolean;
  $wheelZooming: boolean;
}>`
  transform-box: view-box;
  transform-origin: 0 0;
  transform: translate(var(--map-x, 0px), var(--map-y, 0px))
    scale(var(--map-scale, 1));
  will-change: transform;
  transition: ${({ $dragging, $wheelZooming }) =>
    $dragging || $wheelZooming
      ? "none"
      : "transform 120ms cubic-bezier(0.22, 1, 0.36, 1)"};
`;

const LabelLayer = styled.g`
  transform-box: view-box;
  transform-origin: 0 0;
  transform: translate(var(--map-x, 0px), var(--map-y, 0px))
    scale(var(--map-scale, 1));
  will-change: transform;
  pointer-events: none;
`;
