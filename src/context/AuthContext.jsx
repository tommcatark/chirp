import { createContext, useCallback, useContext, useMemo, useState } from "react";
import {
  authApi,
  clearAuth,
  loadToken,
  loadUser,
  saveAuth,
  updateStoredUser
} from "../lib/api.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => loadUser());
  const [token, setToken] = useState(() => loadToken());

  const signIn = useCallback((data, remember = true) => {
    const nextUser = { ...data };
    delete nextUser.token;
    delete nextUser.message;
    saveAuth(nextUser, data.token, remember);
    setUser(nextUser);
    setToken(data.token || null);
    return nextUser;
  }, []);

  const signOut = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      /* 即使后端不可用，也要清理本地登录态 */
    }
    clearAuth();
    setUser(null);
    setToken(null);
  }, []);

  const updateUser = useCallback((patch) => {
    setUser((prev) => {
      const next = { ...(prev || {}), ...patch };
      updateStoredUser(next);
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({ user, token, isAuthed: Boolean(token), signIn, signOut, updateUser }),
    [user, token, signIn, signOut, updateUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth 必须在 AuthProvider 内使用");
  return context;
}
