export type MapPoint = { x: number; y: number }

export type MapView = {
  x: number
  y: number
  scale: number
}

export type MapRegion = {
  code: string
  name: string
  path: string
  rainChance: number
  bounds: [number, number, number, number]
  label: { x: number; y: number }
}
