import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { fetchCurrentUser } from "../../shared/api/auth";
import { useAuthStore } from "../../shared/auth/useAuthStore";
import { useSessionStore } from "../../shared/store/useSessionStore";

function readHashParam(name: string) {
  const hash = window.location.hash.startsWith("#")
    ? window.location.hash.slice(1)
    : window.location.hash;
  return new URLSearchParams(hash).get(name);
}

export default function GoogleAuthCallbackPage() {
  const navigate = useNavigate();
  const setSession = useAuthStore((state) => state.setSession);
  const clearSession = useAuthStore((state) => state.clearSession);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const completeGoogleLogin = async () => {
      const accessToken = readHashParam("accessToken");
      const providerError = readHashParam("error");

      if (!accessToken) {
        if (!cancelled) {
          clearSession();
          setError(providerError || "구글 로그인 정보를 받아오지 못했습니다.");
          setPending(false);
        }
        return;
      }

      try {
        useAuthStore.getState().setAccessToken(accessToken);
        const currentUser = await fetchCurrentUser();

        if (cancelled) {
          return;
        }

        setSession(currentUser, accessToken);
        useSessionStore.getState().setCurrentNickname(currentUser.nickname);
        window.history.replaceState({}, document.title, "/auth/google/callback");
        navigate("/maps", { replace: true });
      } catch (callbackError) {
        if (!cancelled) {
          clearSession();
          setError(
            (callbackError as Error).message ||
              "구글 로그인 후 세션을 여는 데 실패했습니다.",
          );
          setPending(false);
        }
      }
    };

    void completeGoogleLogin();

    return () => {
      cancelled = true;
    };
  }, [clearSession, navigate, setSession]);

  return (
    <section className="panel stack account-page">
      <div className="panel__header">
        <div>
          <p className="eyebrow">Google Login</p>
          <h2>
            {pending
              ? "구글 로그인 결과를 연결하고 있습니다."
              : "구글 로그인 연결을 마치지 못했습니다."}
          </h2>
        </div>
      </div>

      {pending ? (
        <p className="lede">
          세션을 확인한 뒤 바로 맵 화면으로 이동합니다. 잠깐만 기다려 주세요.
        </p>
      ) : (
        <>
          <p className="lede">
            {error || "구글 로그인 결과를 처리하지 못했습니다."}
          </p>
          <div className="button-row">
            <Link className="button" to="/account">
              계정 화면으로 돌아가기
            </Link>
          </div>
        </>
      )}
    </section>
  );
}
