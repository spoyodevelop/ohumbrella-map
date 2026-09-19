import type { MapRegion, RegionWeatherInfo } from "../../types";
import styled from "@emotion/styled";
import { useState, useEffect } from "react";

interface MapOverlayProps {
  selectedRegion: MapRegion | undefined;
  hoveredRegion: MapRegion | undefined;
  sidoCode: string | undefined;
  scale: number;
  isSimgunguLod?: boolean;
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

type WeatherStatus =
  | "rain"
  | "snow"
  | "cloudy"
  | "partly_cloudy"
  | "sunny"
  | "summary";

interface WeatherVisual {
  status: WeatherStatus;
  icon: string;
  title: string;
  sub: string;
}

function getWeatherVisual(
  weather?: RegionWeatherInfo,
  fallbackRainChance = 0,
): WeatherVisual {
  if (!weather) {
    return {
      status: "summary",
      icon: "📍",
      title: `지역 평균 강수확률 ${fallbackRainChance}%`,
      sub: "구/군을 선택하면 실시간 실황을 확인합니다",
    };
  }

  // 1. 적설/강수(PTY)
  if (weather.pty === 3 || weather.pty === 7) {
    return {
      status: "snow",
      icon: "❄️",
      title: "현재 눈 내리는 중",
      sub: `실시간 적설/강수량 ${weather.rn1 ?? 0}mm/h (${getPtyText(weather.pty)})`,
    };
  }
  if (weather.pty === 2 || weather.pty === 6) {
    return {
      status: "snow",
      icon: "🌨️",
      title: "현재 눈/비 내리는 중",
      sub: `실시간 강수량 ${weather.rn1 ?? 0}mm/h (${getPtyText(weather.pty)})`,
    };
  }
  if (weather.isRaining === 1 || weather.pty > 0 || (weather.rn1 ?? 0) > 0) {
    return {
      status: "rain",
      icon: "🌧️",
      title: "현재 비 내리는 중",
      sub: `실시간 강수량 ${weather.rn1 ?? 0}mm/h (${getPtyText(weather.pty)})`,
    };
  }

  // 2. 하늘 상태(SKY: 1 맑음, 3 구름많음, 4 흐림)
  const skyDesc = getSkyText(weather.sky);
  if (weather.sky === 4) {
    return {
      status: "cloudy",
      icon: "☁️",
      title: "현재 흐림",
      sub: `하늘 상태: ${skyDesc} · 비 오지 않음`,
    };
  }
  if (weather.sky === 3) {
    return {
      status: "partly_cloudy",
      icon: "⛅",
      title: "현재 구름 많음",
      sub: `하늘 상태: ${skyDesc} · 비 오지 않음`,
    };
  }

  return {
    status: "sunny",
    icon: "☀️",
    title: "현재 맑음",
    sub: `하늘 상태: ${skyDesc} · 쾌청함`,
  };
}

export function MapOverlay({
  selectedRegion,
  hoveredRegion,
  sidoCode,
  scale,

  onCloseDetail,
}: MapOverlayProps) {
  const weather = selectedRegion?.weather;
  const visual = selectedRegion
    ? getWeatherVisual(weather, selectedRegion.rainChance)
    : null;

  const [selectedPop, setSelectedPop] = useState<number | null>(null);

  useEffect(() => {
    if (weather?.kmaPop != null) {
      setSelectedPop(weather.kmaPop);
    } else if (!weather && selectedRegion?.stats) {
      const pops = Object.keys(selectedRegion.stats).map(Number).sort((a, b) => a - b);
      if (pops.length > 0) {
        // Find the closest available bucket to the region's average rainChance
        const target = selectedRegion.rainChance || 0;
        const closest = pops.reduce((prev, curr) => 
          Math.abs(curr - target) < Math.abs(prev - target) ? curr : prev
        );
        setSelectedPop(closest);
      } else {
        setSelectedPop(null);
      }
    } else {
      setSelectedPop(null);
    }
  }, [selectedRegion?.code, weather?.kmaPop, selectedRegion?.stats, selectedRegion?.rainChance]);

  const displayRate = selectedPop !== null && weather?.stats?.[selectedPop]
    ? Math.round(weather.stats[selectedPop].rate)
    : (weather?.empiricalRate != null ? Math.round(weather.empiricalRate) : null);
    
  const displaySamples = selectedPop !== null && weather?.stats?.[selectedPop]
    ? weather.stats[selectedPop].samples
    : (weather?.sampleCount ?? 0);

  return (
    <>
      {hoveredRegion && (
        <HoverTooltip role="tooltip" aria-hidden="true">
          <HoverPinIcon>📍</HoverPinIcon>
          <HoverName>{hoveredRegion.name}</HoverName>
        </HoverTooltip>
      )}

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

          {visual && (
            <LiveRainBanner $status={visual.status}>
              <RainIcon>{visual.icon}</RainIcon>
              <RainInfo>
                <RainTitle>{visual.title}</RainTitle>
                <RainSub>{visual.sub}</RainSub>
              </RainInfo>
            </LiveRainBanner>
          )}

          {weather && (
            <StatsGrid>
              <StatBox highlight>
                <StatLabelRow>
                  <StatLabel>단기예보 강수확률</StatLabel>
                </StatLabelRow>
                <StatVal highlight>
                  {weather.kmaPop != null ? `${weather.kmaPop}%` : "—"}
                </StatVal>
                <StatSubText>기상청 예보 (POP)</StatSubText>
              </StatBox>

              <StatBox>
                <StatLabelRow>
                  <StatLabel>구/군 실강수확률</StatLabel>
                  <PopSelect
                    value={selectedPop ?? ""}
                    onChange={(e) => setSelectedPop(Number(e.target.value))}
                    aria-label="예보 확률 기준 선택 (구/군)"
                  >
                    {weather.stats && Object.keys(weather.stats).length > 0 ? (
                      Object.keys(weather.stats).map((pop) => (
                        <option key={pop} value={pop}>
                          {pop}% 예보 시
                        </option>
                      ))
                    ) : (
                      <option value="">데이터 없음</option>
                    )}
                  </PopSelect>
                </StatLabelRow>
                <StatVal>
                  {displayRate != null ? `${displayRate}%` : "—"}
                </StatVal>
                <StatSubText>
                  {displaySamples > 0
                    ? `구/군 표본 ${displaySamples}건 검증`
                    : "표본 수집 중"}
                </StatSubText>
              </StatBox>
            </StatsGrid>
          )}

          {!weather && selectedRegion && (
            <StatsGrid>
              <StatBox style={{ gridColumn: "1 / -1" }}>
                <StatLabelRow>
                  <StatLabel>시/도 전체 실강수확률</StatLabel>
                  <PopSelect
                    value={selectedPop ?? ""}
                    onChange={(e) => setSelectedPop(Number(e.target.value))}
                    aria-label="예보 확률 기준 선택 (시/도)"
                  >
                    {selectedRegion.stats && Object.keys(selectedRegion.stats).length > 0 ? (
                      Object.keys(selectedRegion.stats).map((pop) => (
                        <option key={pop} value={pop}>
                          {pop}% 예보 시
                        </option>
                      ))
                    ) : (
                      <option value="">데이터 없음</option>
                    )}
                  </PopSelect>
                </StatLabelRow>
                <StatVal>
                  {selectedPop !== null && selectedRegion.stats?.[selectedPop]
                    ? `${Math.round(selectedRegion.stats[selectedPop].rate)}%`
                    : "—"}
                </StatVal>
                <StatSubText>
                  {selectedPop !== null && selectedRegion.stats?.[selectedPop]?.samples
                    ? `시/도 표본 ${selectedRegion.stats[selectedPop].samples}건 검증`
                    : "표본 수집 중"}
                </StatSubText>
              </StatBox>
            </StatsGrid>
          )}
        </DetailCard>
      ) : (
        <GuideBanner>
          {sidoCode !== undefined
            ? "구/군을 터치(클릭)하면 실시간 날씨를 확인합니다"
            : "시도를 터치(클릭)하여 지역으로 이동하세요"}
        </GuideBanner>
      )}

