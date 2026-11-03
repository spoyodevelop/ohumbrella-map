import type { MapRegion, RegionWeatherInfo } from "../../types";
import styled from "@emotion/styled";
import { useState } from "react";
import type { SurpriseRainResponse } from "../../api/surpriseRain";
import { SurpriseRainLegend, SurpriseRainPanel } from "./SurpriseRainPanel";

export type MapLayerKind = "pop" | "surprise";

interface MapOverlayProps {
  selectedRegion: MapRegion | undefined;
  sidoCode: string | undefined;
  scale: number;
  isSimgunguLod?: boolean;
  onCloseDetail?: () => void;
  layer?: MapLayerKind;
  surpriseRain?: SurpriseRainResponse | null;
  surpriseRainError?: string;
  surpriseMaxCount?: number;
}

type WeatherStatus = "rain" | "snow" | "summary";

interface WeatherVisual {
  status: WeatherStatus;
  icon: string;
  title: string;
  sub: string;
  sourceLabel?: string;
}

function getWeatherVisual(weather?: RegionWeatherInfo): WeatherVisual {
  if (!weather) {
    return {
      status: "summary",
      icon: "📍",
      title: "지역을 선택해 주세요",
      sub: "구/군을 선택하면 기온과 강수 실황을 확인합니다",
    };
  }

  const observedAt = Date.parse(`${weather.time.replace(" ", "T")}+09:00`);
  const elapsed = Date.now() - observedAt;
  const isStale =
    weather.isStale ||
    !Number.isFinite(observedAt) ||
    elapsed >= 2 * 60 * 60 * 1000;
  const timeLabel = `${weather.time} 기준 실황 · 매시간 갱신`;
  if (isStale) {
    return {
      status: "summary",
      icon: "🕒",
      title: "실황 갱신 지연",
      sub: `${timeLabel} · 최신 자료 대기 중`,
    };
  }

  const precipitation: Record<
    number,
    { status: WeatherStatus; icon: string; text: string }
  > = {
    0: { status: "summary", icon: "🌂", text: "강수 없음" },
    1: { status: "rain", icon: "🌧️", text: "비" },
    2: { status: "snow", icon: "🌨️", text: "비/눈" },
    3: { status: "snow", icon: "❄️", text: "눈" },
    4: { status: "rain", icon: "🌧️", text: "소나기" },
    5: { status: "rain", icon: "💧", text: "빗방울" },
    6: { status: "snow", icon: "🌨️", text: "빗방울/눈날림" },
    7: { status: "snow", icon: "❄️", text: "눈날림" },
  };
  const current =
    weather.pty === 0 && weather.rn1 > 0
      ? { status: "rain" as const, icon: "💧", text: "강수 있음" }
      : precipitation[weather.pty];
  const skyVisual: Record<number, { icon: string; title: string }> = {
    1: { icon: "☀️", title: "맑음" },
    3: { icon: "⛅", title: "구름 많음" },
    4: { icon: "☁️", title: "흐림" },
  };
  // 실황에 강수가 없으면 예보의 하늘 상태를 카드의 대표 상태로 보여준다.
  const sky = weather.sky == null ? undefined : skyVisual[weather.sky];
  if (weather.pty === 0 && weather.rn1 === 0 && sky) {
    return {
      status: "summary",
      icon: sky.icon,
      title: sky.title,
      sourceLabel: "하늘 상태: 단기예보 · 강수 없음: 실황",
      sub: timeLabel,
    };
  }
  return {
    status: current?.status ?? "summary",
    icon: current?.icon ?? "🌡️",
    title: current ? `현재 ${current.text}` : "강수형태 자료 없음",
    sub: timeLabel,
  };
}

function getDefaultPop(selectedRegion?: MapRegion): number | null {
  const weather = selectedRegion?.weather;
  if (weather?.kmaPop != null) return weather.kmaPop;
  if (weather || !selectedRegion?.stats) return null;

  const pops = Object.keys(selectedRegion.stats)
    .map(Number)
    .sort((a, b) => a - b);
  if (pops.length === 0) return null;

  const target = selectedRegion.rainChance || 0;
  return pops.reduce((previous, current) =>
    Math.abs(current - target) < Math.abs(previous - target)
      ? current
      : previous,
  );
}

