import React from "react";
import { NavLink, useLocation } from "react-router-dom";
import { APP_TITLE } from "../../shared/config/env";

interface AppShellProps {
  children: React.ReactNode;
}

const links = [
  { to: "/", label: "로비" },
  { to: "/maps", label: "맵" },
  { to: "/roadmap", label: "안내" },
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
    ? "게임 방"
    : isWorkbenchRoute
      ? "맵 관리"
      : "실시간 로비";

  const summaryText = isWorkbenchRoute
    ? "플레이할 맵을 만들고 정리하는 공간입니다."
    : isRoomRoute
      ? "방 상태와 현재 라운드를 한 화면에서 확인합니다."
      : "방을 만들고 참가 중인 게임에 바로 들어갈 수 있습니다.";

  return (
    <div className={shellClassName}>
      <header className={headerClassName}>
        <div className={brandClassName}>
          <p className="eyebrow">{eyebrowLabel}</p>
          <h1>{APP_TITLE}</h1>
          {!isRoomRoute ? (
            <p className="shell__summary">{summaryText}</p>
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
    </div>
  );
}
