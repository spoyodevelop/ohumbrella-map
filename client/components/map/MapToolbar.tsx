import styled from "@emotion/styled";

interface MapToolbarProps {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onShowNational: () => void;
}

export function MapToolbar({
  onZoomIn,
  onZoomOut,
  onShowNational,
}: MapToolbarProps) {
  return (
    <Toolbar aria-label="지도 확대 축소">
      <ToolBtn type="button" onClick={onZoomIn} aria-label="확대">
        +
      </ToolBtn>
      <ToolBtn type="button" onClick={onZoomOut} aria-label="축소">
        −
      </ToolBtn>
      <ToolBtn type="button" onClick={onShowNational}>
        전국
      </ToolBtn>
    </Toolbar>
  );
}

const Toolbar = styled.div`
  position: absolute;
  z-index: 2;
  top: 16px;
  right: 16px;
  display: flex;
  gap: 6px;

  @media (max-width: 640px) {
    top: 12px;
    right: 12px;
    flex-direction: column;
  }
`;

const ToolBtn = styled.button`
  min-width: 40px;
  height: 40px;
  padding: 0 12px;
  border: 1px solid #303847;
  border-radius: 8px;
  color: #e9eef7;
  background: rgb(14 18 26 / 0.88);
  font: inherit;
  font-weight: 700;
  cursor: pointer;
  backdrop-filter: blur(12px);

  &:hover {
    background: #202838;
  }
  &:focus-visible {
    outline: 2px solid #6ebaff;
    outline-offset: 2px;
  }
`;
