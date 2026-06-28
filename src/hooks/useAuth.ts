"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  role: "admin" | "crew";
}

let cachedUser: AuthUser | null = null;
let listeners: Array<(user: AuthUser | null) => void> = [];

function notifyListeners(user: AuthUser | null) {
  cachedUser = user;
  listeners.forEach((l) => l(user));
}

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(cachedUser);
  const [loading, setLoading] = useState(!cachedUser);
  const router = useRouter();

  useEffect(() => {
    const listener = (u: AuthUser | null) => setUser(u);
    listeners.push(listener);

    if (!cachedUser) {
      fetch("/api/auth/me")
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          const u = data?.user ?? null;
          notifyListeners(u);
          setLoading(false);
        })
        .catch(() => {
          notifyListeners(null);
          setLoading(false);
        });
    } else {
      setLoading(false);
    }

    return () => {
      listeners = listeners.filter((l) => l !== listener);
    };
  }, []);

  const logout = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    notifyListeners(null);
  }, []);

  const login = useCallback((u: AuthUser) => {
    notifyListeners(u);
  }, []);

  return { user, loading, logout, login };
}
