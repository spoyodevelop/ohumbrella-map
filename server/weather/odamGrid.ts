import type { SigunguGrid } from "./gridMap.ts";

// KMA (20240305) 동네예보 격자영역 정보: left to right, bottom to top.
export const ODAM_WIDTH = 149;
export const ODAM_HEIGHT = 253;

export function parseOdamPty(text: string): Array<number | null> {
  const tokens = text
    .trim()
    .split(/[,\s]+/)
    .filter(Boolean);
  if (tokens.length !== ODAM_WIDTH * ODAM_HEIGHT) {
    throw new Error(`실황 격자 개수 오류: ${tokens.length}`);
  }
  return tokens.map((token) => {
    const value = Number(token);
    if (value === -99) return null;
    if (!Number.isInteger(value) || ![0, 1, 2, 3, 5, 6, 7].includes(value)) {
      throw new Error("실황 강수형태 값 오류");
    }
    return value;
  });
}

export function odamGridIndex(nx: number, ny: number): number {
  if (
    !Number.isInteger(nx) ||
    !Number.isInteger(ny) ||
    nx < 1 ||
    nx > ODAM_WIDTH ||
    ny < 1 ||
    ny > ODAM_HEIGHT
  ) {
    throw new Error(`실황 격자 좌표 범위 오류: ${nx},${ny}`);
  }
  return (ny - 1) * ODAM_WIDTH + nx - 1;
}

export function mapOdamPty(text: string, grids: readonly SigunguGrid[]) {
  const values = parseOdamPty(text);
  return grids.map(({ code, name, nx, ny }) => {
    const pty = values[odamGridIndex(nx, ny)]!;
    return {
      code,
      name,
      nx,
      ny,
      pty,
      hasPrecipitation: pty === null ? null : pty > 0,
    };
  });
}
