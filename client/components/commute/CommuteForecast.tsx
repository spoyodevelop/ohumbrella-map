import { useState } from "react";
import { Link } from "react-router";
import type {
  CommuteDay,
  CommutePoint,
  CommutePointKind,
  CommuteResponse,
  PlaceRecords,
  PopRecord,
} from "../../../shared/commute";
const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
const precipitation: Record<number, string> = {
  1: "비",
  2: "비/눈",
  3: "눈",
  4: "소나기",
  5: "빗방울",
  6: "빗방울/눈날림",
  7: "눈날림",
};
function dayLabel(day: CommuteDay) {
  const weekday = weekdays[new Date(`${day.date}T00:00:00Z`).getUTCDay()];
  return `${day.key === "today" ? "오늘" : "내일"}(${weekday})`;
}
function when(day: CommuteDay, point: CommutePoint) {
  const time = point.targetTime.slice(11);
  return point.targetTime.startsWith(day.date) ? time : `다음 날 ${time}`;
}
// "서울특별시 송파구" → "송파구"; single-word names such as 세종 stay as-is.
function shortName(name: string) {
  const words = name.split(" ");
  return words.length > 1 ? words.slice(1).join(" ") : name;
}
const popOf = (p: CommutePoint) => p.forecast!.pop!.value;
const rateOf = (p: CommutePoint) =>
  p.record ? p.record.rainCount / p.record.samples : -1;
