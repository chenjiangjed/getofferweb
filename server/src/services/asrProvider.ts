import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { Express } from "express";
import ffmpegPath from "ffmpeg-static";
import FileTransClient from "aliyun-nls-filetrans";
import { config, hasAsrConfig, hasOssConfig } from "../config.js";
import {
  buildInterviewAudioKey,
  deletePrivateObject,
  signPrivateObjectReadUrl,
  uploadPrivateObject
} from "./ossProvider.js";

const asrUserError = "USER:语音转写失败，请重新录制";
const allowedMimeTypes = new Map([
  ["audio/wav", "wav"],
  ["audio/x-wav", "wav"],
  ["audio/mpeg", "mp3"],
  ["audio/mp3", "mp3"],
  ["audio/webm", "webm"],
  ["audio/ogg", "ogg"],
  ["audio/mp4", "mp4"],
  ["audio/m4a", "m4a"],
  ["video/webm", "webm"],
  ["video/mp4", "mp4"]
]);

type SubmitTaskResponse = {
  TaskId?: string;
  TaskID?: string;
  StatusText?: string;
  Code?: string;
  Message?: string;
  RequestId?: string;
};

type TaskResultResponse = {
  StatusText?: string;
  Result?: string;
  BizDuration?: number;
  Code?: string;
  Message?: string;
  RequestId?: string;
};

type AsrErrorSnapshot = {
  stage: string;
  code?: string;
  message?: string;
  detail?: string;
  time: string;
};

let lastAsrError: AsrErrorSnapshot | null = null;

function setLastAsrError(snapshot: Omit<AsrErrorSnapshot, "time">) {
  lastAsrError = { ...snapshot, time: new Date().toISOString() };
  if (config.aliyunAsr.debugLog) {
    console.warn("[asr]", JSON.stringify(lastAsrError));
  }
}

function clearLastAsrError() {
  lastAsrError = null;
}

export function getAsrDiagnostics() {
  return {
    hasOssConfig: hasOssConfig(),
    hasAsrConfig: hasAsrConfig(),
    ossRegion: config.oss.region || "",
    asrRegion: config.aliyunAsr.region || "",
    ffmpegAvailable: Boolean(ffmpegPath),
    provider: "aliyun-nls-filetrans",
    keepDebugAudio: config.aliyunAsr.keepDebugAudio,
    debugLog: config.aliyunAsr.debugLog,
    lastAsrError
  };
}

export function validateAudioFile(file?: Express.Multer.File) {
  if (!file) throw new Error("USER:请上传音频文件");
  if (!allowedMimeTypes.has(file.mimetype)) {
    setLastAsrError({
      stage: "validateAudioFile",
      detail: `unsupported mimetype: ${file.mimetype || "unknown"}`
    });
    throw new Error(asrUserError);
  }
  if (file.size < 2048) {
    setLastAsrError({ stage: "validateAudioFile", detail: `audio too small: ${file.size}` });
    throw new Error(asrUserError);
  }
}

function validateWavHeader(buffer: Buffer) {
  const riff = buffer.toString("ascii", 0, 4);
  const wave = buffer.toString("ascii", 8, 12);
  const channels = buffer.readUInt16LE(22);
  const sampleRate = buffer.readUInt32LE(24);
  const bitsPerSample = buffer.readUInt16LE(34);

  if (
    riff !== "RIFF" ||
    wave !== "WAVE" ||
    channels !== 1 ||
    sampleRate !== 16000 ||
    bitsPerSample !== 16
  ) {
    setLastAsrError({
      stage: "validateWavHeader",
      detail: JSON.stringify({ riff, wave, channels, sampleRate, bitsPerSample })
    });
    throw new Error(asrUserError);
  }
}

function fileExtension(file: Express.Multer.File) {
  const byMime = allowedMimeTypes.get(file.mimetype);
  if (byMime) return byMime;
  return path.extname(file.originalname).replace(".", "") || "webm";
}

function asrEndpoint() {
  return `https://filetrans.${config.aliyunAsr.region}.aliyuncs.com`;
}

function fileTransClient() {
  return new FileTransClient({
    accessKeyId: config.aliyunAsr.accessKeyId,
    accessKeySecret: config.aliyunAsr.accessKeySecret,
    endpoint: asrEndpoint(),
    apiVersion: "2018-08-17"
  });
}

