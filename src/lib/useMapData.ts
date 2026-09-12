import { useEffect, useState } from 'react'
import { loadRegionFile, sidoFile, sigunguFile } from './mapData'
import type { MapRegion } from '../types'

export function useMapData(sidoCode: string | undefined) {
  const [sidos, setSidos] = useState<MapRegion[]>([])
  const [sigunguCache, setSigunguCache] = useState<Record<string, MapRegion[]>>({})
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    loadRegionFile(sidoFile)
      .then((regions) => { if (active) setSidos(regions) })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : String(reason))
      })
    return () => { active = false }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/exhaustive-deps
    if (sidoCode === undefined || sidoCode in sigunguCache) return
    let active = true
    loadRegionFile(sigunguFile(sidoCode))
      .then((regions) => {
        if (active) setSigunguCache((prev) => ({ ...prev, [sidoCode]: regions }))
      })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : String(reason))
      })
    return () => { active = false }
  }, [sidoCode]) // eslint-disable-line react-hooks/exhaustive-deps

  return {
    sidos,
    sigungu: sidoCode !== undefined ? (sigunguCache[sidoCode] ?? []) : [],
    loading: sidos.length === 0 || (sidoCode !== undefined && !(sidoCode in sigunguCache)),
    error,
    preloadSigungu: (code: string): Promise<MapRegion[]> => {
      if (code in sigunguCache) return Promise.resolve(sigunguCache[code]!)
      return loadRegionFile(sigunguFile(code)).then((regions) => {
        setSigunguCache((prev) => ({ ...prev, [code]: regions }))
        return regions
      })
    },
  }
}
