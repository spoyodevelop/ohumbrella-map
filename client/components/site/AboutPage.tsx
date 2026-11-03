import styled from "@emotion/styled";
import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router";
import type { SidoStatsResponse } from "../../../shared/weather";
import { loadSurpriseRain } from "../../api/surpriseRain";
import { formatDay } from "../../lib/formatTime";
import { fetchJson } from "../../lib/http";
import { nationalRecord, type NationalRecord } from "../../lib/nationalRecord";

export function AboutPage() {
  const [record, setRecord] = useState<NationalRecord | null>(null);
  const [period, setPeriod] = useState<{ since: string; until: string } | null>(
    null,
  );
  const { hash } = useLocation();
  // 다른 페이지의 "어떻게 세었나요?" 링크(#how)로 들어오면 그 절로 바로 이동한다.
  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView();
  }, [hash]);
  useEffect(() => {
    let active = true;
    fetchJson<SidoStatsResponse>("/api/weather/sido-stats")
      .then((res) => {
        if (active) setRecord(nationalRecord(res.stats, 30));
      })
      .catch(() => {});
    loadSurpriseRain()
      .then((res) => {
        if (active && res.since && res.until)
          setPeriod({ since: res.since, until: res.until });
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);
  return (
    <Page>
      <Eyebrow>아 맞다 우산 이야기</Eyebrow>
      <h1>강수확률, 실제로는 어땠을까?</h1>
      <p>
        기상청 단기예보에는 &ldquo;강수확률 20%&rdquo; 같은 숫자가 붙어요. 아
        맞다 우산은 그 숫자 뒤에 실제로 비가 왔는지를 시간마다 기록해요.
      </p>

      <h2>아 맞다 우산은 뭘 하나요?</h2>
      <Features>
        <li>
          <b>20% 예보에 내린 비</b>
          <span>
            강수확률 20% 이하 예보였는데 비가 관측된 시간을 동네별로 모아 지도에
            보여줘요.
          </span>
          <Link to="/">지도 보기 →</Link>
        </li>
        <li>
          <b>출퇴근길 우산</b>
          <span>
            집과 목적지, 나가고 돌아오는 시각을 정하면 그 길의 강수확률과, 그
            확률일 때 그 동네에 실제로 비가 온 기록을 함께 보여줘요.
          </span>
          <Link to="/commute">출퇴근길 보기 →</Link>
        </li>
      </Features>

      <h2 id="how">어떻게 세었나요?</h2>
      <Steps>
        <li>
          <b>동네마다 한 지점</b>
          <span>
            252개 시군구마다 대표 지점을 하나 정하고, 그 지점이 속한 기상청
            격자(약 5km)의 예보와 관측을 써요.
          </span>
        </li>
        <li>
          <b>예보 하나 고르기</b>
          <span>
            관측 시각마다, 그 시각보다 먼저 나온 가장 최근 단기예보(1~3시간 전
            발표)의 강수확률 하나를 골라요. 맞는 발표가 없으면 다른 발표로
            대신하지 않고 빼요.
          </span>
        </li>
        <li>
          <b>비가 왔는지 확인</b>
          <span>
            그 시각 초단기실황에 강수형태가 있거나 1시간 강수량이 0mm보다 많으면
            비가 온 것으로 세요. 아주 적은 비도 포함돼요.
          </span>
        </li>
        <li>
          <b>확률별로 세기</b>
          <span>동네와 강수확률마다 몇 번 중 몇 번 비가 왔는지 더해요.</span>
        </li>
      </Steps>
      <Example>
        <span>예시</span>
        <p>
          우리 동네에 <b>20% 예보가 200번</b> 있었고 그중 <b>2번</b> 비가
          왔다면, 이 동네의 20%는 실제로 <mark>1%</mark>였던 셈이에요.
          &ldquo;20% 예보에 내린 비&rdquo; 지도는 이 기록 중 그 2번 같은 시간을
          모은 거예요.
        </p>
      </Example>

      {period && <CollectingNote {...period} />}

      <Story>
        <h2>왜 만들었나요?</h2>
        <p>
          시작은 단순했어요. 예보를 보고 나갔다가 비를 맞는 일이 잦아서,
          강수확률이 실제로 얼마나 들어맞는지 직접 재보고 싶었어요.
        </p>
        <h2>V1, 30개월의 기록</h2>
        <p>
          17개 시도의 강수를 기록하던 V1은 30개월 넘게 운영했어요. 큰 계획이
          있던 건 아니었지만, 예보 때문에 속상했던 분들이 가끔 찾아와 재밌는
          반응을 남겨주셔서 오래 이어올 수 있었어요.
        </p>
        <p>
          그동안 사고도 있었어요. 국가정보자원관리원 화재로 수집이 일주일 가까이
          멈춘 적이 있었고, 바람에 날아온 파라솔이 집 앞 전봇대에 걸리면서 몇
          회차의 자료가 통째로 사라진 적도 있었어요. 그때마다 복구하며 거의
          사명감으로 기록을 이어왔어요.
        </p>
        <h2>그리고 V2</h2>
        <p>
          그렇게 쌓은 운영 경험을 바탕으로, 이번에는{" "}
          <mark>전국 252개 시군구</mark>로 넓혔어요. 이제 내가 사는 구에서
          예보가 몇 번 나왔고, 그중 실제로 비가 몇 번 왔는지 볼 수 있어요.
        </p>
        <p>V1부터 지켜본 강수확률 30% 예보로 비교하면 이래요.</p>
      </Story>
      <Figures aria-label="강수확률 30% 예보에서 실제로 비가 온 비율">
        <div>
          <span>V1 · 17개 시도</span>
          <span className="forecast">예보 30%</span>
          <strong>
            <span className="prefix">실제</span> 5.9%
          </strong>
          <small>31,469번 기록</small>
        </div>
        <div>
          <span>지금 · 252개 시군구</span>
          <span className="forecast">예보 30%</span>
          <strong>
            <span className="prefix">실제</span>{" "}
            {record ? `${record.rate.toFixed(1)}%` : "—"}
          </strong>
          {record && (
            <small>{record.samples.toLocaleString("ko-KR")}번 기록</small>
          )}
        </div>
      </Figures>

      <section>
        <h2>이 숫자, 예보 대신 믿어도 되나요?</h2>
        <p>
          기록은 &ldquo;지난번엔 이랬다&rdquo;를 알려줘요. &ldquo;내일은 이럴
          것이다&rdquo;는 여전히 기상청 예보가 가장 잘 알아요. 예보를 볼 때 옆에
          두고, 우리 동네에서 이 숫자가 어떤 뜻이었는지 떠올리는 용도로
          써주세요.
        </p>
      </section>
      <Credit>자료제공 및 출처: 기상청 단기예보 · 초단기실황</Credit>
      <Link to="/">지도로 돌아가기</Link>
    </Page>
  );
}

const DAY_MS = 24 * 60 * 60 * 1000;

// 짝지은 기록이 1년이 안 되면, 무엇이 얼마나 쌓였고 무엇이 아직 부족한지 밝힌다.
function CollectingNote({ since, until }: { since: string; until: string }) {
  const days =
    (Date.parse(until.slice(0, 10)) - Date.parse(since.slice(0, 10))) / DAY_MS;
  if (!(days >= 0) || days >= 365) return null;
  const weeks = Math.max(1, Math.round(days / 7));
  const firstMonth = Number(since.slice(5, 7));
  const lastMonth = Number(until.slice(5, 7));
  return (
    <Note>
      <h2>예보와 실제 비를 짝지은 기록, 아직 쌓는 중이에요</h2>
      <p>
        처음 버전(V1)은 17개 시도의 기록을 30개월 넘게 쌓았어요. 지금 버전(V2)은
        252개 시군구로 넓히면서 동네별 기록을 <b>{formatDay(since)}</b>부터 새로
        모으기 시작해서, 아직 약 {weeks}
        주치예요.
      </p>
      <p>
        {firstMonth === lastMonth
          ? `${firstMonth}월`
          : `${firstMonth}월부터 ${lastMonth}월까지`}
        의 날씨만 담겨 있어서, 장마철이나 눈 오는 겨울처럼 다른 계절을 지나면
        숫자가 달라질 수 있어요.
      </p>
      <ul>
        <li>
          70% 이상 같은 높은 확률 예보는 드물어서 기록이 적어요. 그래서 몇몇
          화면에서는 묶어서 보여주거나 기록이 적은 확률을 숨겨요.
        </li>
        <li>
          전국으로는 수십만 시간이 쌓였지만, 한 동네의 한 확률로 쪼개면
          수십~수백 번이에요.
        </li>
      </ul>
      <p>V1처럼 기록이 쌓일수록 숫자도 단단해질 거예요.</p>
    </Note>
  );
}

const Page = styled.main`
  color: #19251e;
  --record: #1752de;
  --record-rgb: 23 82 222;
  width: min(100%, 720px);
  margin: 0 auto;
  padding: 48px 28px;
  box-sizing: border-box;

  h1 {
    margin: 0 0 28px;
    font-size: clamp(1.8rem, 5vw, 2.8rem);
    line-height: 1.15;
    letter-spacing: -0.05em;
    word-break: keep-all;
  }

  h2 {
    margin: 36px 0 12px;
    font-size: 1.05rem;
    color: #19251e;
    scroll-margin-top: 16px;
  }

  p {
    margin: 0 0 16px;
    color: #526052;
    line-height: 1.7;
    word-break: keep-all;
  }

  section {
    margin: 32px 0 24px;
    padding: 20px;
    border: 1px solid #c9cec2;
    border-radius: 12px;
    background: #fffdf6;
  }

  section h2 {
    margin-top: 0;
  }

  section p {
    margin: 0;
  }

  a {
    color: #1752de;
  }

  /* Amber marks 아 맞다 우산's own findings, as on the map and panel. */
  mark {
    padding: 0 2px;
    border-radius: 3px;
    color: var(--record);
    font-weight: 700;
    background: rgb(var(--record-rgb) / 0.12);
  }

  @media (max-width: 640px) {
    padding: 32px 16px;
  }
`;

const Steps = styled.ol`
  display: grid;
  gap: 8px;
  margin: 0 0 16px;
  padding: 0;
  list-style: none;
  counter-reset: step;

  li {
    display: grid;
    grid-template-columns: 28px minmax(0, 1fr);
    column-gap: 12px;
    align-items: start;
    padding: 12px 14px;
    border: 1px solid #c9cec2;
    border-radius: 10px;
    background: #fffdf6;
    counter-increment: step;
  }

  li::before {
    content: counter(step);
    grid-row: span 2;
    display: grid;
    place-items: center;
    width: 28px;
    height: 28px;
    border-radius: 50%;
    color: #0b1220;
    font-weight: 800;
    background: #ffe55b;
  }

  b {
    color: #19251e;
  }

  span {
    color: #526052;
    line-height: 1.6;
    word-break: keep-all;
  }
`;

const Features = styled.ul`
  display: grid;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;

  li {
    display: grid;
    gap: 4px;
    padding: 14px 16px;
    border: 1px solid #c9cec2;
    border-radius: 10px;
    background: #fffdf6;
  }

  b {
    color: #19251e;
  }

  span {
    color: #526052;
    line-height: 1.6;
    word-break: keep-all;
  }

  a {
    justify-self: start;
    margin-top: 2px;
    font-size: 0.85rem;
    font-weight: 600;
  }
`;

const Example = styled.div`
  margin: 0 0 16px;
  padding: 12px 14px;
  border-left: 3px solid var(--record);
  border-radius: 0 10px 10px 0;
  background: rgb(var(--record-rgb) / 0.06);

  > span {
    display: block;
    margin-bottom: 4px;
    color: var(--record);
    font-size: 0.75rem;
    font-weight: 700;
  }

  && p {
    margin: 0;
  }

  b {
    color: #19251e;
  }
`;

const Note = styled.div`
  margin: 24px 0 0;
  padding: 18px 20px;
  border: 1px dashed #a7b3a6;
  border-radius: 12px;
  background: #f4f6ee;

  && h2 {
    margin: 0 0 10px;
  }

  && p {
    margin: 0 0 10px;
  }

  && p:last-child {
    margin: 0;
  }

  b {
    color: #19251e;
  }

  ul {
    margin: 0 0 10px;
    padding-left: 18px;
    color: #526052;
    line-height: 1.7;
    word-break: keep-all;
  }
`;

const Story = styled.div`
  margin-top: 40px;

  h2 {
    margin-top: 28px;
  }

  h2:first-of-type {
    margin-top: 0;
  }
`;

const Figures = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin: 0;

  div {
    padding: 18px;
    border: 1px solid #c9cec2;
    border-radius: 12px;
    background: #fffdf6;
  }

  span,
  small {
    display: block;
    color: #526052;
    font-size: 0.78rem;
    word-break: keep-all;
  }

  .forecast {
    margin-top: 10px;
    color: #526052;
    font-size: 1rem;
    font-weight: 600;
  }

  strong {
    display: block;
    margin: 2px 0 6px;
    color: var(--record);
    font-size: clamp(2rem, 6vw, 3rem);
    letter-spacing: -0.04em;
  }

  strong .prefix {
    display: inline;
    margin-right: 6px;
    color: var(--record);
    font-size: 1rem;
    font-weight: 600;
    letter-spacing: 0;
  }
`;

const Eyebrow = styled.p`
  && {
    margin: 0 0 10px;
    color: #526052;
    font:
      600 0.72rem/1.2 ui-monospace,
      SFMono-Regular,
      Menlo,
      monospace;
    letter-spacing: 0.08em;
  }
`;

const Credit = styled.p`
  && {
    color: #4a5568;
    font-size: 0.75rem;
  }
`;
