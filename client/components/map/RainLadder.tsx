import type { SidoStat } from "../../../shared/weather";
import { nationalRecord, type NationalRecord } from "../../lib/nationalRecord";

const LADDER_POPS = [0, 20, 30];

function formatRate(record: NationalRecord) {
  return `${record.rate.toFixed(1)}%`;
}

// 예보 강수확률별 실제 강수 비율을 사다리로 보여주고, 20%에서 선을 그은 이유를 말한다.
export function RainLadder({
  stats,
  maxPop,
}: {
  stats: readonly SidoStat[];
  maxPop: number;
}) {
  const rows = LADDER_POPS.map((pop) => ({
    pop,
    record: nationalRecord(stats, pop),
  }));
  const low = rows.find((row) => row.pop === maxPop)?.record;
  const nextRow = rows.find((row) => row.pop > maxPop);
  const next = nextRow?.record;
  if (!low || !nextRow || !next || low.rate <= 0) return null;
  if (rows.some((row) => !row.record)) return null;
  const maxRate = Math.max(...rows.map((row) => row.record!.rate));
  const jump = Math.floor(next.rate / low.rate);
  const samples = rows.reduce((sum, row) => sum + row.record!.samples, 0);

  return (
    <section className="rain-ladder" aria-labelledby="rain-ladder-heading">
      <div className="ladder-copy">
        <h2 id="rain-ladder-heading">왜 {maxPop}%일까요?</h2>
        <p>
          예보 강수확률이 {maxPop}%였던 시간 중 실제로 비가 관측된 건{" "}
          <b>{formatRate(low)}</b>였어요. {nextRow.pop}%에서는{" "}
          <b>{formatRate(next)}</b>로, {jump}배 넘게 많아요.
        </p>
      </div>
      <div className="ladder-chart">
        <p className="ladder-caption">
          예보 강수확률 → 실제로 비가 관측된 비율
        </p>
        <ol aria-label="예보 강수확률별 실제로 비가 관측된 비율">
          {rows.map(({ pop, record }) => (
            <li key={pop} className={pop <= maxPop ? "is-quiet" : undefined}>
              <span className="ladder-pop">{pop}%</span>
              <span className="ladder-track" aria-hidden="true">
                <span
                  className="ladder-bar"
                  style={{ width: `${(record!.rate / maxRate) * 100}%` }}
                />
              </span>
              <span className="ladder-odds">{formatRate(record!)}</span>
            </li>
          ))}
        </ol>
        <small>
          예보 {samples.toLocaleString("ko-KR")}시간을 1시간 관측과 짝지은
          기록이에요. 계절에 따라 달라질 수 있어요.
        </small>
      </div>
    </section>
  );
}
