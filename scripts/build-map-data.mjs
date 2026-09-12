import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  MAP_HEIGHT,
  MAP_PADDING,
  MAP_WIDTH,
} from "../src/constants/map.ts";

const root = process.cwd();

function decode(topology) {
  const { scale, translate } = topology.transform;
  const arcs = topology.arcs.map((arc) => {
    let x = 0;
    let y = 0;
    return arc.map(([dx, dy]) => {
      x += dx;
      y += dy;
      return [x * scale[0] + translate[0], y * scale[1] + translate[1]];
    });
  });

  const joinRing = (indexes) =>
    indexes.flatMap((index, position) => {
      const source = arcs[index < 0 ? ~index : index];
      const points = index < 0 ? [...source].reverse() : source;
      return position === 0 ? points : points.slice(1);
    });

  const object = Object.values(topology.objects)[0];
  return object.geometries.map((geometry) => {
    const rings =
      geometry.type === "Polygon"
        ? geometry.arcs.map(joinRing)
        : geometry.arcs.flatMap((polygon) => polygon.map(joinRing));
    return {
      code: geometry.properties.SIG_CD ?? geometry.properties.CTPRVN_CD,
      name: geometry.properties.SIG_KOR_NM ?? geometry.properties.CTP_KOR_NM,
      rings,
    };
  });
}

function createProjector(features) {
  let minLongitude = Infinity;
  let maxLongitude = -Infinity;
  let minLatitude = Infinity;
  let maxLatitude = -Infinity;

  for (const { rings } of features) {
    for (const ring of rings) {
      for (const [longitude, latitude] of ring) {
        minLongitude = Math.min(minLongitude, longitude);
        maxLongitude = Math.max(maxLongitude, longitude);
        minLatitude = Math.min(minLatitude, latitude);
        maxLatitude = Math.max(maxLatitude, latitude);
      }
    }
  }

  const longitudeScale = Math.cos(
    (((minLatitude + maxLatitude) / 2) * Math.PI) / 180,
  );
  const projectedWidth = (maxLongitude - minLongitude) * longitudeScale;
  const projectedHeight = maxLatitude - minLatitude;
  const scale = Math.min(
    (MAP_WIDTH - MAP_PADDING * 2) / projectedWidth,
    (MAP_HEIGHT - MAP_PADDING * 2) / projectedHeight,
  );
  const offsetX = (MAP_WIDTH - projectedWidth * scale) / 2;
  const offsetY = (MAP_HEIGHT - projectedHeight * scale) / 2;

  return ([longitude, latitude]) => [
    offsetX + (longitude - minLongitude) * longitudeScale * scale,
    offsetY + (maxLatitude - latitude) * scale,
  ];
}

function rainChance(code) {
  const hash = [...code].reduce(
    (sum, digit) => sum * 31 + digit.charCodeAt(0),
    7,
  );
  return Math.abs(hash % 11) * 10;
}

function polygonCentroid(ring) {
  let area = 0;
  let cx = 0;
  let cy = 0;
  const n = ring.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const cross = xj * yi - xi * yj;
    area += cross;
    cx += (xi + xj) * cross;
    cy += (yi + yj) * cross;
  }
  area /= 2;
  if (Math.abs(area) < 1e-10) {
    // fallback: simple average
    const sumX = ring.reduce((s, [x]) => s + x, 0);
    const sumY = ring.reduce((s, [, y]) => s + y, 0);
    return { x: sumX / n, y: sumY / n };
  }
  return { x: cx / (6 * area), y: cy / (6 * area) };
}

function toSvgRegions(features, project) {
  return features.map(({ code, name, rings }) => {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    // 투영된 링 목록 (centroid 계산에도 사용)
    const projectedRings = rings.map((ring) =>
      ring.map((point) => {
        const [x, y] = project(point);
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
        return [x, y];
      }),
    );

    const path = projectedRings
      .map((ring) => {
        const commands = ring.map(
          ([x, y], index) =>
            `${index === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`,
        );
        return `${commands.join("")}Z`;
      })
      .join("");

    // 가장 큰 링(외곽)의 무게중심을 레이블 위치로 사용
    const outerRing = projectedRings.reduce((largest, ring) =>
      ring.length > largest.length ? ring : largest,
    );
    const label = polygonCentroid(outerRing);

    return {
      code,
      name,
      path,
      rainChance: rainChance(code),
      bounds: [minX, minY, maxX, maxY],
      label: {
        x: Math.round(label.x * 100) / 100,
        y: Math.round(label.y * 100) / 100,
      },
    };
  });
}

async function readTopology(filename) {
  return JSON.parse(
    await readFile(resolve(root, "map-source", filename), "utf8"),
  );
}

const [sidoTopology, sigunguTopology] = await Promise.all([
  readTopology("korea-sido.topo.json"),
  readTopology("korea-sigungu.topo.json"),
]);
const sigunguFeatures = decode(sigunguTopology);
const project = createProjector(sigunguFeatures);
const sidos = toSvgRegions(decode(sidoTopology), project);
const sigungu = toSvgRegions(sigunguFeatures, project);

await mkdir(resolve(root, "public", "map", "sigungu"), { recursive: true });
await writeFile(
  resolve(root, "public", "map", "sido.json"),
  JSON.stringify(sidos),
);

for (const sido of sidos) {
  const children = sigungu.filter(({ code }) => code.startsWith(sido.code));
  await writeFile(
    resolve(root, "public", "map", "sigungu", `${sido.code}.json`),
    JSON.stringify(children),
  );
}

console.log(
  `Generated ${sidos.length} sido and ${sigungu.length} sigungu SVG paths.`,
);
