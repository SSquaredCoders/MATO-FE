import { useEffect } from "react";
import { fetchCurrentUser } from "../../shared/api/auth";
import { ApiError } from "../../shared/api/http";
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
      } catch (error) {
        if (!disposed) {
          if (error instanceof ApiError && [401, 403].includes(error.status)) {
            clearSession();
            return;
          }

          // A temporary API, network, or tunnel failure must not erase a valid
          // locally restored session. Feature queries can retry once the API recovers.
          setReady(true);
        }

        return;
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
