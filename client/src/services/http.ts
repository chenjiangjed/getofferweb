import type { ApiResponse } from "../types/api";
import { useAuthStore } from "../stores/authStore";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "";
export const USE_MOCK = import.meta.env.VITE_USE_MOCK !== "false";

type RequestOptions = RequestInit & {
  skipAuth?: boolean;
};

export class ApiError<T = unknown> extends Error {
  data: T | null;

  constructor(message: string, data: T | null = null) {
    super(message);
    this.name = "ApiError";
    this.data = data;
  }
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const token = useAuthStore.getState().token;
  const headers = new Headers(options.headers);

  if (!(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  if (token && !options.skipAuth) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers
  });

  if (response.status === 401 && !options.skipAuth) {
    useAuthStore.getState().logout();
    window.location.href = "/login";
    throw new Error("登录已过期，请重新登录");
  }

  const json = (await response.json()) as ApiResponse<T> | T;
  if (!response.ok) {
    if (typeof json === "object" && json && "message" in json) {
      const wrapped = json as ApiResponse<T>;
      throw new ApiError(wrapped.message || "请求失败，请稍后重试", wrapped.data);
    }
    throw new ApiError("请求失败，请稍后重试");
  }

  if (typeof json === "object" && json && "success" in json) {
    const wrapped = json as ApiResponse<T>;
    if (!wrapped.success) {
      throw new ApiError(wrapped.message || "操作失败", wrapped.data);
    }
    return wrapped.data;
  }

  return json as T;
}

export function delay(ms = 500) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}
