import { writeFileSync } from "node:fs";
import { loadServerEnv, requireKmaServiceKey } from "../server/env.ts";
import { sigunguList } from "../server/weather/gridMap.ts";
import { mapOdamPty } from "../server/weather/odamGrid.ts";

loadServerEnv();

const latest = Math.floor(Date.now() / 600000) * 600000;
let mapped = false;

for (let back = 0; back <= 3; back++) {
  const tmfc = new Date(latest - back * 600000 + 9 * 3600000)
    .toISOString()
    .slice(0, 16)
    .replace(/[-T:]/g, "");
  const url = new URL(
    "https://apihub.kma.go.kr/api/typ01/cgi-bin/url/nph-dfs_odam_grd",
  );
  url.search = new URLSearchParams({
    tmfc,
    vars: "PTY",
    authKey: requireKmaServiceKey(),
  }).toString();
  const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`기상청 HTTP ${response.status}`);
  const text = await response.text();
  if (text.trim().startsWith("# dfs_file_read error")) {
    console.log(`${tmfc}: 자료 미제공, 이전 발표 조회`);
    continue;
  }
  const districts = mapOdamPty(text, sigunguList);
  const output = "/tmp/ohumbrella-odam-mapping.json";
  writeFileSync(output, JSON.stringify({ tmfc, districts }, null, 2));
  console.log(
    JSON.stringify(
      {
        tmfc,
        count: districts.length,
        missing: districts.filter((d) => d.pty === null).length,
        precipitation: districts.filter((d) => d.hasPrecipitation).length,
        samples: districts.filter((d) =>
          ["11240", "11110", "26110", "50110"].includes(d.code),
        ),
        output,
      },
      null,
      2,
    ),
  );
  mapped = true;
  break;
}

if (!mapped) throw new Error("최근 4개 발표시각에 실황 자료가 없습니다.");