async function convertToWav16kMono(file: Express.Multer.File) {
  if (!ffmpegPath) {
    setLastAsrError({ stage: "ffmpeg", message: "ffmpeg-static binary unavailable" });
    throw new Error(asrUserError);
  }

  const ffmpegBinary = ffmpegPath;
  const workDir = path.join(os.tmpdir(), `chu-asr-${randomUUID()}`);
  const inputPath = path.join(workDir, `input.${fileExtension(file)}`);
  const outputPath = path.join(workDir, "output.wav");
  await mkdir(workDir, { recursive: true });

  try {
    await writeFile(inputPath, file.buffer);
    await new Promise<void>((resolve, reject) => {
      const child = spawn(ffmpegBinary, [
        "-y",
        "-hide_banner",
        "-loglevel",
        "error",
        "-i",
        inputPath,
        "-ac",
        "1",
        "-ar",
        "16000",
        "-sample_fmt",
        "s16",
        outputPath
      ]);
      let stderr = "";
      child.stderr.on("data", (chunk: Buffer) => {
        stderr += chunk.toString("utf8");
      });
      child.on("error", reject);
      child.on("close", (code: number | null) => {
        if (code === 0) {
          resolve();
          return;
        }
        reject(new Error(stderr.trim() || `ffmpeg exited with code ${code}`));
      });
    });
    const buffer = await readFile(outputPath);
    validateWavHeader(buffer);
    return buffer;
  } catch (error) {
    setLastAsrError({
      stage: "ffmpeg",
      message: error instanceof Error ? error.message : "audio conversion failed"
    });
    throw new Error(asrUserError);
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}

async function assertSignedUrlReadable(fileUrl: string) {
  const response = await fetch(fileUrl, {
    method: "GET",
    headers: { Range: "bytes=0-63" },
    signal: AbortSignal.timeout(15_000)
  });
  if (!response.ok) {
    setLastAsrError({
      stage: "ossSignedUrlCheck",
      code: String(response.status),
      message: response.statusText
    });
    throw new Error(asrUserError);
  }
  const sample = Buffer.from(await response.arrayBuffer());
  if (sample.length < 12 || sample.toString("ascii", 0, 4) !== "RIFF") {
    setLastAsrError({
      stage: "ossSignedUrlCheck",
      detail: `unexpected readable sample length=${sample.length}`
    });
    throw new Error(asrUserError);
  }
}

async function submitFileTranscription(fileUrl: string) {
  const task = {
    appkey: config.aliyunAsr.appKey,
    file_link: fileUrl,
    version: "4.0",
    enable_words: false,
    enable_sample_rate_adaptive: true,
    enable_punctuation_prediction: true
  };

  const payload = (await fileTransClient().submitTask({
    Task: JSON.stringify(task)
  })) as SubmitTaskResponse;

  const taskId = payload.TaskId || payload.TaskID;
  if (!taskId) {
    setLastAsrError({
      stage: "SubmitTask",
      code: payload.Code,
      message: payload.Message || payload.StatusText || "missing task id"
    });
    throw new Error(asrUserError);
  }
  if (config.aliyunAsr.debugLog) {
    console.info("[asr]", JSON.stringify({ stage: "SubmitTask", taskId, requestId: payload.RequestId }));
  }
  return taskId;
}

function extractText(result: string | undefined) {
  if (!result) return "";
  try {
    // 阿里云 API 的 Result 可能是 JSON 字符串，也可能是已解析的对象
    const parsed =
      typeof result === "string"
        ? (JSON.parse(result) as {
            Sentences?: Array<{ Text?: string }>;
            Text?: string;
          })
        : result;
    if (typeof parsed.Text === "string") return parsed.Text;
    if (Array.isArray(parsed.Sentences)) {
      return parsed.Sentences.map((sentence) => sentence.Text || "").join("");
    }
  } catch {
    if (typeof result === "string") return result;
  }
  return "";
}

async function pollFileTranscription(taskId: string) {
  const maxAttempts = 30;
  const delayMs = 2_000;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const payload = (await fileTransClient().getTaskResult({
      TaskId: taskId
    })) as TaskResultResponse;

    if (config.aliyunAsr.debugLog) {
      console.info(
        "[asr]",
        JSON.stringify({
          stage: "GetTaskResult",
          attempt,
          statusText: payload.StatusText,
          code: payload.Code,
          requestId: payload.RequestId
        })
      );
    }

    if (payload.StatusText === "SUCCESS") {
      return {
        text: extractText(payload.Result),
        duration: Math.round((payload.BizDuration || 0) / 1000)
      };
    }
    if (payload.StatusText === "FAILED" || payload.Code === "FAILED") {
      setLastAsrError({
        stage: "GetTaskResult",
        code: payload.Code,
        message: payload.Message || payload.StatusText || "failed"
      });
      throw new Error(asrUserError);
    }
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }

  setLastAsrError({ stage: "GetTaskResult", message: "timeout" });
  throw new Error(asrUserError);
}

export async function transcribeAudio(
  file: Express.Multer.File | undefined,
  profileUserId: string
) {
  validateAudioFile(file);
  if (!file || !hasAsrConfig()) {
    setLastAsrError({ stage: "config", message: "missing ASR or OSS config" });
    throw new Error(asrUserError);
  }

  const key = buildInterviewAudioKey(profileUserId, "wav");
  try {
    clearLastAsrError();
    const wavBuffer = await convertToWav16kMono(file);
    await uploadPrivateObject(key, wavBuffer, "audio/wav");
    const signedUrl = await signPrivateObjectReadUrl(key, 3600);
    await assertSignedUrlReadable(signedUrl);
    const taskId = await submitFileTranscription(signedUrl);
    const result = await pollFileTranscription(taskId);
    if (typeof result.text !== "string" || !result.text.trim()) {
      setLastAsrError({ stage: "emptyResult", message: "ASR returned empty text" });
      throw new Error(asrUserError);
    }
    return {
      text: result.text,
      duration: result.duration,
      provider: "aliyun-nls-filetrans"
    };
  } catch (error) {
    if (!lastAsrError) {
      setLastAsrError({
        stage: "unknown",
        message: error instanceof Error ? error.message : "unknown ASR failure"
      });
    }
    throw new Error(asrUserError);
  } finally {
    if (!config.aliyunAsr.keepDebugAudio) {
      await deletePrivateObject(key);
    }
  }
}
