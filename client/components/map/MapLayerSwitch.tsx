import styled from "@emotion/styled";
import type { MapLayerKind } from "./MapOverlay";

interface MapLayerSwitchProps {
  layer: MapLayerKind;
  onChange: (layer: MapLayerKind) => void;
}

const LAYERS: { value: MapLayerKind; label: string }[] = [
  { value: "pop", label: "강수확률" },
  { value: "surprise", label: "아니 땐 비" },
];

export function MapLayerSwitch({ layer, onChange }: MapLayerSwitchProps) {
  return (
    <Switch role="radiogroup" aria-label="지도 레이어">
      {LAYERS.map(({ value, label }) => (
        <Option
          key={value}
          type="button"
          role="radio"
          aria-checked={layer === value}
          $active={layer === value}
          $record={value === "surprise"}
          onClick={() => onChange(value)}
        >
          {label}
        </Option>
      ))}
    </Switch>
  );
}

const Switch = styled.div`
  position: absolute;
  z-index: 2;
  right: 16px;
  bottom: 44px;
  display: flex;
  padding: 3px;
  border: 1px solid #303847;
  border-radius: 10px;
  background: rgb(14 18 26 / 0.88);
  backdrop-filter: blur(12px);

  @media (max-width: 640px) {
    right: 12px;
    bottom: 36px;
  }
`;

// 아 맞다 우산의 기록(아니 땐 비)은 amber, 기상청 예보는 blue로 구분한다.
const Option = styled.button<{ $active: boolean; $record: boolean }>`
  height: 32px;
  padding: 0 12px;
  border: none;
  border-radius: 7px;
  font: inherit;
  font-size: 0.8rem;
  font-weight: 700;
  cursor: pointer;
  color: ${({ $active, $record }) =>
    $active ? ($record ? "var(--record)" : "#edf6ff") : "#8b96a8"};
  background: ${({ $active, $record }) =>
    $active
      ? $record
        ? "rgb(var(--record-rgb) / 0.16)"
        : "#17466a"
      : "transparent"};
  transition:
    background 0.15s ease,
    color 0.15s ease;

  &:hover:not([aria-checked="true"]) {
    color: #e9eef7;
  }
  &:focus-visible {
    outline: 2px solid #6ebaff;
    outline-offset: 2px;
  }
`;
