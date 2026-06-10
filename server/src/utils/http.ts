import type { Response } from "express";

export function ok<T>(res: Response, data: T, message = "") {
  return res.json({ success: true, data, message });
}

export function fail(res: Response, status: number, message: string) {
  return res.status(status).json({ success: false, data: null, message });
}

export function failWithData<T>(res: Response, status: number, message: string, data: T) {
  return res.status(status).json({ success: false, data, message });
}

export function isValidUsername(username: string) {
  return /^[A-Za-z0-9_]{3,20}$/.test(username);
}

export function isValidPassword(password: string) {
  return /^(?=.*[A-Za-z])(?=.*\d).{8,}$/.test(password);
}

export function safeProfilePath(profileUserId: string) {
  return encodeURIComponent(profileUserId).replace(/[!'()*]/g, (char) =>
    `%${char.charCodeAt(0).toString(16).toUpperCase()}`
  );
}

export function nowIso() {
  return new Date().toISOString();
}
