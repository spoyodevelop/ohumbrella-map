import type { MapRegion } from "../../types";
import styled from "@emotion/styled";

interface MapOverlayProps {
  selectedRegion: MapRegion | undefined;
  hoveredRegion: MapRegion | undefined;
  sidoCode: string | undefined;
  scale: number;
  isSimgunguLod: boolean;
  onCloseDetail?: () => void;
}

function getSkyText(sky?: number) {
  if (sky === 1) return "맑음";
  if (sky === 3) return "구름 많음";
  if (sky === 4) return "흐림";
  return "맑음";
}

function getPtyText(pty?: number) {
  if (pty === 1) return "비";
  if (pty === 2) return "비/눈";
  if (pty === 3) return "눈";
  if (pty === 4) return "소나기";
  return "강수 없음";
}

export function MapOverlay({
  selectedRegion,
  hoveredRegion,
  sidoCode,
  scale,
  isSimgunguLod,
  onCloseDetail,
}: MapOverlayProps) {
  const weather = selectedRegion?.weather;
  const isRaining = weather?.isRaining === 1;

  return (
    <>
      {/* 1. 호버 시: 어떤 구/시도인지 이름만 가볍게 확인하는 미니 툴팁 */}
      {hoveredRegion && (
        <HoverTooltip role="tooltip" aria-hidden="true">
          <HoverPinIcon>📍</HoverPinIcon>
          <HoverName>{hoveredRegion.name}</HoverName>
        </HoverTooltip>
      )}

      {/* 2. 클릭(선택) 시에만 표시되는 상세 날씨 카드 */}
      {selectedRegion ? (
        <DetailCard aria-live="polite">
          <HeaderRow>
            <TitleGroup>
              <RegionName>{selectedRegion.name}</RegionName>
              {weather?.tmp != null && <TempBadge>{weather.tmp}°C</TempBadge>}
            </TitleGroup>
            {onCloseDetail && (
              <CloseBtn
                type="button"
                onClick={onCloseDetail}
                aria-label="닫기"
                title="선택 해제"
              >
                ✕
              </CloseBtn>
            )}
          </HeaderRow>

          {/* 💡 실시간 실황: 지금 실제 비가 오는지 직관적 확인 배너 */}
          {weather ? (
            <LiveRainBanner isRaining={isRaining}>
              <RainIcon>{isRaining ? "🌧️" : "☀️"}</RainIcon>
              <RainInfo>
                <RainTitle>
                  {isRaining ? "현재 비 내리는 중" : "현재 비 오지 않음"}
                </RainTitle>
                <RainSub>
                  {isRaining
                    ? `실시간 강수량 ${weather.rn1 ?? 0}mm/h (${getPtyText(weather.pty)})`
                    : `하늘 상태: ${getSkyText(weather.sky)} · 강수량 0mm`}
                </RainSub>
              </RainInfo>
            </LiveRainBanner>
          ) : (
            <LiveRainBanner isRaining={false}>
              <RainIcon>📍</RainIcon>
              <RainInfo>
                <RainTitle>
                  지역 평균 강수확률 {selectedRegion.rainChance}%
                </RainTitle>
                <RainSub>구/군을 선택하면 실시간 실황을 확인합니다</RainSub>
              </RainInfo>
            </LiveRainBanner>
          )}

          {/* 💡 단기예보 강수확률 vs 오우산 실제 강수확률 (구/군 선택 시에만 표시) */}
          {weather && (
            <StatsGrid>
              <StatBox highlight>
                <StatLabel>단기예보 강수확률</StatLabel>
                <StatVal highlight>
                  {weather.kmaPop != null ? `${weather.kmaPop}%` : "—"}
                </StatVal>
                <StatSubText>기상청 예보 (POP)</StatSubText>
              </StatBox>

              <StatBox>
                <StatLabel>실제 강수확률</StatLabel>
                <StatVal>
                  {weather.empiricalRate != null
                    ? `${Math.round(weather.empiricalRate)}%`
                    : "—"}
                </StatVal>
                <StatSubText>
                  {weather.sampleCount > 0
                    ? `과거 표본 ${weather.sampleCount}건 검증`
                    : "표본 수집 중"}
                </StatSubText>
              </StatBox>
            </StatsGrid>
          )}
        </DetailCard>
      ) : (
        /* 아무것도 선택하지 않았을 때의 은은한 힌트 배너 */
        <GuideBanner>
          {sidoCode !== undefined
            ? "구/군을 터치(클릭)하면 실시간 날씨를 확인합니다"
            : "시도를 터치(클릭)하여 지역으로 이동하세요"}
        </GuideBanner>
      )}

      {/* 강수확률 범례 */}
      <Legend aria-label="강수확률 범례">
        <span>0%</span>
        <LegendGradient />
        <span>100%</span>
      </Legend>

      {/* 디버그 정보 */}
      <DebugReadout>
        <span>scale {scale.toFixed(2)}×</span>
        <span>{isSimgunguLod ? "sigungu LOD" : "sido LOD"}</span>
      </DebugReadout>
    </>
  );
}

