import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { config } from "../config.js";
import { findUserById } from "../services/users.js";
import { fail } from "../utils/http.js";

type JwtPayload = {
  sub: string;
};

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) return fail(res, 401, "请先登录");

  try {
    const payload = jwt.verify(token, config.jwtSecret) as JwtPayload;
    const user = findUserById(payload.sub);
    if (!user) return fail(res, 401, "登录状态已失效");
    Object.assign(req, {
      user: {
        id: user.id,
        username: user.username,
        nickname: user.nickname || user.username,
        profile_user_id: user.profile_user_id
      }
    });
    return next();
  } catch {
    return fail(res, 401, "登录状态已失效");
  }
}
