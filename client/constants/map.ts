export const MAP_WIDTH = 780;
export const MAP_HEIGHT = 900;
export const MAP_PADDING = 28;

export const MAP_VIEWBOX = `0 0 ${MAP_WIDTH} ${MAP_HEIGHT}` as const;

export const MAP_CENTER = {
  x: MAP_WIDTH / 2,
  y: MAP_HEIGHT / 2,
} as const;
