import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);

  useEffect(() => {
    api.get("/auth/me").then((r) => setUser(r.data.user)).catch(() => setUser(false));
  }, []);

  const login = useCallback(async (email, password) => {
    const { data } = await api.post("/auth/login", { email, password });
    if (data.mfa_required) return { mfaRequired: true, mfaToken: data.mfa_token };
    setUser(data.user);
    return { mfaRequired: false };
  }, []);

  const verifyMfa = useCallback(async (mfaToken, code) => {
    const { data } = await api.post("/auth/mfa/verify", { mfa_token: mfaToken, code });
    setUser(data.user);
  }, []);

  const logout = useCallback(async () => {
    try { await api.post("/auth/logout"); } catch (e) { /* session already gone */ }
    setUser(false);
  }, []);

  const refreshUser = useCallback(async () => {
    const { data } = await api.get("/auth/me");
    setUser(data.user);
  }, []);

  const value = useMemo(() => ({ user, login, verifyMfa, logout, refreshUser, can: (roles) => !!user && roles.includes(user.role) }), [user, login, verifyMfa, logout, refreshUser]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
