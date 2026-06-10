import { delay, request, USE_MOCK } from "./http";
import type { AuthUser, LoginData } from "../types/api";

function mockUser(username: string, nickname = ""): AuthUser {
  return {
    id: `user_${username}`,
    username,
    nickname: nickname || username,
    profile_user_id: `user_${username.replace(/[^\w]/g, "_").slice(0, 20) || "demo"}`
  };
}

function normalizeLoginData(result: LoginData): LoginData {
  return {
    token: result.token,
    user: {
      id: result.user.id,
      username: result.user.username,
      nickname: result.user.nickname || result.user.username,
      profile_user_id: result.user.profile_user_id
    }
  };
}

export const authApi = {
  async register(username: string, password: string, captchaVerifyParam: string, nickname = ""): Promise<LoginData> {
    if (USE_MOCK) {
      await delay(450);
      return { token: `mock_jwt_${Date.now()}`, user: mockUser(username, nickname) };
    }
    const result = await request<LoginData>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ username, nickname, password, captchaVerifyParam }),
      skipAuth: true
    });
    return normalizeLoginData(result);
  },

  async login(username: string, password: string, captchaVerifyParam = ""): Promise<LoginData> {
    if (USE_MOCK) {
      await delay(400);
      return { token: `mock_jwt_${Date.now()}`, user: mockUser(username) };
    }
    const result = await request<LoginData>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password, captchaVerifyParam }),
      skipAuth: true
    });
    return normalizeLoginData(result);
  },

  async me(): Promise<AuthUser> {
    if (USE_MOCK) {
      await delay(200);
      const stored = localStorage.getItem("chu_user");
      if (!stored) throw new Error("未登录");
      return JSON.parse(stored) as AuthUser;
    }
    const result = await request<{ user: AuthUser }>("/api/auth/me");
    return {
      id: result.user.id,
      username: result.user.username,
      nickname: result.user.nickname || result.user.username,
      profile_user_id: result.user.profile_user_id
    };
  }
};
