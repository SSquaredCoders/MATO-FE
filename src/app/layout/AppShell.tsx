import React from "react";
import { NavLink, useLocation } from "react-router-dom";
import { APP_TITLE, API_BASE_URL, WS_BASE_URL } from "../../shared/config/env";

interface AppShellProps {
  children: React.ReactNode;
}

const links = [
  { to: "/", label: "로비" },
  { to: "/room/demo-room", label: "방" },
  { to: "/maps", label: "맵" },
  { to: "/roadmap", label: "로드맵" },
  { to: "/account", label: "계정" },
];

export function AppShell({ children }: AppShellProps) {
  const location = useLocation();
  const isRoomRoute = location.pathname.startsWith("/room/");

  return (
    <div className={isRoomRoute ? "shell shell--room" : "shell"}>
      <header
        className={isRoomRoute ? "shell__header shell__header--room" : "shell__header"}
      >
        <div className="shell__brand">
          <p className="eyebrow">MATO V2 ROOM</p>
          <h1>{APP_TITLE}</h1>
          <p className="shell__summary">
            실시간 방 플레이를 중심으로 다시 정리한 웹 게임 프로토타입입니다.
          </p>
        </div>

        <nav className="nav">
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

      {!isRoomRoute ? (
        <footer className="shell__footer">
          <div className="chip-list">
            <span className="chip">REST {API_BASE_URL}</span>
            <span className="chip">실시간 {WS_BASE_URL}</span>
            <span className="chip">Query + STOMP 방 스트림</span>
          </div>
        </footer>
      ) : null}
    </div>
  );
}
