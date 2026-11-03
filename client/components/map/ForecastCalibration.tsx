import type { SidoStat } from "../../../shared/weather";
import {
  combinedRecord,
  nationalRecord,
  type NationalRecord,
} from "../../lib/nationalRecord";

const HIGH_POP = 60;
const HIGHER_POPS = [70, 80, 90, 100];

function formatRate(record: NationalRecord) {
  return `${record.rate.toFixed(1)}%`;
}

// 예보 숫자(눈금)와 실제 비율(막대)을 같은 0~100 축에 놓아, 높은 확률은 가깝고
// 낮은 확률은 실제가 훨씬 적었다는 대비를 보여준다.
export function ForecastCalibration({
  stats,
  maxPop,
}: {
  stats: readonly SidoStat[];
  maxPop: number;
}) {
  const low = nationalRecord(stats, maxPop);
  const high = nationalRecord(stats, HIGH_POP);
  const higher = combinedRecord(stats, HIGHER_POPS);
  if (!low || !high || !higher) return null;
  const rows = [
    { label: `${maxPop}%`, forecast: maxPop, record: low },
    { label: `${HIGH_POP}%`, forecast: HIGH_POP, record: high },
    {
      label: `${HIGHER_POPS[0]}% 이상`,
      forecast: HIGHER_POPS[0],
      record: higher,
    },
  ];

  return (
    <section
      className="forecast-calibration"
      aria-labelledby="calibration-heading"
    >
      <div className="calibration-copy">
        <h2 id="calibration-heading">기상청 예보가 틀린 걸까요?</h2>
        <p>
          그렇게 보긴 어려워요. {HIGH_POP}% 예보에서는 실제로{" "}
          <b>{formatRate(high)}</b>, {HIGHER_POPS[0]}% 이상에서는{" "}
          <b>{formatRate(higher)}</b> 비가 관측돼 예보와 꽤 가까웠어요.
        </p>
        <p>
          낮은 확률에서는 실제로 비가 관측된 경우가 드물었어요. {maxPop}%
          예보에서 비가 관측된 시간은 {formatRate(low)}였어요.
        </p>
      </div>
      <div className="calibration-chart">
        <p className="calibration-caption">
          <span className="calibration-key-bar" aria-hidden="true" /> 실제 비율{" "}
          <span className="calibration-key-tick" aria-hidden="true" /> 예보 숫자
        </p>
        <ol aria-label="예보 강수확률과 실제로 비가 관측된 비율 비교">
          {rows.map(({ label, forecast, record }) => (
            <li key={label}>
              <span className="calibration-label">{label}</span>
              <span className="calibration-track" aria-hidden="true">
                <span
                  className="calibration-bar"
                  style={{ width: `${record.rate}%` }}
                />
                <span
                  className="calibration-tick"
                  style={{ left: `${forecast}%` }}
                />
              </span>
              <span className="calibration-rate">{formatRate(record)}</span>
            </li>
          ))}
        </ol>
        <small>
          {HIGHER_POPS[0]}% 이상은 표본이 적어 하나로 묶었어요(
          {higher.samples.toLocaleString("ko-KR")}시간).
        </small>
      </div>
    </section>
  );
}