export function MapOverlay({
  selectedRegion,
  sidoCode,

  onCloseDetail,
  layer = "pop",
  surpriseRain = null,
  surpriseRainError = "",
  surpriseMaxCount = 0,
}: MapOverlayProps) {
  const isSurprise = layer === "surprise";
  const weather = selectedRegion?.weather;
  const visual = selectedRegion ? getWeatherVisual(weather) : null;

  const [userPop, setUserPop] = useState<number | null>(null);
  const selectedPop = userPop ?? getDefaultPop(selectedRegion);

  const displayRate =
    selectedPop !== null && weather?.stats?.[selectedPop]
      ? Math.round(weather.stats[selectedPop].rate)
      : weather?.empiricalRate != null
        ? Math.round(weather.empiricalRate)
        : null;

  const displaySamples =
    selectedPop !== null && weather?.stats?.[selectedPop]
      ? weather.stats[selectedPop].samples
      : (weather?.sampleCount ?? 0);

  return (
    <>
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

          {!isSurprise && visual && (
            <LiveRainBanner $status={visual.status}>
              <RainIcon>{visual.icon}</RainIcon>
              <RainInfo>
                <RainTitle>{visual.title}</RainTitle>
                {visual.sourceLabel && <RainSub>{visual.sourceLabel}</RainSub>}
                <RainSub>{visual.sub}</RainSub>
              </RainInfo>
            </LiveRainBanner>
          )}

          {isSurprise && (
            <SurpriseRainPanel
              data={surpriseRain}
              errorMessage={surpriseRainError}
              selectedRegion={selectedRegion}
            />
          )}

          {!isSurprise && weather && (
            <StatsGrid>
              <StatBox>
                <StatLabelRow>
                  <StatLabel>단기예보 강수확률</StatLabel>
                </StatLabelRow>
                <StatVal>
                  {weather.kmaPop != null ? `${weather.kmaPop}%` : "—"}
                </StatVal>
                <StatSubText>
                  {weather.kmaPop == null
                    ? "예보 자료 없음"
                    : "기상청 단기예보 (POP)"}
                </StatSubText>
              </StatBox>

              <StatBox record>
                <StatLabelRow>
                  <StatLabel>구/군 실강수확률</StatLabel>
                  <PopSelect
                    value={selectedPop ?? ""}
                    onChange={(e) => setUserPop(Number(e.target.value))}
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
                <StatVal record>
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

          {!isSurprise && !weather && selectedRegion && (
            <StatsGrid>
              <StatBox record style={{ gridColumn: "1 / -1" }}>
                <StatLabelRow>
                  <StatLabel>시/도 전체 실강수확률</StatLabel>
                  <PopSelect
                    value={selectedPop ?? ""}
                    onChange={(e) => setUserPop(Number(e.target.value))}
                    aria-label="예보 확률 기준 선택 (시/도)"
                  >
                    {selectedRegion.stats &&
                    Object.keys(selectedRegion.stats).length > 0 ? (
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
                <StatVal record>
                  {selectedPop !== null && selectedRegion.stats?.[selectedPop]
                    ? `${Math.round(selectedRegion.stats[selectedPop].rate)}%`
                    : "—"}
                </StatVal>
                <StatSubText>
                  {selectedPop !== null &&
                  selectedRegion.stats?.[selectedPop]?.samples
                    ? `시/도 표본 ${selectedRegion.stats[selectedPop].samples}건 검증`
                    : "표본 수집 중"}
                </StatSubText>
              </StatBox>
            </StatsGrid>
          )}
        </DetailCard>
      ) : (
        <GuideBanner>
          {isSurprise
            ? `예보 강수확률 ${surpriseRain?.maxPop ?? 20}% 이하였는데 비가 온 시간을 칠했어요`
            : sidoCode !== undefined
              ? "구/군을 터치(클릭)하면 실시간 날씨를 확인합니다"
              : "시도를 터치(클릭)하여 지역으로 이동하세요"}
        </GuideBanner>
      )}

      {isSurprise ? (
        <Legend aria-label="아니 땐 비 범례">
          <SurpriseRainLegend maxCount={surpriseMaxCount} />
        </Legend>
      ) : (
        <Legend aria-label="강수확률 범례">
          <span>0%</span>
          <LegendGradient />
          <span>100%</span>
        </Legend>
      )}
    </>
  );
}

const DetailCard = styled.aside`
  position: absolute;
  z-index: 2;
  top: 72px;
  left: 16px;
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 12px;
  min-width: 250px;
  max-width: 320px;
  box-sizing: border-box;
  padding: 16px;
  border: 1px solid rgba(56, 189, 248, 0.28);
  border-radius: 14px;
  color: #526052;
  background: #fffdf6;

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
    top: 200px;
    left: 12px;
    right: 12px;
    max-height: 260px;
    overflow-y: auto;
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
  color: #19251e;
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
  color: #526052;
  font-size: 0.8rem;
  cursor: pointer;
  transition: all 0.15s ease;

  &:hover {
    background: rgba(255, 255, 255, 0.18);
    color: #19251e;
  }
`;

const TempBadge = styled.span`
  font-size: 0.78rem;
  font-weight: 600;
  color: #1752de;
  background: rgba(56, 189, 248, 0.14);
  padding: 2px 8px;
  border-radius: 6px;
`;

const bannerBorderMap: Record<WeatherStatus, string> = {
  rain: "rgba(96, 165, 250, 0.45)",
  snow: "rgba(192, 132, 252, 0.45)",
  summary: "rgba(148, 163, 184, 0.18)",
};

const bannerBgMap: Record<WeatherStatus, string> = {
  rain: "#e2ecff",
  snow: "#eee3ff",
  summary: "#edf2f6",
};

// 기온과 강수형태를 제공하는 실황 카드
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
  color: #19251e;
`;

const RainSub = styled.div`
  font-size: 0.7rem;
  color: #526052;
`;

const StatsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  margin-top: 2px;
`;

// Amber marks 아 맞다 우산's own records; KMA forecasts stay neutral.
const StatBox = styled.div<{ record?: boolean }>`
  min-width: 0;
  padding: 10px 12px;
  border-radius: 10px;
  background: ${(props) =>
    props.record ? "rgb(var(--record-rgb) / 0.08)" : "#edf2f6"};
  border: 1px solid
    ${(props) =>
      props.record ? "rgb(var(--record-rgb) / 0.32)" : "rgba(51, 65, 85, 0.3)"};
`;

const StatLabelRow = styled.div`
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 4px 6px;
  min-height: 24px;
`;

const StatLabel = styled.div`
  font-size: 0.68rem;
  font-weight: 600;
  color: #526052;
  letter-spacing: -0.02em;
  white-space: nowrap;
`;

const PopSelect = styled.select`
  background: rgb(var(--record-rgb) / 0.12);
  color: var(--record);
  border: 1px solid rgb(var(--record-rgb) / 0.4);
  border-radius: 999px;
  font-size: 0.65rem;
  padding: 3px 8px;
  outline: none;
  cursor: pointer;
  transition: all 0.2s ease;
  max-width: 100%;

  &:hover {
    background: rgb(var(--record-rgb) / 0.22);
    border-color: rgb(var(--record-rgb) / 0.6);
  }

  option {
    background: #0f172a;
    color: #e2e8f0;
  }
`;

const StatVal = styled.div<{ record?: boolean }>`
  font-size: ${(props) => (props.record ? "1.7rem" : "1.3rem")};
  font-weight: 800;
  line-height: 1.15;
  color: ${(props) => (props.record ? "var(--record)" : "#19251e")};
`;

const StatSubText = styled.div`
  font-size: 0.62rem;
  color: #526052;
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
  color: #526052;
  background: #fffdf6;

  pointer-events: none;

  @media (max-width: 640px) {
    top: 12px;
    left: 12px;
    font-size: 0.74rem;
    padding: 6px 10px;
    max-width: calc(100% - 130px);
  }
`;

const Legend = styled.div`
  position: absolute;
  right: 18px;
  bottom: 18px;
  display: flex;
  align-items: center;
  gap: 8px;
  color: #526052;
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
