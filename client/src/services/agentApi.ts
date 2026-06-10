import { delay, request, USE_MOCK } from "./http";
import { useAuthStore } from "../stores/authStore";
import type { AgentActionEvent, AgentChatRequest, AgentChatResponse } from "../types/api";
import type { AgentStageKey } from "../components/AgentProcessPanel";

type ChatStreamHandlers = {
  onStage?: (stage: { stage: AgentStageKey; label: string }) => void;
  onDelta?: (text: string) => void;
  onAction?: (action: AgentActionEvent) => void;
  onDone?: (data: { conversationId: string; sessionId: string | null }) => void;
  onError?: (error: Error) => void;
};

function mockAgentText(message: string) {
  if (message.includes("generate_resume_docx")) {
    return [
      "已根据你的素材生成 DOCX 简历。",
      "```json",
      JSON.stringify(
        {
          type: "resume_generated",
          resume_id: "resume_mock_001",
          template_id: "temp_1",
          docx_oss_key: "generated_resumes/用户-0000/resume_mock_001.docx"
        },
        null,
        2
      ),
      "```"
    ].join("\n");
  }
  if (message.includes("submit_interview_answer")) {
    return "这次回答能覆盖项目背景和个人行动，但结果量化不足。建议补充指标，例如调研人数、需求采纳数量或上线后的效率变化。追问：如果让你重新推进这个项目，你会先优化哪一步？";
  }
  if (message.includes("career_plan_collect_materials")) {
    return "《一站式求职方案》已生成：建议优先准备产品助理、运营分析、数据分析三个方向。下一步可进入简历生成，把教育、项目和实习经历整理成可投递版本。";
  }
  return "我已收到你的问题。当前为前端 mock 回复，后端接入后会由百炼 Agent 返回完整结果。";
}

function apiBase() {
  return import.meta.env.VITE_API_BASE_URL || "";
}

function splitSseEvents(buffer: string) {
  const events = buffer.split(/\n\n/);
  return {
    complete: events.slice(0, -1),
    rest: events[events.length - 1] || ""
  };
}

function parseSseEvent(event: string) {
  const eventName = event
    .split(/\n/)
    .find((line) => line.startsWith("event:"))
    ?.slice(6)
    .trim();
  const data = event
    .split(/\n/)
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trim())
    .join("\n");
  return { eventName, data };
}

export const agentApi = {
  async chat(payload: AgentChatRequest): Promise<AgentChatResponse> {
    if (USE_MOCK) {
      await delay(700);
      return {
        text: mockAgentText(payload.message),
        conversationId: payload.conversationId,
        sessionId: `sess_${Date.now()}`
      };
    }
    return request<AgentChatResponse>("/api/agent/chat", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },

  async chatStream(payload: AgentChatRequest, handlers: ChatStreamHandlers): Promise<void> {
    if (USE_MOCK) {
      handlers.onStage?.({ stage: "understood", label: "已理解需求" });
      await delay(180);
      handlers.onStage?.({ stage: "tooling", label: "正在检索/调用工具" });
      await delay(220);
      handlers.onStage?.({ stage: "observed", label: "已读取工具结果" });
      await delay(180);
      handlers.onStage?.({ stage: "answering", label: "正在生成建议" });
      const text = mockAgentText(payload.message);
      for (let index = 0; index < text.length; index += 4) {
        await delay(12);
        handlers.onDelta?.(text.slice(index, index + 4));
      }
      handlers.onDone?.({ conversationId: payload.conversationId, sessionId: `sess_${Date.now()}` });
      return;
    }

    const token = useAuthStore.getState().token;
    const response = await fetch(`${apiBase()}/api/agent/chat/stream`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok || !response.body) {
      throw new Error("流式请求失败");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let streamError: Error | null = null;

    while (true) {
      if (streamError) break;
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const { complete, rest } = splitSseEvents(buffer);
      buffer = rest;

      for (const rawEvent of complete) {
        const { eventName, data } = parseSseEvent(rawEvent);
        if (!eventName || !data) continue;
        try {
          const parsed = JSON.parse(data) as Record<string, unknown>;
          if (eventName === "stage") {
            handlers.onStage?.({
              stage: parsed.stage as AgentStageKey,
              label: String(parsed.label || "")
            });
          }
          if (eventName === "delta") {
            handlers.onDelta?.(String(parsed.text || ""));
          }
          if (eventName === "action") {
            handlers.onAction?.({
              action: parsed.action as AgentActionEvent["action"],
              payload:
                parsed.payload && typeof parsed.payload === "object"
                  ? (parsed.payload as Record<string, unknown>)
                  : {}
            });
          }
          if (eventName === "done") {
            handlers.onDone?.({
              conversationId: String(parsed.conversationId || payload.conversationId),
              sessionId: typeof parsed.sessionId === "string" ? parsed.sessionId : null
            });
          }
          if (eventName === "error") {
            streamError = new Error(String(parsed.message || "正在处理，请稍后重试。"));
          }
        } catch (error) {
          streamError = error instanceof Error ? error : new Error("流式响应解析失败");
        }
      }
    }

    if (streamError) {
      handlers.onError?.(streamError);
      throw streamError;
    }
  },

  async chatWithFile(payload: AgentChatRequest, file: File): Promise<AgentChatResponse> {
    if (USE_MOCK) {
      await delay(700);
      return {
        text: `已收到文件：${file.name}。${mockAgentText(payload.message)}`,
        conversationId: payload.conversationId,
        sessionId: `sess_${Date.now()}`
      };
    }
    const form = new FormData();
    form.append("conversationId", payload.conversationId);
    form.append("userId", payload.userId);
    form.append("message", payload.message);
    form.append("file", file);
    return request<AgentChatResponse>("/api/agent/chat-with-file", {
      method: "POST",
      body: form
    });
  },

  async createResumeSession(conversationId: string): Promise<{ resumeSessionId: string }> {
    return request<{ resumeSessionId: string }>("/api/resume/session", {
      method: "POST",
      body: JSON.stringify({ conversationId })
    });
  }
};
