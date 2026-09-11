import './KoreaMap.css'
import { useKoreaMap } from './useKoreaMap'
import type { MapRegion } from './types'

const VIEW_BOX = '0 0 780 900'

function chanceColor(chance: number) {
  return `hsl(211 ${35 + chance * 0.45}% ${78 - chance * 0.42}%)`
}

function RegionPath({
  region,
  selected,
  onEnter,
  onLeave,
  onSelect,
}: {
  region: MapRegion
  selected: boolean
  onEnter: () => void
  onLeave: () => void
  onSelect: () => void
}) {
  return (
    <path
      d={region.path}
      fill={chanceColor(region.rainChance)}
      className={selected ? 'region is-selected' : 'region'}
      vectorEffect="non-scaling-stroke"
      onPointerEnter={onEnter}
      onPointerLeave={onLeave}
      onClick={onSelect}
    >
      <title>{region.name} · 강수확률 {region.rainChance}%</title>
    </path>
  )
}

function RegionLabel({ region, scale }: { region: MapRegion; scale: number }) {
  return (
    <text
      className="region-label"
      transform={`translate(${region.label.x},${region.label.y}) scale(${scale})`}
      pointerEvents="none"
    >
      {region.name}
    </text>
  )
}

export function KoreaMap() {
  const {
    svgRef,
    regions,
    activeRegion,
    currentSido,
    selectedSido,
    selectedCode,
    view,
    isDragging,
    isPinching,
    loading,
    error,
    zoomIn,
    zoomOut,
    showNationalMap,
    selectRegion,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handleRegionEnter,
    handleRegionLeave,
  } = useKoreaMap()

  return (
    <main className="prototype-shell">
      <header className="prototype-header">
        <div>
          <p className="eyebrow">OH UMBRELLA / MAP SPIKE</p>
          <h1>{currentSido?.name ?? '전국'} 강수 확률</h1>
        </div>
        <div className="status" aria-live="polite">
          <strong>{regions.length || '—'}</strong> visible · LOD
        </div>
      </header>

      <section className="map-stage" aria-label="대한민국 행정구역 강수 확률 지도">
        <div className="map-toolbar" aria-label="지도 확대 축소">
          <button type="button" onClick={zoomIn} aria-label="확대">+</button>
          <button type="button" onClick={zoomOut} aria-label="축소">−</button>
          <button type="button" onClick={showNationalMap}>전국</button>
        </div>

        {loading ? <p className="load-state">지도 불러오는 중…</p> : null}
        {error ? <p className="load-error">지도 경계를 읽지 못했습니다. ({error})</p> : null}

        <svg
          ref={svgRef}
          className="korea-map"
          viewBox={VIEW_BOX}
          role="img"
          aria-label={selectedSido ? `${currentSido?.name} 시군구 지도` : '대한민국 시도 지도'}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        >
          <rect
            className="map-background"
            width="780"
            height="900"
            onClick={() => {
              if (selectedSido) showNationalMap()
            }}
          />
          <g
            className={[
              'map-layer',
              isDragging && 'is-dragging',
              isPinching && 'is-pinching',
            ]
              .filter(Boolean)
              .join(' ')}
            style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})` }}
          >
            {regions.map((region) => (
              <RegionPath
                key={region.code}
                region={region}
                selected={region.code === selectedCode}
                onEnter={() => handleRegionEnter(region)}
                onLeave={handleRegionLeave}
                onSelect={() => selectRegion(region)}
              />
            ))}
          </g>
          {/* 레이블은 CSS transition 없이 React state와 즉시 동기화 */}
          <g
            className="label-layer"
            style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})` }}
          >
            {regions.map((region) => (
              <RegionLabel
                key={region.code}
                region={region}
                scale={1 / view.scale}
              />
            ))}
          </g>
        </svg>

        <aside className="region-readout" aria-live="polite">
          <span>{activeRegion?.name ?? (selectedSido ? '시군구를 가리켜 보세요' : '시도를 선택하세요')}</span>
          <strong>{activeRegion ? `${activeRegion.rainChance}%` : '—'}</strong>
        </aside>

        <div className="legend" aria-label="강수확률 범례">
          <span>0%</span>
          <div className="legend-gradient" />
          <span>100%</span>
        </div>

        <div className="debug-readout">
          <span>scale {view.scale.toFixed(2)}×</span>
          <span>{selectedSido ? 'sigungu LOD' : 'sido LOD'}</span>
        </div>
      </section>
    </main>
  )
}