// The upcoming point with the highest POP; ties go to the point where it
// rained more often after such a forecast, then to the earlier point.
function headlinePoint(day: CommuteDay) {
  return day.points
    .filter((p) => p.status === "ok")
    .reduce<CommutePoint | null>(
      (top, p) =>
        !top ||
        popOf(p) > popOf(top) ||
        (popOf(p) === popOf(top) && rateOf(p) > rateOf(top))
          ? p
          : top,
      null,
    );
}
// "Not once in ten" is only said when the rate is truly under 10%, and
// fewer than ten samples are told as they are rather than scaled to ten.
function recordSentence(record: PopRecord) {
  if (record.samples < 10)
    return record.rainCount === 0
      ? `${record.samples}번 중 한 번도 안 왔어요`
      : `${record.samples}번 중 ${record.rainCount}번 왔어요`;
  if (record.rainCount === 0) return "한 번도 안 왔어요";
  const tenths = Math.round((10 * record.rainCount) / record.samples);
  return record.rainCount / record.samples < 0.1
    ? "10번 중 1번도 안 왔어요"
    : `10번 중 ${tenths}번 왔어요`;
}
// Only when every remaining point has a forecast without precipitation and
// this district rarely saw rain after each of those POPs, over enough samples.
function noUmbrella(day: CommuteDay) {
  return (
    day.verdict === "none" &&
    day.points
      .filter((p) => p.status !== "elapsed")
      .every(
        (p) =>
          p.record &&
          p.record.samples >= 10 &&
          p.record.rainCount / p.record.samples < 0.1,
      )
  );
}
const legs: Record<CommutePointKind, string> = {
  leaveHome: "가는 길",
  arriveWork: "가는 길",
  leaveWork: "오는 길",
  arriveHome: "오는 길",
};
// The forecast stays muted; the record carries the accent.
function RecordLine({ top }: { top: CommutePoint }) {
  const lead = (
    <span className="commute-forecast-part">
      {legs[top.kind]} 강수확률 {popOf(top)}%
    </span>
  );
  if (!top.record)
    return (
      <>
        {lead}
        <span className="commute-record-part">
          아직 이 확률의 기록이 없어요
        </span>
      </>
    );
  const often = top.record.rainCount / top.record.samples >= 0.5;
  return (
    <>
      {lead}
      <span className="commute-record-part">
        {shortName(top.place)}에선 비가 {often ? "실제로도" : "실제로는"}{" "}
        {recordSentence(top.record)}
      </span>
      <span className="commute-record-count">
        같은 확률 예보 {top.record.samples}번 기록
      </span>
    </>
  );
}
type Leg = "go" | "back";
const legPoints: Record<Leg, CommutePointKind[]> = {
  go: ["leaveHome", "arriveWork"],
  back: ["leaveWork", "arriveHome"],
};
// One row per leg: the higher POP of its two points, plus any precipitation type.
function legReading(points: CommutePoint[]) {
  const upcoming = points.filter((p) => p.status !== "elapsed");
  if (!upcoming.length) return "지난 시간";
  const known = upcoming.filter((p) => p.status === "ok");
  if (!known.length) return "예보 없음";
  const pop = Math.max(...known.map(popOf));
  const pty = known.find((p) => p.forecast?.pty?.value)?.forecast?.pty?.value;
  return pty ? `${pop}% · ${precipitation[pty]}` : `${pop}%`;
}
// Observed rain rate by forecast POP for each commute place; the POPs in
// today's forecast are highlighted. Thin buckets are left out.
const MIN_SAMPLES = 10;
function PlaceLadders({
  places,
  day,
}: {
  places: PlaceRecords[] | null;
  day: CommuteDay;
}) {
  const shown = (places ?? [])
    .map(({ place, records }) => ({
      place,
      records: records.filter((r) => r.samples >= MIN_SAMPLES),
      current: new Set(
        day.points
          .filter((p) => p.status === "ok" && p.place === place.name)
          .map(popOf),
      ),
    }))
    .filter(({ records }) => records.length > 0);
  if (!shown.length) return null;
  return (
    <section className="commute-ladders" aria-label="동네별 강수확률 기록">
      <h3>강수확률별로, 실제로는?</h3>
      <p>같은 확률 예보 뒤 실제로 비가 관측된 비율이에요.</p>
      {shown.map(({ place, records, current }) => (
        <div key={place.code} className="commute-ladder">
          <strong>{shortName(place.name)}</strong>
          <ol>
            {records.map((r) => {
              const rate = (100 * r.rainCount) / r.samples;
              return (
                <li
                  key={r.pop}
                  className={current.has(r.pop) ? "is-current" : undefined}
                >
                  <span>{r.pop}%</span>
                  <span className="commute-ladder-track" aria-hidden="true">
                    <span style={{ width: `${rate}%` }} />
                  </span>
                  <span>{rate.toFixed(1)}%</span>
                </li>
              );
            })}
          </ol>
        </div>
      ))}
      <Link to="/about">어떻게 세었나요? →</Link>
    </section>
  );
}
export function CommuteForecast({ data }: { data: CommuteResponse }) {
  const [selected, setSelected] = useState(data.defaultDay);
  const day = data.days.find((d) => d.key === selected) ?? data.days[0];
  const top = headlinePoint(day);
  return (
    <div className="commute-results" aria-live="polite">
      <div className="commute-days" role="group" aria-label="외출 날짜">
        {data.days.map((d) => (
          <button
            key={d.key}
            type="button"
            aria-pressed={d.key === day.key}
            onClick={() => setSelected(d.key)}
          >
            {dayLabel(d)}
          </button>
        ))}
      </div>
      <div className={`commute-headline ${top?.rain ? "is-rain" : ""}`}>
        {top ? (
          <>
            {noUmbrella(day) && (
              <p className="commute-advice">우산 없이 나가도 괜찮겠어요</p>
            )}
            <p className="commute-record-line">
              <RecordLine top={top} />
            </p>
          </>
        ) : (
          <strong>
            {day.verdict === "elapsed"
              ? "외출 시간이 모두 지났어요"
              : "아직 강수확률 예보가 없어요"}
          </strong>
        )}
      </div>
      <ol className="commute-points">
        {(["go", "back"] as const).map((leg) => {
          const points = day.points.filter((p) =>
            legPoints[leg].includes(p.kind),
          );
          if (!points.length) return null;
          return (
            <li
              key={leg}
              className={[
                points.every((p) => p.status === "elapsed") && "is-elapsed",
                points.some((p) => p.rain) && "is-rain",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <span>
                {leg === "go" ? "가는 길" : "오는 길"} · {when(day, points[0])}–
                {when(day, points[points.length - 1])}
              </span>
              <span>{legReading(points)}</span>
            </li>
          );
        })}
      </ol>
      <PlaceLadders places={data.places} day={day} />
      <small>자료: 기상청 단기예보·초단기실황</small>
    </div>
  );
}
