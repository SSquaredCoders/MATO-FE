import React, { useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { loginUser, logoutUser, registerUser } from "../../shared/api/auth";
import { useAuthStore } from "../../shared/auth/useAuthStore";
import { useSessionStore } from "../../shared/store/useSessionStore";

type AccountMode = "login" | "register";

export default function AccountPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const authReady = useAuthStore((state) => state.ready);
  const user = useAuthStore((state) => state.user);
  const setSession = useAuthStore((state) => state.setSession);
  const clearSession = useAuthStore((state) => state.clearSession);
  const setCurrentNickname = useSessionStore((state) => state.setCurrentNickname);
  const defaultMode = useMemo<AccountMode>(() => {
    return location.pathname === "/signup" ? "register" : "login";
  }, [location.pathname]);
  const [mode, setMode] = useState<AccountMode>(defaultMode);
  const [userId, setUserId] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [nickname, setNickname] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const resetFeedback = () => {
    setMessage(null);
    setError(null);
  };

  const handleLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    resetFeedback();
    setPending(true);

    try {
      const session = await loginUser({
        userId: userId.trim(),
        password,
      });
      setSession(session.user, session.accessToken);
      setMessage(`${session.user.nickname}님으로 로그인했습니다.`);
      navigate("/maps");
    } catch (loginError) {
      setError((loginError as Error).message || "로그인에 실패했습니다.");
    } finally {
      setPending(false);
    }
  };

  const handleRegister = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    resetFeedback();
    setPending(true);

    try {
      await registerUser({
        userId: userId.trim(),
        password,
        confirmPassword,
        nickname: nickname.trim(),
      });

      const session = await loginUser({
        userId: userId.trim(),
        password,
      });
      setSession(session.user, session.accessToken);
      setMessage(`${session.user.nickname}님 계정을 만들고 바로 로그인했습니다.`);
      navigate("/maps");
    } catch (registerError) {
      setError((registerError as Error).message || "회원가입에 실패했습니다.");
    } finally {
      setPending(false);
    }
  };

  const handleLogout = async () => {
    resetFeedback();
    setPending(true);

    try {
      await logoutUser();
      setMessage("로그아웃했습니다.");
    } catch (logoutError) {
      setError((logoutError as Error).message || "로그아웃 요청에 실패했습니다.");
    } finally {
      setCurrentNickname("");
      clearSession();
      setPending(false);
    }
  };

  if (!authReady) {
    return (
      <section className="panel stack">
        <p className="eyebrow">계정</p>
        <h2>로그인 상태를 확인하는 중입니다.</h2>
        <p className="footnote">조금만 기다리면 바로 이어서 사용할 수 있어요.</p>
      </section>
    );
  }

  if (user) {
    return (
      <section className="panel stack account-page">
        <div className="panel__header">
          <div>
            <p className="eyebrow">현재 계정</p>
            <h2>{user.nickname}님으로 로그인 중입니다.</h2>
          </div>
          <div className="chip-list">
            <span className="chip">아이디 {user.userId}</span>
            <span className="chip">{user.role}</span>
          </div>
        </div>

        <p className="lede">
          맵 만들기와 수정은 이제 로그인한 계정 기준으로 자동 연결됩니다. 닉네임을 따로
          입력하지 않아도 돼요.
        </p>

        <div className="grid grid--two">
          <article className="panel account-page__card">
            <p className="eyebrow">바로 가기</p>
            <h3>작업 이어가기</h3>
            <div className="button-row">
              <Link className="button" to="/maps">
                맵으로 이동
              </Link>
              <Link className="button button--ghost" to="/">
                로비로 이동
              </Link>
            </div>
          </article>

          <article className="panel account-page__card">
            <p className="eyebrow">세션</p>
            <h3>현재 브라우저 세션</h3>
            <div className="button-row">
              <button className="button button--ghost" onClick={handleLogout} type="button">
                {pending ? "정리 중..." : "로그아웃"}
              </button>
            </div>
          </article>
        </div>

        {message ? <p className="footnote account-page__message">{message}</p> : null}
        {error ? <p className="footnote account-page__error">{error}</p> : null}
      </section>
    );
  }

  return (
    <section className="panel stack account-page">
      <div className="panel__header">
        <div>
          <p className="eyebrow">계정</p>
          <h2>로그인하고 맵과 방을 계정 기준으로 쓰세요.</h2>
        </div>
        <div className="chip-list">
          <span className="chip">맵 생성 자동 연결</span>
          <span className="chip">닉네임 수동 입력 축소</span>
        </div>
      </div>

      <p className="lede">
        지금부터는 맵 작성자를 로그인 사용자로 잡습니다. 베타 단계라서 방 입장 쪽은
        유연하게 두더라도, 맵 관리 쪽은 계정 기준으로 정리하는 편이 안전해요.
      </p>

      <div className="button-row">
        <button
          className={`button button--ghost${mode === "login" ? " map-mode-button--active" : ""}`}
          onClick={() => {
            setMode("login");
            resetFeedback();
          }}
          type="button"
        >
          로그인
        </button>
        <button
          className={`button button--ghost${mode === "register" ? " map-mode-button--active" : ""}`}
          onClick={() => {
            setMode("register");
            resetFeedback();
          }}
          type="button"
        >
          회원가입
        </button>
      </div>

      {mode === "login" ? (
        <form className="stack" onSubmit={handleLogin}>
          <label className="field">
            <span>아이디</span>
            <input
              autoComplete="username"
              value={userId}
              onChange={(event) => setUserId(event.target.value)}
              placeholder="로그인 아이디"
              required
            />
          </label>

          <label className="field">
            <span>비밀번호</span>
            <input
              autoComplete="current-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="비밀번호"
              required
            />
          </label>

          <div className="button-row">
            <button className="button" disabled={pending} type="submit">
              {pending ? "로그인 중..." : "로그인"}
            </button>
          </div>
        </form>
      ) : (
        <form className="stack" onSubmit={handleRegister}>
          <label className="field">
            <span>아이디</span>
            <input
              autoComplete="username"
              value={userId}
              onChange={(event) => setUserId(event.target.value)}
              placeholder="새 아이디"
              required
            />
          </label>

          <label className="field">
            <span>닉네임</span>
            <input
              autoComplete="nickname"
              value={nickname}
              onChange={(event) => setNickname(event.target.value)}
              placeholder="게임에서 표시될 이름"
              required
            />
          </label>

          <label className="field">
            <span>비밀번호</span>
            <input
              autoComplete="new-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="비밀번호"
              required
            />
          </label>

          <label className="field">
            <span>비밀번호 확인</span>
            <input
              autoComplete="new-password"
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              placeholder="비밀번호 다시 입력"
              required
            />
          </label>

          <div className="button-row">
            <button className="button" disabled={pending} type="submit">
              {pending ? "계정 만드는 중..." : "회원가입 후 바로 로그인"}
            </button>
          </div>
        </form>
      )}

      {message ? <p className="footnote account-page__message">{message}</p> : null}
      {error ? <p className="footnote account-page__error">{error}</p> : null}
    </section>
  );
}
