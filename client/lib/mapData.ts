import type { MapRegion } from '../types'
import { fetchJson } from './http'

const cache = new Map<string, Promise<MapRegion[]>>()

export function loadRegionFile(url: string): Promise<MapRegion[]> {
  const cached = cache.get(url)
  if (cached) return cached

  const request = fetchJson<MapRegion[]>(url)

  cache.set(url, request)
  return request
}

export const sidoFile = '/map/sido.json'
export const sigunguFile = (sidoCode: string) => `/map/sigungu/${sidoCode}.json`
