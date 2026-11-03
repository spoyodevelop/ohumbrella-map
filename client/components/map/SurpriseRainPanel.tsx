import styled from "@emotion/styled";
import type {
  SurpriseRainEvent,
  SurpriseRainResponse,
} from "../../api/surpriseRain";
import { formatHour, formatPeriod } from "../../lib/formatTime";
import type { MapRegion } from "../../types";

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
  const matchingRegions = Object.entries(data.regions).filter(
    ([code, region]) =>
      isSigungu
        ? code === selectedRegion.code
        : region.sidoCode === selectedRegion.code,
  );
  const records = matchingRegions
    .flatMap(([code, region]) =>
      region.events.map((event) => ({ code, name: region.name, event })),
    )
    .sort(
      (a, b) =>
        b.event.time.localeCompare(a.event.time) ||
        a.code.localeCompare(b.code),
    )
    .slice(0, 30);
  const totalRecords = matchingRegions.reduce(
    (total, [, region]) => total + region.count,
    0,
  );
  const showYear = data.since?.slice(0, 4) !== data.until?.slice(0, 4);

  return (
    <Box>
      <Label>
        {records.length ? (
          <>
            강수확률 {data.maxPop}% 이하 예보에서
            <br />
            <RainEmphasis>비가 관측된</RainEmphasis> 시간 {totalRecords}건
          </>
        ) : (
          "이 기간에는 해당 기록이 없어요."
        )}
      </Label>
      {data.since && data.until && (
        <Muted>{formatPeriod(data.since, data.until)} 기록</Muted>
      )}
      {records.length > 0 && (
        <EventList aria-label="비가 온 기록">
          {records.map(({ code, name, event }) => (
            <EventRow
              key={`${code}-${event.time}`}
              event={event}
              regionName={isSigungu ? undefined : name}
              showYear={showYear}
            />
          ))}
        </EventList>
      )}
      {totalRecords > records.length && (
        <Muted>최근 {records.length}개 기록을 표시했어요.</Muted>
      )}
    </Box>
  );
}

function EventRow({
  event,
  regionName,
  showYear,
}: {
  event: SurpriseRainEvent;
  regionName?: string;
  showYear: boolean;
}) {
  return (
    <Row>
      {regionName && <RegionName>{regionName}</RegionName>}
      <strong>{formatHour(event.time, showYear)}</strong>
      <RowMeta>
        예보는 <strong>{event.pop}%</strong>, 실제로는{" "}
        <RainAmount>{formatMm(event.rn1)}</RainAmount>
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
  font-size: 0.9rem;
  line-height: 1.6;
  word-break: keep-all;
  font-weight: 600;
  color: #526052;
  letter-spacing: -0.02em;
`;

const RainEmphasis = styled.strong`
  color: var(--record);
  font-weight: 700;
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

const Row = styled.li`
  display: grid;
  gap: 6px;
  padding: 14px 0;
  border-top: 1px solid rgb(var(--record-rgb) / 0.16);
  font-size: 0.85rem;
  line-height: 1.6;
  font-variant-numeric: tabular-nums;
  color: #19251e;
  word-break: keep-all;
`;

const RowMeta = styled.span`
  color: #526052;
`;

const RainAmount = styled.strong`
  color: var(--record);
`;

const RegionName = styled.span`
  color: #526052;
  font-size: 0.78rem;
`;

const LegendBar = styled.div`
  width: 110px;
  height: 7px;
  border-radius: 999px;
  background: linear-gradient(
    90deg,
    var(--surprise-map-low),
    var(--surprise-map-mid),
    var(--surprise-map-high)
  );
`;
