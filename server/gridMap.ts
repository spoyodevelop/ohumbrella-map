import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export interface SigunguGrid {
  code: string;
  name: string;
  sidoCode: string;
  lat: number;
  lon: number;
  nx: number;
  ny: number;
}

export interface DistinctGrid {
  gridKey: string; // "nx,ny"
  nx: number;
  ny: number;
  sigunguCodes: string[];
}

// 기상청 LCC 표준 좌표 변환 (위경도 -> nx, ny)
export function latLonToGrid(lat: number, lon: number): { nx: number; ny: number } {
  const RE = 6371.00877; // 지구 반경(km)
  const GRID = 5.0; // 격자 간격(km)
  const SLAT1 = 30.0; // 투영 위도1(degree)
  const SLAT2 = 60.0; // 투영 위도2(degree)
  const OLON = 126.0; // 기준점 경도(degree)
  const OLAT = 38.0; // 기준점 위도(degree)
  const XO = 43; // 기준점 X좌표(GRID)
  const YO = 136; // 기준점 Y좌표(GRID)

  const DEGRAD = Math.PI / 180.0;
  const re = RE / GRID;
  const slat1 = SLAT1 * DEGRAD;
  const slat2 = SLAT2 * DEGRAD;
  const olon = OLON * DEGRAD;
  const olat = OLAT * DEGRAD;

  const sn =
    Math.log(Math.cos(slat1) / Math.cos(slat2)) /
    Math.log(
      Math.tan(Math.PI * 0.25 + slat2 * 0.5) /
        Math.tan(Math.PI * 0.25 + slat1 * 0.5),
    );
  let sf = Math.tan(Math.PI * 0.25 + slat1 * 0.5);
  sf = (Math.pow(sf, sn) * Math.cos(slat1)) / sn;
  let ro = Math.tan(Math.PI * 0.25 + olat * 0.5);
  ro = (re * sf) / Math.pow(ro, sn);

  let ra = Math.tan(Math.PI * 0.25 + lat * DEGRAD * 0.5);
  ra = (re * sf) / Math.pow(ra, sn);
  let theta = lon * DEGRAD - olon;
  if (theta > Math.PI) theta -= 2.0 * Math.PI;
  if (theta < -Math.PI) theta += 2.0 * Math.PI;
  theta *= sn;

  const nx = Math.floor(ra * Math.sin(theta) + XO + 0.5);
  const ny = Math.floor(ro - ra * Math.cos(theta) + YO + 0.5);
  return { nx, ny };
}

function loadSigunguGrids(): {
  sigunguList: SigunguGrid[];
  distinctGrids: DistinctGrid[];
} {
  const root = process.cwd();
  const topoPath = resolve(root, "public", "map-source", "korea-sigungu.topo.json");
  const topo = JSON.parse(readFileSync(topoPath, "utf8"));
  const { scale, translate } = topo.transform;

  const arcs = topo.arcs.map((arc: [number, number][]) => {
    let x = 0;
    let y = 0;
    return arc.map(([dx, dy]) => {
      x += dx;
      y += dy;
      return [x * scale[0] + translate[0], y * scale[1] + translate[1]];
    });
  });

  const joinRing = (indexes: number[]) =>
    indexes.flatMap((index, pos) => {
      const src = arcs[index < 0 ? ~index : index];
      const pts = index < 0 ? [...src].reverse() : src;
      return pos === 0 ? pts : pts.slice(1);
    });

  const obj = Object.values(topo.objects)[0] as {
    geometries: Array<{
      type: string;
      arcs: any;
      properties: { SIG_CD: string; SIG_KOR_NM: string };
    }>;
  };

  const sigunguList: SigunguGrid[] = obj.geometries.map((g) => {
    const rings =
      g.type === "Polygon"
        ? g.arcs.map(joinRing)
        : g.arcs.flatMap((p: number[][]) => p.map(joinRing));

    let maxRing = rings[0];
    for (const r of rings) {
      if (r.length > maxRing.length) maxRing = r;
    }

    let sumLon = 0;
    let sumLat = 0;
    for (const [lon, lat] of maxRing) {
      sumLon += lon;
      sumLat += lat;
    }
    const lon = sumLon / maxRing.length;
    const lat = sumLat / maxRing.length;
    const code = g.properties.SIG_CD;
    const name = g.properties.SIG_KOR_NM;
    const sidoCode = code.slice(0, 2);
    const { nx, ny } = latLonToGrid(lat, lon);

    return { code, name, sidoCode, lat, lon, nx, ny };
  });

  const gridMap = new Map<string, DistinctGrid>();
  for (const item of sigunguList) {
    const gridKey = `${item.nx},${item.ny}`;
    const existing = gridMap.get(gridKey);
    if (existing) {
      existing.sigunguCodes.push(item.code);
    } else {
      gridMap.set(gridKey, {
        gridKey,
        nx: item.nx,
        ny: item.ny,
        sigunguCodes: [item.code],
      });
    }
  }

  return {
    sigunguList,
    distinctGrids: Array.from(gridMap.values()),
  };
}

export const { sigunguList, distinctGrids } = loadSigunguGrids();
export const sigunguMap = new Map(sigunguList.map((s) => [s.code, s]));
