import { useEffect, useState } from 'react'
import { loadRegionFile, sidoFile, sigunguFile } from './mapData'
import type { MapRegion } from './types'

export function useMapData(selectedSido: string | null) {
  const [sidos, setSidos] = useState<MapRegion[]>([])
  const [sigungu, setSigungu] = useState<MapRegion[]>([])
  const [loadedSido, setLoadedSido] = useState<string | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    loadRegionFile(sidoFile)
      .then((regions) => {
        if (active) setSidos(regions)
      })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : String(reason))
      })
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (!selectedSido) return

    let active = true
    loadRegionFile(sigunguFile(selectedSido))
      .then((regions) => {
        if (active) {
          setSigungu(regions)
          setLoadedSido(selectedSido)
        }
      })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : String(reason))
      })
    return () => { active = false }
  }, [selectedSido])

  return {
    sidos,
    sigungu: loadedSido === selectedSido ? sigungu : [],
    loading: sidos.length === 0 || (selectedSido !== null && loadedSido !== selectedSido),
    error,
    preloadSigungu: (sidoCode: string) => loadRegionFile(sigunguFile(sidoCode)),
  }
}
