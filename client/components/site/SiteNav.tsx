import styled from "@emotion/styled";
import { NavLink } from "react-router";

export function SiteNav() {
  return (
    <Nav aria-label="사이트">
      <NavLink to="/" end>
        아니 땐 비
      </NavLink>
      <NavLink to="/commute">출퇴근</NavLink>
      <NavLink to="/about">소개</NavLink>
    </Nav>
  );
}

const Nav = styled.nav`
  display: flex;
  gap: 4px;
  width: min(100%, 1360px);
  margin: 0 auto;
  padding: 20px 40px 0;
  box-sizing: border-box;

  a {
    padding: 6px 10px;
    border-radius: 6px;
    color: #526052;
    font-size: 0.85rem;
    text-decoration: none;
  }

  a:hover {
    color: #1752de;
  }

  a.active {
    color: #19251e;
    background: #ffe55b;
  }

  a:focus-visible {
    outline: 2px solid #6ebaff;
    outline-offset: 2px;
  }

  @media (max-width: 640px) {
    padding: 12px 16px 0;
  }
`;
