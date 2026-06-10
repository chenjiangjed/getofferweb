import { Router } from "express";
import { assertDownloadKeyOwned, signDownloadUrl } from "../services/ossProvider.js";
import type { AuthedRequest } from "../types.js";
import { ok } from "../utils/http.js";

export const filesRouter = Router();

filesRouter.get("/download-url", async (req, res, next) => {
  try {
    const { user } = req as AuthedRequest;
    const key = String(req.query.key || "");
    assertDownloadKeyOwned(key, user.profile_user_id);
    const signedUrl = await signDownloadUrl(key);
    return ok(res, { signed_url: signedUrl, expires_in: 600 });
  } catch (error) {
    return next(error);
  }
});
