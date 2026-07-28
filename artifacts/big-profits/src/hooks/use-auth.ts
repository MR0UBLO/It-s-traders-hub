import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import type { User } from "@workspace/api-client-react";

export function useAuth() {
  const [token, setTokenState] = useState<string | null>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("bp_token");
    }
    return null;
  });

  const [user, setUserState] = useState<User | null>(() => {
    if (typeof window !== "undefined") {
      const u = localStorage.getItem("bp_user");
      return u ? JSON.parse(u) : null;
    }
    return null;
  });

  const [, setLocation] = useLocation();

  const setAuth = (newToken: string, newUser: User) => {
    localStorage.setItem("bp_token", newToken);
    localStorage.setItem("bp_user", JSON.stringify(newUser));
    setTokenState(newToken);
    setUserState(newUser);
  };

  const logout = () => {
    localStorage.removeItem("bp_token");
    localStorage.removeItem("bp_user");
    setTokenState(null);
    setUserState(null);
    setLocation("/login");
  };

  return {
    token,
    user,
    setAuth,
    logout,
    isAuthenticated: !!token,
  };
}