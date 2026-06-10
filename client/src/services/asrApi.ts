import { delay, request, USE_MOCK } from "./http";
import type { AsrResult } from "../types/api";

type ServerAsrResult = {
  text: string;
  duration: number;
  provider: string;
};

export const asrApi = {
  async transcribe(audio: Blob, durationSeconds: number): Promise<AsrResult> {
    if (USE_MOCK) {
      await delay(900);
      return {
        answer_text:
          "嗯，然后我当时负责这个项目的需求分析，先访谈了一些同学，再整理问题并输出原型。最后我们完成了核心流程，但结果指标还没有充分量化。",
        duration_seconds: durationSeconds
      };
    }
    const form = new FormData();
    const extension = audio.type.includes("mp4")
      ? "mp4"
      : audio.type.includes("ogg")
        ? "ogg"
        : audio.type.includes("wav")
          ? "wav"
          : "webm";
    form.append("audio", audio, `interview-answer.${extension}`);
    form.append("duration_seconds", String(durationSeconds));
    const result = await request<ServerAsrResult>("/api/asr/transcribe", {
      method: "POST",
      body: form
    });
    return {
      answer_text: result.text,
      duration_seconds: result.duration || durationSeconds,
      provider: result.provider
    };
  }
};