      <Legend aria-label="강수확률 범례">
        <span>0%</span>
        <LegendGradient />
        <span>100%</span>
      </Legend>

      <DebugReadout>
        <span>scale {scale.toFixed(2)}×</span>
      </DebugReadout>
    </>
  );
}

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

const bannerBorderMap: Record<WeatherStatus, string> = {
  rain: "rgba(96, 165, 250, 0.45)",
  snow: "rgba(192, 132, 252, 0.45)",
  cloudy: "rgba(148, 163, 184, 0.3)",
  partly_cloudy: "rgba(251, 191, 36, 0.35)",
  sunny: "rgba(245, 158, 11, 0.35)",
  summary: "rgba(148, 163, 184, 0.18)",
};

const bannerBgMap: Record<WeatherStatus, string> = {
  rain: "linear-gradient(135deg, rgba(30, 58, 138, 0.4), rgba(37, 99, 235, 0.2))",
  snow: "linear-gradient(135deg, rgba(88, 28, 135, 0.4), rgba(147, 51, 234, 0.2))",
  cloudy:
    "linear-gradient(135deg, rgba(51, 65, 85, 0.45), rgba(71, 85, 105, 0.25))",
  partly_cloudy:
    "linear-gradient(135deg, rgba(71, 85, 105, 0.4), rgba(217, 119, 6, 0.2))",
  sunny:
    "linear-gradient(135deg, rgba(120, 53, 15, 0.3), rgba(245, 158, 11, 0.18))",
  summary: "rgba(30, 41, 59, 0.45)",
};

// 지금 실제 비/눈/하늘 상태 실시간 배너
const LiveRainBanner = styled.div<{ $status: WeatherStatus }>`
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid ${(props) => bannerBorderMap[props.$status]};
  background: ${(props) => bannerBgMap[props.$status]};
`;

const RainIcon = styled.span`
  font-size: 2.2rem;
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

const StatLabelRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  
  min-height: 24px; 
`;

const StatLabel = styled.div`
  font-size: 0.68rem;
  font-weight: 600;
  color: #94a3b8;
  letter-spacing: -0.02em;
  white-space: nowrap;
`;

const PopSelect = styled.select`
  background: rgba(56, 189, 248, 0.15);
  color: #38bdf8;
  border: 1px solid rgba(56, 189, 248, 0.4);
  border-radius: 999px;
  font-size: 0.65rem;
  padding: 3px 8px;
  outline: none;
  cursor: pointer;
  transition: all 0.2s ease;
  margin-left: 6px;
  
  &:hover {
    background: rgba(56, 189, 248, 0.25);
    border-color: rgba(56, 189, 248, 0.6);
  }
  
  option {
    background: #0f172a;
    color: #e2e8f0;
  }
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
