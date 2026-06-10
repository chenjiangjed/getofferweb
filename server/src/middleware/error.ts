import type { NextFunction, Request, Response } from "express";
import { fail } from "../utils/http.js";

export function errorHandler(
  error: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  console.error("[server-error]", error);
  const message = error instanceof Error ? error.message : "服务暂时不可用";
  if (message.startsWith("USER:")) {
    return fail(res, 400, message.slice(5));
  }
  return fail(res, 500, "服务暂时不可用，请稍后重试");
}
