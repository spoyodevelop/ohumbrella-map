import styled from "@emotion/styled";
import type {
  SurpriseRainEvent,
  SurpriseRainResponse,
} from "../../api/surpriseRain";
import type { MapRegion } from "../../types";

// "2026-10-20 15:00" → "10/20 15시"
function formatEventTime(time: string): string {
  const match = /^\d{4}-(\d{2})-(\d{2}) (\d{2})/.exec(time);
  if (!match) return time;
  const [, month, day, hour] = match;
  return `${Number(month)}/${Number(day)} ${Number(hour)}시`;
}

function formatDay(time: string | null): string {
  if (!time) return "";
  const match = /^\d{4}-(\d{2})-(\d{2})/.exec(time);
  return match ? `${Number(match[1])}/${Number(match[2])}` : time;
}

function formatMm(rn1: number): string {
  return `${Math.round(rn1 * 10) / 10}mm`;
}

interface SurpriseRainPanelProps {
  data: SurpriseRainResponse | null;
  errorMessage: string;
  selectedRegion: MapRegion;
}

export function SurpriseRainPanel({
  data,
  errorMessage,
  selectedRegion,
}: SurpriseRainPanelProps) {
  if (!data) {
    return (
      <Box>
        <Muted>
          {errorMessage
            ? "기록을 불러오지 못했어요."
            : "기록을 불러오는 중이에요…"}
        </Muted>
      </Box>
    );
  }

  const isSigungu = selectedRegion.code.length === 5;
  const region = isSigungu ? data.regions[selectedRegion.code] : undefined;
  const sido = isSigungu ? undefined : data.sidos[selectedRegion.code];
  const count = region?.count ?? sido?.count ?? 0;
  const heavyCount = region?.heavyCount ?? sido?.heavyCount ?? 0;
  const topRegions = isSigungu
    ? []
    : Object.values(data.regions)
        .filter((r) => r.sidoCode === selectedRegion.code)
        .sort((a, b) => b.count - a.count || b.heavyCount - a.heavyCount)
        .slice(0, 5);

  return (
    <Box>
      <Label>예보 강수확률 {data.maxPop}% 이하였는데 비가 온 시간</Label>
      <Count>{count}건</Count>
      <Muted>
        {count === 0
          ? `${formatDay(data.since)}~${formatDay(data.until)} 기록에는 없었어요`
          : `${heavyCount > 0 ? `${data.heavyMm}mm 이상 ${heavyCount}건 · ` : ""}${
              sido ? `시군구 ${sido.regionCount}곳 · ` : ""
            }${formatDay(data.since)}~${formatDay(data.until)} 기록`}
      </Muted>

      {region && region.events.length > 0 && (
        <EventList aria-label="비가 온 시간 목록">
          {region.events.map((event) => (
            <EventRow key={event.time} event={event} heavyMm={data.heavyMm} />
          ))}
        </EventList>
      )}

      {topRegions.length > 0 && (
        <EventList aria-label="많이 기록된 시군구">
          {topRegions.map((r) => (
            <Row key={r.name}>
              <span>{r.name}</span>
              <RowMeta>
                {r.count}건
                {r.heavyCount > 0 && (
                  <Heavy>
                    {" "}
                    · {data.heavyMm}mm↑ {r.heavyCount}
                  </Heavy>
                )}
              </RowMeta>
            </Row>
          ))}
        </EventList>
      )}

      <Note>
        한 지역의 1시간 관측을 1건으로 세어요. 이어지는 비도 여러 건일 수
        있어요. 비가 온 기준은 기상청 초단기실황이에요.
      </Note>
    </Box>
  );
}

function EventRow({
  event,
  heavyMm,
}: {
  event: SurpriseRainEvent;
  heavyMm: number;
}) {
  const heavy = event.rn1 >= heavyMm;
  return (
    <Row $heavy={heavy}>
      <span>{formatEventTime(event.time)}</span>
      <RowMeta>
        예보 {event.pop}% ·{" "}
        {heavy ? <Heavy>{formatMm(event.rn1)}</Heavy> : formatMm(event.rn1)}
      </RowMeta>
    </Row>
  );
}

export function SurpriseRainLegend({ maxCount }: { maxCount: number }) {
  return (
    <>
      <span>0건</span>
      <LegendBar />
      <span>{maxCount > 0 ? `${maxCount}건` : "—"}</span>
    </>
  );
}

const Box = styled.div`
  display: grid;
  gap: 4px;
  padding: 10px 12px;
  border-radius: 10px;
  background: rgb(var(--record-rgb) / 0.08);
  border: 1px solid rgb(var(--record-rgb) / 0.32);
`;

const Label = styled.div`
  font-size: 0.78rem;
  font-weight: 600;
  color: #526052;
  letter-spacing: -0.02em;
`;

const Count = styled.div`
  font-size: 1.7rem;
  font-weight: 800;
  line-height: 1.15;
  color: var(--record);
`;

const Muted = styled.div`
  font-size: 0.78rem;
  color: #526052;
`;

const EventList = styled.ul`
  display: grid;
  gap: 2px;
  max-height: 300px;
  margin: 6px 0 0;
  padding: 0;
  overflow-y: auto;
  list-style: none;
  overscroll-behavior: contain;

  @media (max-width: 640px) {
    max-height: 220px;
  }
`;

const Row = styled.li<{ $heavy?: boolean }>`
  display: flex;
  justify-content: space-between;
  gap: 8px;
  padding: 4px 6px;
  border-radius: 6px;
  font-size: 0.74rem;
  font-variant-numeric: tabular-nums;
  color: ${(props) => (props.$heavy ? "#19251e" : "#394c3d")};
  background: ${(props) =>
    props.$heavy ? "rgb(var(--record-rgb) / 0.14)" : "transparent"};
`;

const RowMeta = styled.span`
  color: #526052;
  white-space: nowrap;
`;

const Heavy = styled.strong`
  color: var(--record);
  font-weight: 700;
`;

const Note = styled.p`
  margin: 6px 0 0;
  font-size: 0.72rem;
  line-height: 1.45;
  color: #526052;
  word-break: keep-all;
`;

const LegendBar = styled.div`
  width: 110px;
  height: 7px;
  border-radius: 999px;
  background: linear-gradient(
    90deg,
    var(--surprise-map-low),
    var(--surprise-map-high)
  );
`;
