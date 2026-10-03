"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api, storage, type User } from "./api";

type Auth = {
  user: User | null;
  ready: boolean;
  login: (login: string, password: string) => Promise<User>;
  logout: () => void;
};

const Ctx = createContext<Auth | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const cached = storage.user();
    setUser(cached);
    setReady(true);
    if (cached) {
      // refresh in the background; a 401 clears the session inside api()
      api<User>("/auth/me")
        .then((u) => (storage.saveUser(u), setUser(u)))
        .catch(() => {});
    }
  }, []);

  const login = useCallback(async (login: string, password: string) => {
    const r = await api<{ token: string; user: User }>("/auth/login", { method: "POST", body: { login, password } });
    storage.save(r.token, r.user);
    setUser(r.user);
    return r.user;
  }, []);

  const logout = useCallback(() => {
    storage.clear();
    setUser(null);
  }, []);

  return <Ctx.Provider value={{ user, ready, login, logout }}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAuth outside AuthProvider");
  return c;
}

export const roleLabel = { admin: "مدير المنظومة", supervisor: "مشرف", teacher: "معلم", student: "طالب" } as const;
