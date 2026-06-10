import cors from "cors";
import express from "express";
import { config } from "./config.js";
import "./db.js";
import { requireAuth } from "./middleware/auth.js";
import { errorHandler } from "./middleware/error.js";
import { agentRouter } from "./routes/agent.js";
import { asrRouter } from "./routes/asr.js";
import { authRouter } from "./routes/auth.js";
import { conversationsRouter } from "./routes/conversations.js";
import { filesRouter } from "./routes/files.js";
import { interviewRouter } from "./routes/interview.js";
import { ossRouter } from "./routes/oss.js";
import { resumeRouter } from "./routes/resume.js";

export const app = express();
const version = "0.1.0";

app.use(
  cors({
    origin: config.frontendOrigin.split(",").map((origin) => origin.trim()),
    credentials: true
  })
);
app.use(express.json({ limit: "1mb" }));

function healthPayload() {
  return {
    ok: true,
    version,
    time: new Date().toISOString()
  };
}

app.get("/health", (_req, res) => {
  res.json(healthPayload());
});

app.get("/api/health", (_req, res) => {
  res.json(healthPayload());
});

app.use("/api/auth", authRouter);
app.use("/api/agent", requireAuth, agentRouter);
app.use("/api/oss", requireAuth, ossRouter);
app.use("/api/files", requireAuth, filesRouter);
app.use("/api/asr", requireAuth, asrRouter);
app.use("/api/resume", requireAuth, resumeRouter);
app.use("/api/interview", requireAuth, interviewRouter);
app.use("/api/conversations", requireAuth, conversationsRouter);

app.use(errorHandler);
