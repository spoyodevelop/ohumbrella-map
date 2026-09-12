import styled from "@emotion/styled";
import { MapHeader } from "./components/map/MapHeader";
import { MapOverlay } from "./components/map/MapOverlay";
import { MapSvg } from "./components/map/MapSvg";
import { MapToolbar } from "./components/map/MapToolbar";
import { useKoreaMap } from "./hooks/useKoreaMap";
import "./lib/region.css";

export function KoreaMap() {
  const map = useKoreaMap();

  return (
    <Shell>
      <MapHeader currentSido={map.currentSido} />

      <Stage aria-label="대한민국 행정구역 강수 확률 지도">
        <MapToolbar
          onZoomIn={map.zoomIn}
          onZoomOut={map.zoomOut}
          onShowNational={map.showNationalMap}
        />

        {map.loading && <LoadState>지도 불러오는 중…</LoadState>}
        {map.error && (
          <LoadError>지도 경계를 읽지 못했습니다. ({map.error})</LoadError>
        )}

        <MapSvg
          svgRef={map.svgRef}
          regions={map.regions}
          view={map.view}
          isDragging={map.isDragging}
          isPinching={map.isPinching}
          sidoCode={map.sidoCode}
          sigunguCode={map.sigunguCode}
          currentSidoName={map.currentSido?.name}
          onPointerDown={map.handlePointerDown}
          onPointerMove={map.handlePointerMove}
          onPointerUp={map.handlePointerUp}
          onBackgroundClick={() => {
            if (map.sidoCode !== undefined) map.showNationalMap();
          }}
          onRegionEnter={map.handleRegionEnter}
          onRegionLeave={map.handleRegionLeave}
          onRegionSelect={map.selectRegion}
        />

        <MapOverlay
          activeRegion={map.activeRegion}
          sidoCode={map.sidoCode}
          scale={map.view.scale}
          isSimgunguLod={map.sidoCode !== undefined}
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
