import { Router } from "express";
import { buildPhotoKey, signPhotoPutUrl } from "../services/ossProvider.js";
import type { AuthedRequest } from "../types.js";
import { fail, ok } from "../utils/http.js";

export const ossRouter = Router();

const allowedTypes = new Set(["image/jpeg", "image/jpg", "image/png"]);

ossRouter.post("/photo-upload-token", async (req, res, next) => {
  try {
    const { user } = req as AuthedRequest;
    const contentType = String(req.body?.contentType || "");
    const profileUserId = String(req.body?.profileUserId || "");
    if (!allowedTypes.has(contentType)) return fail(res, 400, "只支持 jpg/png 图片");
    if (profileUserId !== user.profile_user_id) {
      return fail(res, 403, "无权为该用户上传文件");
    }

    const key = buildPhotoKey(user.profile_user_id);
    const uploadUrl = await signPhotoPutUrl(key, "image/jpeg");
    return ok(res, {
      uploadUrl,
      method: "PUT",
      photo_oss_key: key,
      headers: { "Content-Type": "image/jpeg" }
    });
  } catch (error) {
    return next(error);
  }
});
