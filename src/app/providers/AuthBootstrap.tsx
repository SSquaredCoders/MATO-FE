import { useEffect } from "react";
import { fetchCurrentUser } from "../../shared/api/auth";
import { useAuthStore } from "../../shared/auth/useAuthStore";
import { useSessionStore } from "../../shared/store/useSessionStore";

export function AuthBootstrap() {
  const accessToken = useAuthStore((state) => state.accessToken);
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);
  const clearSession = useAuthStore((state) => state.clearSession);
  const setReady = useAuthStore((state) => state.setReady);

  useEffect(() => {
    let disposed = false;

    const bootstrap = async () => {
      if (!accessToken) {
        setReady(true);
        return;
      }

      setReady(false);
      try {
        const currentUser = await fetchCurrentUser();
        if (!disposed) {
          setUser(currentUser);
        }
      } catch {
        if (!disposed) {
          clearSession();
          return;
        }
      }

      if (!disposed) {
        setReady(true);
      }
    };

    void bootstrap();

    return () => {
      disposed = true;
    };
  }, [accessToken, clearSession, setReady, setUser]);

  useEffect(() => {
    if (user?.nickname) {
      useSessionStore.getState().setCurrentNickname(user.nickname);
    }
  }, [user?.nickname]);

  return null;
}
