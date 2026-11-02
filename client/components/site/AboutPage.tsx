import styled from "@emotion/styled";
import { useEffect, useState } from "react";
import { Link } from "react-router";
import type { SidoStatsResponse } from "../../../shared/weather";
import { fetchJson } from "../../lib/http";

interface NationalRecord {
  rate: number;
  samples: number;
}
// Sido buckets carry rates rounded to 0.1%, so the national rate is weighted
// by samples; the rounding stays well under the 0.1% shown.
function nationalRecord(res: SidoStatsResponse, pop: number) {
  let samples = 0;
  let rain = 0;
  for (const stat of res.stats) {
    const bucket = stat.stats[pop];
    if (!bucket) continue;
    samples += bucket.samples;
    rain += (bucket.rate * bucket.samples) / 100;
  }
  return samples ? { rate: (100 * rain) / samples, samples } : null;
}

export function AboutPage() {
  const [record, setRecord] = useState<NationalRecord | null>(null);
  useEffect(() => {
    let active = true;
    fetchJson<SidoStatsResponse>("/api/weather/sido-stats")
      .then((res) => {
        if (active) setRecord(nationalRecord(res, 30));
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
      <p>
        아 맞다 우산은 이 궁금증에서 시작한 서비스입니다. V1에서 17개 시도의
        예보와 실황을 수집·비교해,{" "}
        <mark>강수확률 30% 예보에서 실제로 비가 온 비율이 5.9%</mark>임을
        확인했습니다.
      </p>
      <p>
        30개월간 축적한 API 운영 지식과 데이터 집계 경험을 바탕으로,{" "}
        <mark>전국 252개 시군구</mark>의 예보 정확도를 비교하는 V2로
        확장했습니다.
      </p>
      <Figures aria-label="강수확률 30% 예보에서 실제로 비가 온 비율">
        <div>
          <span>V1 · 17개 시도</span>
          <span className="forecast">예보 30%</span>
          <strong>
            <span className="prefix">실제</span>5.9%
          </strong>
          <small>31,469번 기록</small>
        </div>
        <div>
          <span>지금 · 252개 시군구</span>
          <span className="forecast">예보 30%</span>
          <strong>
            <span className="prefix">실제</span>
            {record ? `${record.rate.toFixed(1)}%` : "—"}
          </strong>
          {record && (
            <small>{record.samples.toLocaleString("ko-KR")}번 기록</small>
          )}
        </div>
        <p>기상청 강수확률 30% 예보 때 실제로 비가 온 비율</p>
      </Figures>
      <section>
        <h2>기상청 강수확률 대신 써도 되나요?</h2>
        <p>
          간단히 말하면, 안 됩니다. 통계는 통계일 뿐, 실제 자료를 바탕으로 하는
          날씨예보와는 차이가 많고 한계점도 많습니다. 하지만 유용한 참고 자료가
          될 수 있어요. 항상 기상청의 예보와 비교하며, 참고용으로 사용하는 게
          바람직합니다.
        </p>
      </section>
      <Credit>자료제공 및 출처: 기상청</Credit>
      <Link to="/">지도로 돌아가기</Link>
    </Page>
  );
}

const Page = styled.main`
  width: min(100%, 720px);
  margin: 0 auto;
  padding: 48px 28px;
  box-sizing: border-box;

  h1 {
    margin: 0 0 24px;
    font-size: clamp(1.8rem, 5vw, 2.8rem);
    line-height: 1.15;
    letter-spacing: -0.05em;
    word-break: keep-all;
  }

  h2 {
    margin: 0 0 10px;
    font-size: 1.05rem;
    color: #e9eef7;
  }

  p {
    margin: 0 0 16px;
    color: #b4bfcf;
    line-height: 1.7;
    word-break: keep-all;
  }

  section {
    margin: 32px 0 24px;
    padding: 20px;
    border: 1px solid #303847;
    border-radius: 12px;
    background: #101722;
  }

  section p {
    margin: 0;
  }

  a {
    color: #b9daf7;
  }

  /* Amber marks 아 맞다 우산's own findings, as on the map and panel. */
  mark {
    padding: 0 2px;
    border-radius: 3px;
    color: #fbbf24;
    font-weight: 700;
    background: rgba(251, 191, 36, 0.12);
  }

  @media (max-width: 640px) {
    padding: 32px 16px;
  }
`;

const Figures = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin: 32px 0 0;

  div {
    padding: 18px;
    border: 1px solid #303847;
    border-radius: 12px;
    background: #101722;
  }

  span,
  small {
    display: block;
    color: #758095;
    font-size: 0.78rem;
    word-break: keep-all;
  }

  .forecast {
    margin-top: 10px;
    color: #94a3b8;
    font-size: 1rem;
    font-weight: 600;
  }

  strong {
    display: block;
    margin: 2px 0 6px;
    color: #fbbf24;
    font-size: clamp(2rem, 6vw, 3rem);
    letter-spacing: -0.04em;
  }

  strong .prefix {
    display: inline;
    margin-right: 6px;
    color: #fbbf24;
    font-size: 1rem;
    font-weight: 600;
    letter-spacing: 0;
  }

  && p {
    grid-column: 1 / -1;
    margin: 0;
    color: #758095;
    font-size: 0.8rem;
  }
`;

const Eyebrow = styled.p`
  && {
    margin: 0 0 10px;
    color: #758095;
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
