import React from "react";
import { NavLink, useLocation } from "react-router-dom";
import { APP_TITLE } from "../../shared/config/env";
import { useAuthStore } from "../../shared/auth/useAuthStore";
import { getProgression, useProgressionStore } from "../../shared/store/useProgressionStore";

interface AppShellProps {
  children: React.ReactNode;
}

const links = [
  { to: "/", label: "게임 로비" },
  { to: "/maps", label: "맵 만들기" },
  { to: "/roadmap", label: "게임 방법" },
  { to: "/account", label: "내 정보" },
];

export function AppShell({ children }: AppShellProps) {
  const location = useLocation();
  const authUser = useAuthStore((state) => state.user);
  const totalXp = useProgressionStore((state) => state.totalXp);
  const beats = useProgressionStore((state) => state.beats);
  const progression = getProgression(totalXp);
  const isRoomRoute = location.pathname.startsWith("/room/");
  const isWorkbenchRoute =
    location.pathname.startsWith("/maps") ||
    location.pathname.startsWith("/create-map") ||
    location.pathname.startsWith("/edit-map");
  const isLobbyRoute = location.pathname === "/";
  const isGuideRoute = location.pathname.startsWith("/roadmap");
  const isAccountRoute =
    location.pathname.startsWith("/account") ||
    location.pathname.startsWith("/login") ||
    location.pathname.startsWith("/signup");

  const shellClassName = isRoomRoute
    ? "shell qp-shell shell--room qp-shell--room"
    : isWorkbenchRoute
      ? "shell qp-shell shell--workbench qp-shell--workbench"
      : isLobbyRoute
        ? "shell qp-shell qp-shell--lobby"
        : "shell qp-shell";

  React.useEffect(() => {
    if (isRoomRoute) {
      const roomName = decodeURIComponent(location.pathname.split("/").pop() || "");
      document.title = roomName ? `${APP_TITLE} · ${roomName}` : `${APP_TITLE} · 게임 방`;
      return;
    }
    if (isWorkbenchRoute) {
      document.title = `${APP_TITLE} · 맵 만들기`;
      return;
    }
    if (isGuideRoute) {
      document.title = `${APP_TITLE} · 게임 방법`;
      return;
    }
    if (isAccountRoute) {
      document.title = `${APP_TITLE} · 내 정보`;
      return;
    }
    document.title = `${APP_TITLE} · 게임 로비`;
  }, [isAccountRoute, isGuideRoute, isRoomRoute, isWorkbenchRoute, location.pathname]);

  return (
    <div className={shellClassName}>
      <header className="qp-topbar">
        <NavLink className="qp-logo" to="/" aria-label={`${APP_TITLE} 게임 로비`}>
          <span className="qp-logo__bubble" aria-hidden="true">Q</span>
          <span className="qp-logo__name">
            <strong>{APP_TITLE}</strong>
            <small>MUSIC QUIZ</small>
          </span>
        </NavLink>

        <nav className="qp-tabs" aria-label="주 메뉴">
          {links.map((link) => (
            <NavLink
              key={link.to}
              className={({ isActive }) =>
                isActive ? "qp-tab qp-tab--active" : "qp-tab"
              }
              to={link.to}
            >
              {link.label}
            </NavLink>
          ))}
          <button className="qp-tab qp-tab--disabled" type="button" disabled>
            캐릭터 <small>준비 중</small>
          </button>
        </nav>

        <div className="qp-player-mini">
          <span className="qp-player-mini__face" aria-hidden="true">♪</span>
          <div>
            <strong>{authUser?.nickname ?? "게스트"}</strong>
            <span>Lv.{progression.level} · BEAT {beats.toLocaleString("ko-KR")}</span>
          </div>
          <div className="qp-player-mini__xp" aria-label="경험치 진행도">
            <i style={{ width: `${progression.progress}%` }} />
          </div>
        </div>
      </header>

      <main className="shell__content qp-content">{children}</main>
    </div>
  );
}
