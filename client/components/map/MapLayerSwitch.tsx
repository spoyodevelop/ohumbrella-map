import styled from "@emotion/styled";
import type { MapLayerKind } from "./MapOverlay";

interface MapLayerSwitchProps {
  layer: MapLayerKind;
  onChange: (layer: MapLayerKind) => void;
}

const LAYERS: { value: MapLayerKind; label: string }[] = [
  { value: "surprise", label: "비가 왔던 곳" },
  { value: "pop", label: "지금 강수확률" },
];

export function MapLayerSwitch({ layer, onChange }: MapLayerSwitchProps) {
  return (
    <Switch role="radiogroup" aria-label="지도에서 볼 정보">
      {LAYERS.map(({ value, label }) => (
        <Option
          key={value}
          type="button"
          role="radio"
          aria-checked={layer === value}
          $active={layer === value}
          $record={value === "surprise"}
          data-umami-event="layer-switch"
          data-umami-event-to={value}
          onClick={() => onChange(value)}
        >
          {label}
        </Option>
      ))}
    </Switch>
  );
}

const Switch = styled.div`
  display: flex;
  flex-shrink: 0;
  padding: 3px;
  border: 1px solid #26362b;
  border-radius: 4px;
  background: #fffdf6;
`;

// 아 맞다 우산의 기록(아니 땐 비)은 amber, 기상청 예보는 blue로 구분한다.
const Option = styled.button<{ $active: boolean; $record: boolean }>`
  height: 32px;
  padding: 0 12px;
  border: none;
  border-radius: 2px;
  font: inherit;
  font-size: 0.8rem;
  font-weight: 700;
  cursor: pointer;
  color: ${({ $active, $record }) =>
    $active ? ($record ? "#19251e" : "#fff") : "#596259"};
  background: ${({ $active, $record }) =>
    $active ? ($record ? "#ffe55b" : "#1752de") : "transparent"};
  transition:
    background 0.15s ease,
    color 0.15s ease;

  &:hover:not([aria-checked="true"]) {
    color: #19251e;
  }
  &:focus-visible {
    outline: 2px solid #6ebaff;
    outline-offset: 2px;
  }
`;
