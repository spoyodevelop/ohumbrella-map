import { useState } from "react";
import type { CommutePlace } from "../shared/commute";
import type { PlaceTarget } from "./components/commute/CommuteSettings";
import { useCommuteSettings } from "./hooks/useCommuteSettings";
import { CommuteSettings } from "./components/commute/CommuteSettings";
import styled from "@emotion/styled";
import { MapHeader } from "./components/map/MapHeader";
import { MapOverlay } from "./components/map/MapOverlay";
import { MapSvg } from "./components/map/MapSvg";
import { MapToolbar } from "./components/map/MapToolbar";
import { useKoreaMap } from "./hooks/useKoreaMap";
import "./lib/region.css";

export function KoreaMap() {
  const mapState = useKoreaMap();
  const commute = useCommuteSettings();
  const [activePlace, setActivePlace] = useState<PlaceTarget | null>(null);
  const [hideDetails, setHideDetails] = useState(false);
  const [searchMapError, setSearchMapError] = useState("");
  function choosePlace(key: PlaceTarget, place: CommutePlace) {
    setSearchMapError("");
    commute.setDraft((s) => ({ ...s, [key]: place }));
    setActivePlace(null);
    setHideDetails(true);
  }

  return (
    <Shell>
      <MapHeader
        currentSido={mapState.currentSido}
        weatherTime={mapState.weatherTime}
      />

      <Workspace>
        <Stage aria-label="대한민국 행정구역 강수 확률 지도">
          <MapToolbar
            onZoomIn={mapState.zoomIn}
            onZoomOut={mapState.zoomOut}
            onShowNational={mapState.showNationalMap}
            onLocate={mapState.locateUser}
            isLocating={mapState.isLocating}
          />

          {mapState.loading && <LoadState>지도 불러오는 중…</LoadState>}
          {(mapState.error || searchMapError) && (
            <LoadError role="status">
              {searchMapError ||
                `데이터를 읽지 못했습니다. (${mapState.error})`}
            </LoadError>
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
            onRegionSelect={(region) => {
              if (!mapState.selectRegion(region)) return;
              if (activePlace && region.code.length === 5) {
                choosePlace(activePlace, {
                  code: region.code,
                  name: `${mapState.currentSido?.name ?? ""} ${region.name}`.trim(),
                });
              } else if (!activePlace) setHideDetails(false);
            }}
          />

          {!activePlace && !hideDetails && (
            <MapOverlay
              key={mapState.selectedRegion?.code ?? "no-selection"}
              selectedRegion={mapState.selectedRegion}
              sidoCode={mapState.sidoCode}
              scale={mapState.view.scale}
              isSimgunguLod={mapState.sidoCode !== undefined}
              onCloseDetail={mapState.clearSelection}
            />
          )}
        </Stage>
        <CommuteSettings
          settings={commute}
          activePlace={activePlace}
          onActivate={setActivePlace}
          onChoose={(key, place) => {
            choosePlace(key, place);
            void mapState.focusRegionByCode(place.code).catch(() => {
              setSearchMapError("장소는 설정했지만 지도를 불러오지 못했어요.");
            });
          }}
        />
      </Workspace>
    </Shell>
  );
}

const Shell = styled.main`
  width: min(100%, 1600px);
  min-height: 100svh;
  margin: 0 auto;
  padding: 28px;
  box-sizing: border-box;

  @media (max-width: 640px) {
    padding: 16px;
  }
`;

const Workspace = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 3fr) minmax(0, 1fr);
  gap: 20px;
  height: min(78svh, 880px);
  min-height: 560px;

  @media (max-width: 900px) {
    grid-template-columns: minmax(0, 1fr);
    gap: 12px;
    height: auto;
    min-height: 0;
  }
`;

const Stage = styled.section`
  position: relative;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  border: 1px solid #242a35;
  border-radius: 14px;
  background: radial-gradient(
    circle at 50% 48%,
    #171d28 0,
    #0d1118 52%,
    #080a0f 100%
  );
  box-shadow: 0 22px 70px rgb(0 0 0 / 0.35);

  @media (max-width: 900px) {
    grid-row: 2;
    height: 65svh;
    min-height: 460px;
    border-radius: 10px;
  }
`;

const LoadState = styled.p`
  position: absolute;
  z-index: 3;
  inset: 50% auto auto 50%;
  transform: translate(-50%, -50%);
  margin: 0;
  padding: 8px 12px;
  border: 1px solid #303847;
  border-radius: 8px;
  color: #cbd5e1;
  background: rgb(14 18 26 / 0.84);
`;

const LoadError = styled.p`
  position: absolute;
  inset: 50% auto auto 50%;
  transform: translate(-50%, -50%);
  color: #ff8f8f;
`;
