import styled from "@emotion/styled";
import { MapHeader } from "./components/map/MapHeader";
import { MapOverlay } from "./components/map/MapOverlay";
import { MapSvg } from "./components/map/MapSvg";
import { MapToolbar } from "./components/map/MapToolbar";
import { useKoreaMap } from "./hooks/useKoreaMap";
import "./lib/region.css";

export function KoreaMap() {
  const mapState = useKoreaMap();

  return (
    <Shell>
      <MapHeader
        currentSido={mapState.currentSido}
        weatherTime={mapState.weatherTime}
      />

      <Stage aria-label="대한민국 행정구역 강수 확률 지도">
        <MapToolbar
          onZoomIn={mapState.zoomIn}
          onZoomOut={mapState.zoomOut}
          onShowNational={mapState.showNationalMap}
          onLocate={mapState.locateUser}
          isLocating={mapState.isLocating}
        />

        {mapState.loading && <LoadState>지도 불러오는 중…</LoadState>}
        {mapState.error && (
          <LoadError>데이터를 읽지 못했습니다. ({mapState.error})</LoadError>
        )}

        <MapSvg
          svgRef={mapState.svgRef}
          regions={mapState.regions}
          isDragging={mapState.isDragging}
          isPinching={mapState.isPinching}
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
          onRegionSelect={mapState.selectRegion}
        />

        <MapOverlay
          key={mapState.selectedRegion?.code ?? "no-selection"}
          selectedRegion={mapState.selectedRegion}
          sidoCode={mapState.sidoCode}
          scale={mapState.view.scale}
          isSimgunguLod={mapState.sidoCode !== undefined}
          onCloseDetail={mapState.clearSelection}
        />

      </Stage>
    </Shell>
  );
}

const Shell = styled.main`
  width: min(100%, 1080px);
  min-height: 100svh;
  margin: 0 auto;
  padding: 28px;
  box-sizing: border-box;

  @media (max-width: 640px) {
    padding: 16px;
  }
`;

const Stage = styled.section`
  position: relative;
  height: min(78svh, 880px);
  min-height: 560px;
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

  @media (max-width: 640px) {
    height: calc(100svh - 110px);
    min-height: 520px;
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
