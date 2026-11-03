import styled from "@emotion/styled";
import { useEffect, useState } from "react";
import { Link } from "react-router";
import type { SidoStatsResponse } from "../../../shared/weather";
import { fetchJson } from "../../lib/http";
import { nationalRecord, type NationalRecord } from "../../lib/nationalRecord";

export function AboutPage() {
  const [record, setRecord] = useState<NationalRecord | null>(null);
  useEffect(() => {
    let active = true;
    fetchJson<SidoStatsResponse>("/api/weather/sido-stats")
      .then((res) => {
        if (active) setRecord(nationalRecord(res.stats, 30));
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);
  return (
    <Page>
      <Eyebrow>아 맞다 우산 이야기</Eyebrow>
      <h1>강수확률이 30%라면, 실제로 얼마나 비가 올까?</h1>
      <h2>어떤 사이트인가요?</h2>
      <p>
        기상청 단기예보에는 &ldquo;강수확률 30%&rdquo; 같은 숫자가 붙어요.
        그런데 30%라고 했을 때, 정말로 비가 왔을까요? 아 맞다 우산은 이걸
        하나하나 맞춰봐요. 원리는 간단해요.
      </p>
      <Steps>
        <li>
          <b>예보 적기</b>
          <span>매시간, 그 시각의 기상청 강수확률을 적어둬요.</span>
        </li>
        <li>
          <b>실제 비 확인</b>
          <span>
            그 시각이 되면 관측(초단기실황)으로 실제로 비가 왔는지 확인해요.
          </span>
        </li>
        <li>
          <b>확률별로 세기</b>
          <span>
            0%, 20%, 30%, 60% … 강수확률마다 몇 번 중 몇 번 비가 왔는지 세요.
          </span>
        </li>
      </Steps>
      <Example>
        <span>예시</span>
        <p>
          우리 동네에 <b>30% 예보가 100번</b> 있었고 그중 <b>6번</b> 비가
          왔다면, 이 동네의 30%는 실제로 <mark>6%</mark>였던 셈이에요.
        </p>
      </Example>
      <p>실제로 재보니, 기상청 강수확률 30% 예보 때 비가 온 비율은 이랬어요.</p>
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
      <Expansion>
        <p>
          처음에는 17개 시도만 기록했는데, 이번에는{" "}
          <mark>전국 252개 시군구</mark>로 넓혔어요. 이제 내가 사는 구에서
          예보가 몇 번 나왔고, 그중 실제로 비가 몇 번 왔는지 확인할 수 있어요.
        </p>
        <Link to="/">우리 동네 기록 보러 가기 →</Link>
      </Expansion>
      <Story>
        <h2>왜 만들었나요?</h2>
        <p>
          시작은 단순했어요. 예보를 보고 나갔다가 비를 맞는 일이 잦아서,
          강수확률이 실제로 얼마나 들어맞는지 직접 재보고 싶었어요.
        </p>
        <h2>V1, 30개월의 기록</h2>
        <p>
          17개 시도의 강수를 기록하던 V1은 30개월 넘게 운영했어요. 그 기록에서{" "}
          <mark>강수확률 30% 예보 때 실제로 비가 온 비율은 5.9%</mark>였어요. 큰
          계획이 있던 건 아니었지만, 예보 때문에 속상했던 분들이 가끔 찾아와
          재밌는 반응을 남겨주셔서 오래 이어올 수 있었어요.
        </p>
        <p>
          그동안 사고도 있었어요. 국가정보자원관리원 화재로 수집이 일주일 가까이
          멈춘 적이 있었고, 바람에 날아온 파라솔이 집 앞 전봇대에 걸리면서 몇
          회차의 자료가 통째로 사라진 적도 있었어요. 그때마다 복구하며 거의
          사명감으로 기록을 이어왔어요.
        </p>
        <h2>그리고 V2</h2>
        <p>
          그렇게 쌓은 운영 경험을 바탕으로, 이번에는 더 좋은 통찰을 드릴 수 있지
          않을까 해서 기존 프로젝트를 252개 시군구로 확장했어요.
        </p>
      </Story>
      <section>
        <h2>이 숫자, 예보 대신 믿어도 되나요?</h2>
        <p>
          기록은 &ldquo;지난번엔 이랬다&rdquo;를 알려줘요. &ldquo;내일은 이럴
          것이다&rdquo;는 여전히 기상청 예보가 가장 잘 알아요. 예보를 볼 때 옆에
          두고, 우리 동네에서 이 숫자가 어떤 뜻이었는지 떠올리는 용도로
          써주세요.
        </p>
      </section>
      <Credit>자료제공 및 출처: 기상청</Credit>
      <Link to="/">지도로 돌아가기</Link>
    </Page>
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
    margin: 0 0 10px;
    font-size: 1.05rem;
    color: #19251e;
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

const Expansion = styled.div`
  margin-top: 24px;

  a {
    font-weight: 600;
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
