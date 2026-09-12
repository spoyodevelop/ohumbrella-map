import styled from "@emotion/styled";
import type { MapRegion } from "../../types";

interface MapHeaderProps {
  currentSido: MapRegion | undefined;
  regionCount: number;
}

export function MapHeader({ currentSido, regionCount }: MapHeaderProps) {
  return (
    <Header>
      <div>
        <Eyebrow>OH UMBRELLA / MAP SPIKE</Eyebrow>
        <Title>{currentSido?.name ?? "전국"} 강수 확률</Title>
      </div>
      <Status aria-live="polite">
        <strong>{regionCount || "—"}</strong> visible · LOD
      </Status>
    </Header>
  );
}

const Header = styled.header`
  display: flex;
  align-items: end;
  justify-content: space-between;
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
