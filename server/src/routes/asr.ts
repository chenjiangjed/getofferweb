import { Router } from "express";
import multer from "multer";
import { getAsrDiagnostics, transcribeAudio } from "../services/asrProvider.js";
import type { AuthedRequest } from "../types.js";
import { ok } from "../utils/http.js";

export const asrRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024,
    files: 1
  }
});

asrRouter.get("/diagnostics", (_req, res) => {
  return ok(res, getAsrDiagnostics());
});

asrRouter.post("/transcribe", upload.single("audio"), async (req, res, next) => {
  try {
    const { user } = req as AuthedRequest;
    const result = await transcribeAudio(req.file, user.profile_user_id);
    return ok(res, result);
  } catch (error) {
    return next(error);
  }
});
