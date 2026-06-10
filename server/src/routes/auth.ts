import { Router } from "express";
import jwt from "jsonwebtoken";
import { config } from "../config.js";
import { requireAuth } from "../middleware/auth.js";
import { verifyCaptcha } from "../services/captchaProvider.js";
import {
  createUser,
  findUserByUsername,
  isLocked,
  isUsernameTaken,
  recordLoginFailure,
  requiresCaptcha,
  resetLoginFailures,
  verifyPassword
} from "../services/users.js";
import type { AuthedRequest, User } from "../types.js";
import {
  fail,
  failWithData,
  isValidPassword,
  isValidUsername,
  ok
} from "../utils/http.js";

export const authRouter = Router();

function publicUser(user: User) {
  return {
    id: user.id,
    username: user.username,
    nickname: user.nickname || user.username,
    profile_user_id: user.profile_user_id
  };
}

function signToken(user: User) {
  return jwt.sign({ sub: user.id, username: user.username }, config.jwtSecret, {
    expiresIn: "7d"
  });
}

authRouter.post("/register", async (req, res, next) => {
  try {
    const username = String(req.body?.username || "").trim();
    const nickname = String(req.body?.nickname || "").trim();
    const password = String(req.body?.password || "");
    const captchaVerifyParam = String(req.body?.captchaVerifyParam || "");

    if (!isValidUsername(username)) {
      return fail(res, 400, "登录账号需为 3-20 位英文、数字或下划线");
    }
    if (nickname.length > 24) {
      return fail(res, 400, "昵称最多 24 个字符");
    }
    if (!isValidPassword(password)) {
      return fail(res, 400, "密码至少 8 位，且必须包含字母和数字");
    }
    if (!captchaVerifyParam) return fail(res, 400, "请先完成人机验证");

    const captchaPassed = await verifyCaptcha(captchaVerifyParam);
    if (!captchaPassed) return fail(res, 400, "人机验证失败，请重试");
    if (isUsernameTaken(username)) return fail(res, 409, "登录账号已存在");

    const user = await createUser(username, password, nickname);
    return res.json({ token: signToken(user), user: publicUser(user) });
  } catch (error) {
    return next(error);
  }
});

authRouter.post("/login", async (req, res, next) => {
  try {
    const username = String(req.body?.username || "").trim();
    const password = String(req.body?.password || "");
    const captchaVerifyParam = String(req.body?.captchaVerifyParam || "");
    if (!isValidUsername(username) || !password) {
      return fail(res, 400, "登录账号或密码不正确");
    }

    const user = findUserByUsername(username);
    if (user && isLocked(user)) {
      return fail(res, 423, "登录失败次数过多，请稍后再试");
    }

    if (requiresCaptcha(user)) {
      if (!captchaVerifyParam) {
        return failWithData(res, 400, "登录失败次数过多，请完成人机验证", {
          captcha_required: true
        });
      }
      const captchaPassed = await verifyCaptcha(captchaVerifyParam);
      if (!captchaPassed) {
        return failWithData(res, 400, "人机验证失败，请重试", {
          captcha_required: true
        });
      }
    }

    if (!user || !(await verifyPassword(user, password))) {
      recordLoginFailure(user);
      return fail(res, 400, "登录账号或密码不正确");
    }

    resetLoginFailures(user.id);
    return res.json({ token: signToken(user), user: publicUser(user) });
  } catch (error) {
    return next(error);
  }
});

authRouter.get("/me", requireAuth, (req, res) => {
  const user = (req as AuthedRequest).user;
  return ok(res, { user });
});
