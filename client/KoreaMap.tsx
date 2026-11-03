import { useState } from "react";
import type { MapRegion } from "./types";
import { MapHeader } from "./components/map/MapHeader";
import { MapLayerSwitch } from "./components/map/MapLayerSwitch";
import { MapOverlay, type MapLayerKind } from "./components/map/MapOverlay";
import { MapSvg } from "./components/map/MapSvg";
import { MapToolbar } from "./components/map/MapToolbar";
import { surpriseRainColor, surpriseRainCount } from "./lib/surpriseRain";
import { useKoreaMap } from "./hooks/useKoreaMap";
import { useSurpriseRain } from "./hooks/useSurpriseRain";
import "./lib/region.css";
import { getRainStories, RainStories } from "./components/map/RainStories";
import { NeighborhoodFinder } from "./components/map/NeighborhoodFinder";
import { RainLadder } from "./components/map/RainLadder";
import { ForecastCalibration } from "./components/map/ForecastCalibration";
import { SurpriseRainPanel } from "./components/map/SurpriseRainPanel";
import { formatPeriod } from "./lib/formatTime";
import "./rain-page.css";

export function KoreaMap() {
  const mapState = useKoreaMap();
  const [searchMapError, setSearchMapError] = useState("");
  const [layer, setLayer] = useState<MapLayerKind>("surprise");
  const surpriseRain = useSurpriseRain(true);
  const sidoStats = Object.values(mapState.sidoStatsMap);
  const maxPop = surpriseRain.data?.maxPop ?? 20;
  const stories = getRainStories(surpriseRain.data, mapState.sidos);
  // Stories are newest first; prefer Seoul/Gyeonggi without filtering the national log.
  const featuredStory =
    stories.find((story) => /^(11|31)/.test(story.code)) ?? stories[0];
  function scrollToMap() {
    document.querySelector(".record-sidebar")?.scrollTo({ top: 0 });
    document.getElementById("rain-map")?.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
      block: "start",
    });
  }
  function showStory(code: string) {
    setSearchMapError("");
    setLayer("surprise");
    scrollToMap();
    void mapState.focusRegionByCode(code).catch(() => {
      setSearchMapError("지도를 불러오지 못했어요. 다시 선택해 주세요.");
    });
  }
  // 보이는 단계(시도/시군구) 안에서 가장 많은 곳을 진한 색 기준으로 삼는다.
  const surpriseMaxCount = mapState.regions.reduce(
    (max, region) =>
      Math.max(max, surpriseRainCount(surpriseRain.data, region.code)),
    0,
  );
  const fillOf =
    layer === "surprise"
      ? (region: MapRegion) =>
          surpriseRainColor(
            surpriseRainCount(surpriseRain.data, region.code),
            surpriseMaxCount,
          )
      : undefined;
  return (
    <main className="rain-page">
      <MapHeader
        story={featuredStory}
        data={surpriseRain.data}
        errorMessage={surpriseRain.errorMessage}
        onSelect={showStory}
      />
      <section
        id="rain-map"
        className="rain-explorer"
        aria-labelledby="map-heading"
      >
        <div className="explorer-heading">
          <div>
            <h2 id="map-heading">비가 안 온다고 한 것 같은데… 비가 왔네?</h2>
          </div>
          <MapLayerSwitch layer={layer} onChange={setLayer} />
        </div>
        {layer === "surprise" ? (
          <>
            <p className="map-description">
              강수확률이 {surpriseRain.data?.maxPop ?? 20}% 이하였는데 실제로
              비가 온 지역이에요.
            </p>
            <p className="record-period">
              {surpriseRain.data?.since && surpriseRain.data.until
                ? `${formatPeriod(surpriseRain.data.since, surpriseRain.data.until)} 기록`
                : surpriseRain.errorMessage
                  ? "기록 기간을 불러오지 못했어요."
                  : surpriseRain.data
                    ? "아직 기록된 기간이 없어요."
                    : "기록 기간을 불러오는 중이에요."}
            </p>
          </>
        ) : (
          <p className="record-period">
            기상청 단기예보 강수확률 · 실황 기준{" "}
            {mapState.weatherTime ?? "자료 불러오는 중"}
          </p>
        )}
        <div className="rain-workspace">
          <section
            className="map-stage"
            aria-label={
              layer === "surprise"
                ? "대한민국 아니 땐 비 기록 지도"
                : "대한민국 강수확률 지도"
            }
          >
            <MapToolbar
              onZoomIn={mapState.zoomIn}
              onZoomOut={mapState.zoomOut}
              onShowNational={mapState.showNationalMap}
            />

            {mapState.loading && <p className="map-state">지도 불러오는 중…</p>}
            {layer === "surprise" && !surpriseRain.data && (
              <p className="map-state" role="status">
                {surpriseRain.errorMessage
                  ? "비 기록을 불러오지 못했어요. 잠시 후 새로고침해 주세요."
                  : "비 기록을 불러오는 중…"}
              </p>
            )}
            {(mapState.error || searchMapError) && (
              <p className="map-state map-error" role="status">
                {searchMapError ||
                  `데이터를 읽지 못했습니다. (${mapState.error})`}
              </p>
            )}

            <MapSvg
              svgRef={mapState.svgRef}
              regions={mapState.regions}
              isDragging={mapState.isDragging}
              isWheelZooming={mapState.isWheelZooming}
              sidoCode={mapState.sidoCode}
              sigunguCode={mapState.sigunguCode}
              currentSidoName={mapState.currentSido?.name}
              onPointerDown={mapState.handlePointerDown}
              onPointerMove={mapState.handlePointerMove}
              onPointerUp={mapState.handlePointerUp}
              onBackgroundClick={() => {
                if (mapState.sigunguCode !== undefined) {
                  mapState.clearSelection();
                } else if (mapState.sidoCode !== undefined) {
                  mapState.showNationalMap();
                }
              }}
              fillOf={fillOf}
              onRegionSelect={(region) => {
                setSearchMapError("");
                mapState.selectRegion(region);
              }}
            />

            {layer === "pop" && (
              <MapOverlay
                key={mapState.selectedRegion?.code ?? "no-selection"}
                selectedRegion={mapState.selectedRegion}
                sidoCode={mapState.sidoCode}
                scale={mapState.view.scale}
                isSimgunguLod={mapState.sidoCode !== undefined}
                onCloseDetail={mapState.clearSelection}
                layer={layer}
                surpriseRain={surpriseRain.data}
                surpriseRainError={surpriseRain.errorMessage}
                surpriseMaxCount={surpriseMaxCount}
              />
            )}
            {layer === "surprise" && surpriseRain.data && (
              <div className="map-record-legend">
                <span>기록 없음</span>
                <span className="map-color-scale" />
                <span>많음</span>
              </div>
            )}
            {layer === "surprise" && (
              <p className="map-hint">
                {mapState.currentSido
                  ? `${mapState.currentSido.name} · 구/군을 선택해 보세요`
                  : "지역을 눌러 그 동네의 기록을 살펴보세요"}
              </p>
            )}
          </section>
          <div className="record-sidebar">
            {layer === "surprise" && mapState.selectedRegion ? (
              <section className="selected-record" aria-live="polite">
                <div className="selected-heading">
                  <h3>{mapState.selectedRegion.name}</h3>
                  <button
                    onClick={mapState.clearSelection}
                    aria-label="지역 선택 해제"
                  >
                    닫기 ×
                  </button>
                </div>
                <SurpriseRainPanel
                  data={surpriseRain.data}
                  errorMessage={surpriseRain.errorMessage}
                  selectedRegion={mapState.selectedRegion}
                />
                <button
                  className="all-records"
                  onClick={mapState.showNationalMap}
                >
                  전국 기록으로 돌아가기 ↗
                </button>
              </section>
            ) : (
              <NeighborhoodFinder
                onSelect={showStory}
                onLocate={() => {
                  setSearchMapError("");
                  scrollToMap();
                  void mapState.locateUser();
                }}
                isLocating={mapState.isLocating}
              />
            )}
            <RainStories
              stories={stories}
              loading={!surpriseRain.data}
              errorMessage={surpriseRain.errorMessage}
              onSelect={showStory}
              selectedCode={mapState.sigunguCode}
            />
          </div>
        </div>
      </section>
      <footer className="rain-footer">
        <RainLadder stats={sidoStats} maxPop={maxPop} />
        <ForecastCalibration stats={sidoStats} maxPop={maxPop} />
        <p>자료제공 및 출처: 기상청 단기예보 · 초단기실황</p>
      </footer>
    </main>
  );
}
