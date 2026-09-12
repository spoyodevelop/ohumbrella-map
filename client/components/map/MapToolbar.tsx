import styled from "@emotion/styled";

interface MapToolbarProps {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onShowNational: () => void;
  onLocate: () => void;
  isLocating?: boolean;
}

export function MapToolbar({
  onZoomIn,
  onZoomOut,
  onShowNational,
  onLocate,
  isLocating = false,
}: MapToolbarProps) {
  return (
    <Toolbar aria-label="지도 조작 도구">
      <ToolBtn
        type="button"
        onClick={onLocate}
        disabled={isLocating}
        aria-label="현재 위치로 이동"
        title="현재 위치로 이동"
      >
        <LocateIcon
          $spinning={isLocating}
          viewBox="0 0 24 24"
          width="16"
          height="16"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="3" />
          <path d="M12 2v3m0 14v3M2 12h3m14 0h3" />
          <circle cx="12" cy="12" r="7" />
        </LocateIcon>
        <span>내 위치</span>
      </ToolBtn>
      <ToolBtn type="button" onClick={onShowNational}>
        전국
      </ToolBtn>
      <ToolBtn type="button" onClick={onZoomIn} aria-label="확대">
        +
      </ToolBtn>
      <ToolBtn type="button" onClick={onZoomOut} aria-label="축소">
        −
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
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  min-width: 40px;
  height: 40px;
  padding: 0 12px;
  border: 1px solid #303847;
  border-radius: 8px;
  color: #e9eef7;
  background: rgb(14 18 26 / 0.88);
  font: inherit;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  backdrop-filter: blur(12px);
  user-select: none;
  transition: background 0.15s ease, border-color 0.15s ease;

  &:hover:not(:disabled) {
    background: #202838;
    border-color: #434f63;
  }
  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
  &:focus-visible {
    outline: 2px solid #6ebaff;
    outline-offset: 2px;
  }
`;

const LocateIcon = styled.svg<{ $spinning?: boolean }>`
  flex-shrink: 0;
  ${({ $spinning }) =>
    $spinning &&
    `
    animation: spin 1s linear infinite;
    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
  `}
`;
