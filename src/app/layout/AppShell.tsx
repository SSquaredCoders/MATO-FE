import React from "react";
import { NavLink, useLocation } from "react-router-dom";
import { APP_TITLE } from "../../shared/config/env";
import { getProgression, useProgressionStore } from "../../shared/store/useProgressionStore";

interface AppShellProps {
  children: React.ReactNode;
}

const links = [
  { to: "/", label: "로비", icon: "⌂" },
  { to: "/maps", label: "맵", icon: "▦" },
  { to: "/roadmap", label: "미션", icon: "◇" },
  { to: "/account", label: "프로필", icon: "○" },
];

export function AppShell({ children }: AppShellProps) {
  const location = useLocation();
  const totalXp = useProgressionStore((state) => state.totalXp);
  const beats = useProgressionStore((state) => state.beats);
  const progression = getProgression(totalXp);
  const isRoomRoute = location.pathname.startsWith("/room/");
  const isWorkbenchRoute = location.pathname.startsWith("/maps");
  const isLobbyRoute = location.pathname === "/";
  const isGuideRoute = location.pathname.startsWith("/roadmap");
  const isAccountRoute =
    location.pathname.startsWith("/account") ||
    location.pathname.startsWith("/login") ||
    location.pathname.startsWith("/signup");

  const shellClassName = isRoomRoute
    ? "shell game-shell shell--room"
    : isWorkbenchRoute
      ? "shell game-shell shell--workbench"
      : isLobbyRoute
        ? "shell game-shell shell--lobby"
        : "shell game-shell";
  const headerClassName = isRoomRoute
    ? "shell__header game-hud shell__header--room"
    : isWorkbenchRoute
      ? "shell__header game-hud shell__header--workbench"
      : "shell__header game-hud";

  const eyebrowLabel = isRoomRoute
    ? "게임 플레이"
    : isWorkbenchRoute
      ? "맵 스튜디오"
      : isGuideRoute
        ? "플레이 안내"
        : isAccountRoute
          ? "내 정보"
          : "홈";

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
        <NavLink className="game-brand" to="/" aria-label={`${APP_TITLE} 로비`}>
          <span className="game-brand__mark" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          <span className="game-brand__copy">
            <strong>{APP_TITLE}</strong>
            <small>{eyebrowLabel}</small>
          </span>
        </NavLink>

        <div className="game-hud__progress" aria-label={`레벨 ${progression.level}`}>
          <span className="game-level">LV.{String(progression.level).padStart(2, "0")}</span>
          <div className="game-xp">
            <span>PLAYER EXP</span>
            <strong>
              {progression.xpInLevel}<small> / {progression.xpForNextLevel}</small>
            </strong>
            <i>
              <b style={{ width: `${progression.progress}%` }} />
            </i>
          </div>
        </div>

        <div className="game-currency" aria-label={`${beats} 비트 보유`}>
          <span className="game-currency__icon" aria-hidden="true">♪</span>
          <span>
            <small>BEAT</small>
            <strong>{beats.toLocaleString("ko-KR")}</strong>
          </span>
        </div>

        <nav className="game-nav" aria-label="주 메뉴">
          {links.map((link) => (
            <NavLink
              key={link.to}
              className={({ isActive }) =>
                isActive ? "game-nav__link game-nav__link--active" : "game-nav__link"
              }
              to={link.to}
            >
              <span aria-hidden="true">{link.icon}</span>
              <small>{link.label}</small>
            </NavLink>
          ))}
          <button className="game-nav__link game-nav__link--locked" type="button" disabled>
            <span aria-hidden="true">♙</span>
            <small>캐릭터</small>
            <i>LOCKED</i>
          </button>
        </nav>
      </header>

      <main className="shell__content">{children}</main>
    </div>
  );
}
