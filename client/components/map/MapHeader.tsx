import styled from "@emotion/styled";
import type { MapRegion } from "../../types";

interface MapHeaderProps {
  currentSido: MapRegion | undefined;
  weatherTime?: string;
}

export function MapHeader({ currentSido, weatherTime }: MapHeaderProps) {
  return (
    <Header>
      <div>
        <Eyebrow>
          아 맞다 우산 <BetaBadge>beta</BetaBadge>
        </Eyebrow>
        <Title>강수확률 30%, 우산 챙겨야 할까?</Title>
        <Subtitle>
          {currentSido?.name ?? "전국 252개 시군구"}의 예보와 실제 비를 매시간
          기록하고 있어요
        </Subtitle>
      </div>
      {weatherTime && (
        <Status>
          <div>실황 기준 시각</div>
          <strong>{weatherTime}</strong>
          <KmaCredit>자료제공 및 출처: 기상청</KmaCredit>
        </Status>
      )}
    </Header>
  );
}

const Header = styled.header`
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 18px;
`;

const Eyebrow = styled.p`
  margin: 0;
  color: #758095;
  font:
    600 0.72rem/1.2 ui-monospace,
    SFMono-Regular,
    Menlo,
    monospace;
  letter-spacing: 0.08em;
  text-transform: uppercase;
`;

const Title = styled.h1`
  margin: 4px 0 0;
  color: #f5f7fb;
  font-size: clamp(1.8rem, 5vw, 3.3rem);
  line-height: 1;
  letter-spacing: -0.055em;
`;

const Subtitle = styled.p`
  margin: 10px 0 0;
  color: #9aa6b8;
  font-size: 0.9rem;
  line-height: 1.4;
  word-break: keep-all;
`;

const Status = styled.div`
  color: #758095;
  font:
    600 0.72rem/1.2 ui-monospace,
    SFMono-Regular,
    Menlo,
    monospace;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  text-align: right;

  strong {
    color: #dce5f2;
    font-size: 1rem;
  }
`;

const KmaCredit = styled.span`
  display: block;
  margin-top: 4px;
  color: #4a5568;
  font-size: 0.62rem;
  font-weight: 500;
  letter-spacing: 0.04em;
  text-transform: none;
  white-space: nowrap;
`;

const BetaBadge = styled.span`
  display: inline-block;
  margin-left: 6px;
  padding: 1px 6px;
  border: 1px solid #3a5a8a;
  border-radius: 4px;
  background: rgb(30 60 110 / 0.35);
  color: #7eb8f7;
  font-size: 0.62rem;
  letter-spacing: 0.1em;
  vertical-align: middle;
  position: relative;
  top: -1px;
`;
