import dotenv from "dotenv";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function loadEnvFile(fileName: string) {
  const candidates = [
    path.resolve(process.cwd(), fileName),
    path.resolve(serverRoot, fileName)
  ];
  const loaded = new Set<string>();

  for (const candidate of candidates) {
    if (loaded.has(candidate) || !fs.existsSync(candidate)) continue;
    dotenv.config({ path: candidate });
    loaded.add(candidate);
  }
}

if (process.env.NODE_ENV === "production") {
  loadEnvFile(".env.production");
}
loadEnvFile(".env");

export const config = {
  port: Number(process.env.PORT || 3001),
  nodeEnv: process.env.NODE_ENV || "development",
  frontendOrigin: process.env.FRONTEND_ORIGIN || "http://localhost:5173",
  jwtSecret: process.env.JWT_SECRET || "replace-me",
  databasePath: process.env.DATABASE_PATH || "./data/chujobfinder.sqlite",
  demoCaptchaBypass:
    process.env.NODE_ENV === "development" &&
    process.env.DEMO_CAPTCHA_BYPASS === "true",
  dashscopeApiKey: process.env.DASHSCOPE_API_KEY || "",
  bailianAppId: process.env.BAILIAN_APP_ID || "",
  bailianCompletionTimeoutMs: Number(process.env.BAILIAN_COMPLETION_TIMEOUT_MS) || 300_000,
  bailianStreamTimeoutMs: Number(process.env.BAILIAN_STREAM_TIMEOUT_MS) || 300_000,
  oss: {
    region: process.env.ALIYUN_OSS_REGION || "",
    endpoint: process.env.ALIYUN_OSS_ENDPOINT || "",
    bucket: process.env.ALIYUN_OSS_BUCKET || "",
    accessKeyId: process.env.ALIYUN_OSS_ACCESS_KEY_ID || process.env.ALIYUN_ACCESS_KEY_ID || "",
    accessKeySecret:
      process.env.ALIYUN_OSS_ACCESS_KEY_SECRET || process.env.ALIYUN_ACCESS_KEY_SECRET || ""
  },
  aliyunCaptcha: {
    region: process.env.ALIYUN_CAPTCHA_REGION || "cn-shanghai",
    sceneId: process.env.ALIYUN_CAPTCHA_SCENE_ID || "",
    accessKeyId: process.env.ALIYUN_CAPTCHA_ACCESS_KEY_ID || "",
    accessKeySecret: process.env.ALIYUN_CAPTCHA_ACCESS_KEY_SECRET || ""
  },
  aliyunAsr: {
    appKey: process.env.NLS_APP_KEY || process.env.ALIYUN_ASR_APP_KEY || "",
    region: process.env.ALIYUN_ASR_REGION || "cn-beijing",
    accessKeyId:
      process.env.ALIYUN_AK_ID ||
      process.env.ALIYUN_ASR_ACCESS_KEY_ID ||
      process.env.ALIYUN_ACCESS_KEY_ID ||
      "",
    accessKeySecret:
      process.env.ALIYUN_AK_SECRET ||
      process.env.ALIYUN_ASR_ACCESS_KEY_SECRET ||
      process.env.ALIYUN_ACCESS_KEY_SECRET ||
      "",
    keepDebugAudio: process.env.ASR_KEEP_DEBUG_AUDIO === "true",
    debugLog: process.env.ASR_DEBUG_LOG === "true"
  }
};

const requiredProductionEnv = [
  "PORT",
  "FRONTEND_ORIGIN",
  "JWT_SECRET",
  "DATABASE_PATH",
  "DASHSCOPE_API_KEY",
  "BAILIAN_APP_ID",
  "ALIYUN_OSS_REGION",
  "ALIYUN_OSS_BUCKET",
  "ALIYUN_OSS_ACCESS_KEY_ID",
  "ALIYUN_OSS_ACCESS_KEY_SECRET",
  "ALIYUN_CAPTCHA_REGION",
  "ALIYUN_CAPTCHA_SCENE_ID",
  "ALIYUN_CAPTCHA_ACCESS_KEY_ID",
  "ALIYUN_CAPTCHA_ACCESS_KEY_SECRET",
  "ALIYUN_AK_ID",
  "ALIYUN_AK_SECRET",
  "NLS_APP_KEY"
];

function assertProductionConfig() {
  if (config.nodeEnv !== "production") return;

  const missing = requiredProductionEnv.filter((key) => !process.env[key]?.trim());
  const invalid: string[] = [];

  if (config.jwtSecret === "replace-me") invalid.push("JWT_SECRET must not be replace-me");
  if (
    config.frontendOrigin
      .split(",")
      .map((origin) => origin.trim())
      .includes("http://localhost:5173")
  ) {
    invalid.push("FRONTEND_ORIGIN must not include http://localhost:5173");
  }
  if (config.databasePath === "./data/chujobfinder.sqlite") {
    invalid.push("DATABASE_PATH must not be ./data/chujobfinder.sqlite");
  }

  if (missing.length > 0 || invalid.length > 0) {
    const details = [
      missing.length ? `Missing required env: ${missing.join(", ")}` : "",
      ...invalid
    ].filter(Boolean);
    throw new Error(`Invalid production configuration. ${details.join("; ")}`);
  }
}

assertProductionConfig();

export function hasDashScopeConfig() {
  return Boolean(config.dashscopeApiKey && config.bailianAppId);
}

export function hasCaptchaConfig() {
  const captcha = config.aliyunCaptcha;
  return Boolean(
    captcha.region && captcha.sceneId && captcha.accessKeyId && captcha.accessKeySecret
  );
}

export function hasAsrConfig() {
  const asr = config.aliyunAsr;
  return Boolean(
    asr.appKey &&
      asr.region &&
      asr.accessKeyId &&
      asr.accessKeySecret &&
      hasOssConfig()
  );
}

export function hasOssConfig() {
  const oss = config.oss;
  return Boolean(
    oss.region &&
      oss.endpoint &&
      oss.bucket &&
      oss.accessKeyId &&
      oss.accessKeySecret
  );
}
