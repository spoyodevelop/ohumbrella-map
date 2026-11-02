import styled from "@emotion/styled";
import { NavLink } from "react-router";

export function SiteNav() {
  return (
    <Nav aria-label="사이트">
      <NavLink to="/" end>
        지도
      </NavLink>
      <NavLink to="/about">소개</NavLink>
    </Nav>
  );
}

const Nav = styled.nav`
  display: flex;
  gap: 4px;
  width: min(100%, 1600px);
  margin: 0 auto;
  padding: 16px 28px 0;
  box-sizing: border-box;

  a {
    padding: 6px 10px;
    border-radius: 6px;
    color: #758095;
    font-size: 0.85rem;
    text-decoration: none;
  }

  a:hover {
    color: #dce5f2;
  }

  a.active {
    color: #edf6ff;
    background: #17466a;
  }

  a:focus-visible {
    outline: 2px solid #6ebaff;
    outline-offset: 2px;
  }

  @media (max-width: 640px) {
    padding: 12px 16px 0;
  }
`;
