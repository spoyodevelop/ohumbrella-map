import type { MapRegion } from '../types'

const cache = new Map<string, Promise<MapRegion[]>>()

export function loadRegionFile(url: string): Promise<MapRegion[]> {
  const cached = cache.get(url)
  if (cached) return cached

  const request = fetch(url).then(async (response) => {
    if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`)
    return response.json() as Promise<MapRegion[]>
  })

  cache.set(url, request)
  return request
}

export const sidoFile = '/map/sido.json'
export const sigunguFile = (sidoCode: string) => `/map/sigungu/${sidoCode}.json`
