// Holds the logged-in user + token. Token lives in localStorage so a refresh
// keeps you signed in; on mount we validate it by fetching /api/me.
import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api, setToken, clearToken } from "../api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // On first load, ask the server who we are. The session cookie is sent
  // automatically, so a returning user with a valid cookie is logged in
  // without re-entering credentials.
  useEffect(() => {
    let cancelled = false;
    async function bootstrap() {
      try {
        const me = await api.me();
        if (!cancelled) setUser(me);
      } catch {
        clearToken();
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    bootstrap();
    return () => { cancelled = true; };
  }, []);

  // Throws ApiError on bad credentials — the Login page catches it.
  const login = useCallback(async (email, password) => {
    const { token, user } = await api.login(email, password);
    if (token) setToken(token); // header fallback alongside the cookie
    setUser(user);
    return user;
  }, []);

  // Register + auto sign-in. Throws ApiError on validation/duplicate errors.
  const register = useCallback(async (payload) => {
    const { token, user } = await api.register(payload);
    if (token) setToken(token);
    setUser(user);
    return user;
  }, []);

  const logout = useCallback(async () => {
    try { await api.logout(); } catch { /* clear locally regardless */ }
    clearToken();
    setUser(null);
  }, []);

  // Permanently delete the signed-in user's own account, then end the session.
  const deleteAccount = useCallback(async () => {
    await api.deleteMe();
    clearToken();
    setUser(null);
  }, []);

  // Replace the cached user after a profile edit.
  const updateUser = useCallback((next) => setUser(next), []);

  const value = { user, loading, login, register, logout, deleteAccount, updateUser, isAdmin: user?.role === "admin" };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
