import React from "react";
import { NavLink, useLocation } from "react-router-dom";
import { APP_TITLE, API_BASE_URL, WS_BASE_URL } from "../../shared/config/env";

interface AppShellProps {
  children: React.ReactNode;
}

const links = [
  { to: "/", label: "로비" },
  { to: "/maps", label: "맵" },
  { to: "/roadmap", label: "로드맵" },
  { to: "/account", label: "계정" },
];

export function AppShell({ children }: AppShellProps) {
  const location = useLocation();
  const isRoomRoute = location.pathname.startsWith("/room/");
  const isWorkbenchRoute = location.pathname.startsWith("/maps");

  const shellClassName = isRoomRoute
    ? "shell shell--room"
    : isWorkbenchRoute
      ? "shell shell--workbench"
      : "shell";
  const headerClassName = isRoomRoute
    ? "shell__header shell__header--room"
    : isWorkbenchRoute
      ? "shell__header shell__header--workbench"
      : "shell__header";
  const brandClassName = isRoomRoute
    ? "shell__brand shell__brand--room"
    : isWorkbenchRoute
      ? "shell__brand shell__brand--workbench"
      : "shell__brand";
  const navClassName = isRoomRoute
    ? "nav nav--room"
    : isWorkbenchRoute
      ? "nav nav--workbench"
      : "nav";
  const eyebrowLabel = isRoomRoute
    ? "MATO ROOM"
    : isWorkbenchRoute
      ? "MATO MAP LAB"
      : "MATO V2 ROOM";

  return (
    <div className={shellClassName}>
      <header className={headerClassName}>
        <div className={brandClassName}>
          <p className="eyebrow">{eyebrowLabel}</p>
          <h1>{APP_TITLE}</h1>
          {!isRoomRoute && !isWorkbenchRoute ? (
            <p className="shell__summary">
              실시간 방 플레이를 중심으로 다시 정리한 웹 게임 프로토타입입니다.
            </p>
          ) : null}
        </div>

        <nav className={navClassName}>
          {links.map((link) => (
            <NavLink
              key={link.to}
              className={({ isActive }) =>
                isActive ? "nav__link nav__link--active" : "nav__link"
              }
              to={link.to}
            >
              {link.label}
            </NavLink>
          ))}
        </nav>
      </header>

      <main className="shell__content">{children}</main>

      {!isRoomRoute && !isWorkbenchRoute ? (
        <footer className="shell__footer">
          <div className="chip-list">
            <span className="chip">REST {API_BASE_URL}</span>
            <span className="chip">실시간 {WS_BASE_URL}</span>
            <span className="chip">Query + STOMP 루트</span>
          </div>
        </footer>
      ) : null}
    </div>
  );
}
