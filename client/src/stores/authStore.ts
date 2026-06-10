import { create } from "zustand";
import type { AuthUser } from "../types/api";

type AuthState = {
  token: string;
  user: AuthUser | null;
  setAuth: (token: string, user: AuthUser) => void;
  logout: () => void;
};

const tokenKey = "chu_token";
const userKey = "chu_user";

function readUser(): AuthUser | null {
  try {
    const value = localStorage.getItem(userKey);
    return value ? (JSON.parse(value) as AuthUser) : null;
  } catch {
    return null;
  }
}

export const useAuthStore = create<AuthState>((set) => ({
  token: localStorage.getItem(tokenKey) || "",
  user: readUser(),
  setAuth: (token, user) => {
    localStorage.setItem(tokenKey, token);
    localStorage.setItem(userKey, JSON.stringify(user));
    set({ token, user });
  },
  logout: () => {
    localStorage.removeItem(tokenKey);
    localStorage.removeItem(userKey);
    set({ token: "", user: null });
  }
}));