// 1. 호버 전용 가벼운 툴팁 (마우스 오버 시 이름만 표시)
const HoverTooltip = styled.div`
  position: absolute;
  top: 18px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 10;
  pointer-events: none;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  border-radius: 9999px;
  background: rgba(15, 23, 42, 0.88);
  border: 1px solid rgba(56, 189, 248, 0.35);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(10px);
  animation: fadeIn 0.15s ease-out;

  @keyframes fadeIn {
    from {
      opacity: 0;
      transform: translate(-50%, -4px);
    }
    to {
      opacity: 1;
      transform: translate(-50%, 0);
    }
  }
`;

const HoverPinIcon = styled.span`
  font-size: 0.8rem;
`;

const HoverName = styled.span`
  font-size: 0.88rem;
  font-weight: 700;
  color: #f8fafc;
  letter-spacing: -0.01em;
`;

// 2. 클릭(선택) 시 상세 카드
const DetailCard = styled.aside`
  position: absolute;
  z-index: 2;
  top: 16px;
  left: 16px;
  display: grid;
  gap: 12px;
  min-width: 250px;
  max-width: 320px;
  padding: 16px;
  border: 1px solid rgba(56, 189, 248, 0.28);
  border-radius: 14px;
  color: #aab5c6;
  background: rgb(14 18 26 / 0.95);
  backdrop-filter: blur(16px);
  box-shadow: 0 12px 36px rgba(0, 0, 0, 0.45);
  animation: popIn 0.2s cubic-bezier(0.16, 1, 0.3, 1);

  @keyframes popIn {
    from {
      opacity: 0;
      transform: scale(0.96) translateY(-4px);
    }
    to {
      opacity: 1;
      transform: scale(1) translateY(0);
    }
  }

  @media (max-width: 640px) {
    top: 12px;
    left: 12px;
    right: 12px;
    max-width: none;
    min-width: auto;
  }
`;

const HeaderRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
`;

const TitleGroup = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

const RegionName = styled.span`
  font-size: 1.05rem;
  font-weight: 700;
  color: #f8fafc;
`;

const CloseBtn = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  padding: 0;
  border: none;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.08);
  color: #94a3b8;
  font-size: 0.8rem;
  cursor: pointer;
  transition: all 0.15s ease;

  &:hover {
    background: rgba(255, 255, 255, 0.18);
    color: #f1f5f9;
  }
`;

const TempBadge = styled.span`
  font-size: 0.78rem;
  font-weight: 600;
  color: #38bdf8;
  background: rgba(56, 189, 248, 0.14);
  padding: 2px 8px;
  border-radius: 6px;
`;

// 지금 실제 비가 오는지 실시간 배너
const LiveRainBanner = styled.div<{ isRaining: boolean }>`
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid
    ${(props) =>
      props.isRaining
        ? "rgba(96, 165, 250, 0.35)"
        : "rgba(148, 163, 184, 0.18)"};
  background: ${(props) =>
    props.isRaining
      ? "linear-gradient(135deg, rgba(30, 58, 138, 0.35), rgba(37, 99, 235, 0.18))"
      : "rgba(30, 41, 59, 0.45)"};
`;

const RainIcon = styled.span`
  font-size: 1.3rem;
`;

const RainInfo = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
`;

const RainTitle = styled.div`
  font-size: 0.85rem;
  font-weight: 700;
  color: #f1f5f9;
`;

const RainSub = styled.div`
  font-size: 0.7rem;
  color: #94a3b8;
`;

const StatsGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-top: 2px;
`;

const StatBox = styled.div<{ highlight?: boolean }>`
  padding: 10px 12px;
  border-radius: 10px;
  background: ${(props) =>
    props.highlight ? "rgba(56, 189, 248, 0.08)" : "rgba(30, 41, 59, 0.35)"};
  border: 1px solid
    ${(props) =>
      props.highlight ? "rgba(56, 189, 248, 0.22)" : "rgba(51, 65, 85, 0.3)"};
`;

const StatLabel = styled.div`
  font-size: 0.68rem;
  font-weight: 600;
  color: #94a3b8;
  letter-spacing: -0.02em;
  margin-bottom: 2px;
`;

const StatVal = styled.div<{ highlight?: boolean }>`
  font-size: 1.45rem;
  font-weight: 800;
  line-height: 1.15;
  color: ${(props) => (props.highlight ? "#38bdf8" : "#e2e8f0")};
`;

const StatSubText = styled.div`
  font-size: 0.62rem;
  color: #64748b;
  margin-top: 3px;
`;

// 미선택 시 힌트 배너
const GuideBanner = styled.div`
  position: absolute;
  top: 16px;
  left: 16px;
  z-index: 1;
  padding: 8px 14px;
  border: 1px dashed #334155;
  border-radius: 10px;
  font-size: 0.8rem;
  color: #64748b;
  background: rgba(15, 23, 42, 0.5);
  backdrop-filter: blur(8px);
  pointer-events: none;

  @media (max-width: 640px) {
    top: 12px;
    left: 12px;
    font-size: 0.74rem;
    padding: 6px 10px;
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
