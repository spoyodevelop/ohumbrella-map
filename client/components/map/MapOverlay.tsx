import type { MapRegion } from "../../types";
import styled from "@emotion/styled";

interface MapOverlayProps {
  activeRegion: MapRegion | undefined;
  sidoCode: string | undefined;
  scale: number;
  isSimgunguLod: boolean;
}

export function MapOverlay({
  activeRegion,
  sidoCode,
  scale,
  isSimgunguLod,
}: MapOverlayProps) {
  return (
    <>
      <Readout aria-live="polite">
        <span>
          {activeRegion?.name ??
            (sidoCode !== undefined
              ? "시군구를 가리켜 보세요"
              : "시도를 선택하세요")}
        </span>
        <strong>{activeRegion ? `${activeRegion.rainChance}%` : "—"}</strong>
      </Readout>

      <Legend aria-label="강수확률 범례">
        <span>0%</span>
        <LegendGradient />
        <span>100%</span>
      </Legend>

      <DebugReadout>
        <span>scale {scale.toFixed(2)}×</span>
        <span>{isSimgunguLod ? "sigungu LOD" : "sido LOD"}</span>
      </DebugReadout>
    </>
  );
}

const Readout = styled.aside`
  position: absolute;
  z-index: 2;
  top: 16px;
  left: 16px;
  display: grid;
  min-width: 148px;
  padding: 12px 14px;
  border: 1px solid #303847;
  border-radius: 9px;
  color: #aab5c6;
  background: rgb(14 18 26 / 0.9);
  backdrop-filter: blur(12px);

  span {
    font-size: 0.75rem;
  }
  strong {
    margin-top: 3px;
    color: #fff;
    font-size: 1.7rem;
    line-height: 1;
  }

  @media (max-width: 640px) {
    top: 12px;
    left: 12px;
  }
`;
const Legend = styled.div`
  position: absolute;
  right: 18px;
  bottom: 18px;
  display: flex;
  align-items: center;
  gap: 8px;
  color: #98a3b5;
  font-size: 0.72rem;

  @media (max-width: 640px) {
    right: 12px;
    bottom: 12px;
  }
`;
const LegendGradient = styled.div`
  width: 110px;
  height: 7px;
  border-radius: 999px;
  background: linear-gradient(90deg, hsl(211 35% 78%), hsl(211 80% 36%));
`;
const DebugReadout = styled.div`
  position: absolute;
  bottom: 18px;
  left: 18px;
  display: flex;
  gap: 14px;
  color: #758095;
  font:
    600 0.72rem/1.2 ui-monospace,
    SFMono-Regular,
    Menlo,
    monospace;
  letter-spacing: 0;
  text-transform: none;

  @media (max-width: 640px) {
    bottom: 12px;
    left: 12px;
    flex-direction: column;
    gap: 2px;
  }
`;
