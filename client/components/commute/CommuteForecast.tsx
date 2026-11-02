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
const pointLabels: Record<CommutePointKind, string> = {
  leaveHome: "집에서 출발",
  arriveWork: "회사 도착",
  leaveWork: "회사에서 출발",
  arriveHome: "집 도착",
};
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
function reading(point: CommutePoint) {
  if (point.status === "elapsed") return "지난 시간";
  const pty = point.forecast?.pty?.value;
  const pop = point.forecast?.pop;
  const parts = [pop ? `${pop.value}%` : "예보 없음"];
  if (pty) parts.push(precipitation[pty]);
  return parts.join(" · ");
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
  leaveHome: "출근길",
  arriveWork: "출근길",
  leaveWork: "퇴근길",
  arriveHome: "퇴근길",
};
function recordLine(top: CommutePoint) {
  const lead = `${legs[top.kind]} ${popOf(top)}%`;
  if (!top.record) return `${lead}, 아직 이 확률의 기록이 없어요`;
  const often = top.record.rainCount / top.record.samples >= 0.5;
  return `${lead}, ${often ? "실제로도" : "실제로는"} ${recordSentence(top.record)}`;
}
// Every POP the short-term forecast issues; it skips from 30% to 60%.
const STORY_POPS = [0, 20, 30, 60, 70, 80, 90, 100];
function Story({
  places,
  initial,
}: {
  places: PlaceRecords[] | null;
  initial: CommutePoint | null;
}) {
  const start =
    places?.find((p) => p.place.name === initial?.place) ?? places?.[0];
  const [code, setCode] = useState(start?.place.code ?? "");
  const [pop, setPop] = useState(initial ? popOf(initial) : 30);
  const current = places?.find((p) => p.place.code === code);
  const record = current?.records.find((r) => r.pop === pop);
  return (
    <section className="commute-story" aria-label="아 맞다 우산 이야기">
      {current ? (
        <div className="commute-story-query">
          <p>
            {places!.length > 1 ? (
              <select
                aria-label="지역"
                value={code}
                onChange={(e) => setCode(e.target.value)}
              >
                {places!.map(({ place }) => (
                  <option key={place.code} value={place.code}>
                    {shortName(place.name)}
                  </option>
                ))}
              </select>
            ) : (
              shortName(current.place.name)
            )}
            에서 기상청 강수확률이{" "}
            <select
              aria-label="기상청 강수확률"
              value={pop}
              onChange={(e) => setPop(Number(e.target.value))}
            >
              {STORY_POPS.map((value) => (
                <option key={value} value={value}>
                  {value}%
                </option>
              ))}
            </select>
            일 때
          </p>
          <strong>
            {!record
              ? "아직 이 확률의 기록이 없어요"
              : record.rainCount === 0
                ? `${record.samples}번 중 한 번도 비가 오지 않았어요`
                : `${record.samples}번 중 ${record.rainCount}번 비가 왔어요`}
          </strong>
        </div>
      ) : (
        <p>지금은 기록을 불러오지 못했어요.</p>
      )}
      <Link to="/about">어떻게 기록했나요 →</Link>
    </section>
  );
}
export function CommuteForecast({ data }: { data: CommuteResponse }) {
  const [selected, setSelected] = useState(data.defaultDay);
  const [storyOpen, setStoryOpen] = useState(false);
  const day = data.days.find((d) => d.key === selected) ?? data.days[0];
  const top = headlinePoint(day);
  return (
    <div className="commute-results" aria-live="polite">
      <div className="commute-days" role="group" aria-label="출퇴근 날짜">
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
            {top.record ? (
              <button
                type="button"
                aria-expanded={storyOpen}
                onClick={() => setStoryOpen((open) => !open)}
              >
                {recordLine(top)}
              </button>
            ) : (
              <p>{recordLine(top)}</p>
            )}
          </>
        ) : (
          <strong>
            {day.verdict === "elapsed"
              ? "출퇴근 시간이 모두 지났어요"
              : "아직 강수확률 예보가 없어요"}
          </strong>
        )}
      </div>
      {storyOpen && <Story places={data.places} initial={top} />}
      <ol className="commute-points">
        {day.points.map((point) => (
          <li
            key={point.kind}
            className={[
              point.status === "elapsed" && "is-elapsed",
              point.rain && "is-rain",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            <span>
              {pointLabels[point.kind]} · {when(day, point)}
            </span>
            <span>{reading(point)}</span>
          </li>
        ))}
      </ol>
      <small>
        기록은 지난 예보와 실제 날씨를 비교한 참고 자료예요. 자료제공: 기상청 ·
        한국 시간 기준
      </small>
    </div>
  );
}
