import React from "react";
import { NavLink, useLocation } from "react-router-dom";
import { APP_TITLE } from "../../shared/config/env";

interface AppShellProps {
  children: React.ReactNode;
}

const links = [
  { to: "/", label: "홈" },
  { to: "/maps", label: "맵 스튜디오" },
  { to: "/roadmap", label: "플레이 안내" },
  { to: "/account", label: "내 정보" },
];

export function AppShell({ children }: AppShellProps) {
  const location = useLocation();
  const isRoomRoute = location.pathname.startsWith("/room/");
  const isWorkbenchRoute = location.pathname.startsWith("/maps");
  const isGuideRoute = location.pathname.startsWith("/roadmap");
  const isAccountRoute =
    location.pathname.startsWith("/account") ||
    location.pathname.startsWith("/login") ||
    location.pathname.startsWith("/signup");

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
    ? "게임 플레이"
    : isWorkbenchRoute
      ? "맵 스튜디오"
      : isGuideRoute
        ? "플레이 안내"
        : isAccountRoute
          ? "내 정보"
          : "홈";

  const summaryText = isWorkbenchRoute
    ? "맵을 만들고 정리한 뒤 바로 방에서 사용할 수 있습니다."
    : isRoomRoute
      ? "방 상태와 현재 라운드를 한 화면에서 확인합니다."
      : isGuideRoute
        ? "처음 들어온 사용자도 순서대로 따라갈 수 있게 정리했습니다."
        : isAccountRoute
          ? "로그인 상태와 맵 작성 권한을 관리하는 곳입니다."
          : "방을 만들고 열린 게임에 바로 참가할 수 있습니다.";

  React.useEffect(() => {
    if (isRoomRoute) {
      const roomName = decodeURIComponent(location.pathname.split("/").pop() || "");
      document.title = roomName
        ? `${APP_TITLE} · ${roomName}`
        : `${APP_TITLE} · 게임 방`;
      return;
    }

    if (isWorkbenchRoute) {
      document.title = `${APP_TITLE} · 맵 스튜디오`;
      return;
    }

    if (isGuideRoute) {
      document.title = `${APP_TITLE} · 플레이 안내`;
      return;
    }

    if (isAccountRoute) {
      document.title = `${APP_TITLE} · 내 정보`;
      return;
    }

    document.title = `${APP_TITLE} · 홈`;
  }, [isAccountRoute, isGuideRoute, isRoomRoute, isWorkbenchRoute, location.pathname]);

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
