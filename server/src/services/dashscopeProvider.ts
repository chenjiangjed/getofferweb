import { config, hasDashScopeConfig } from "../config.js";

export type BailianCompletionResult = {
  text: string;
  sessionId: string | null;
};

function getOutputText(payload: unknown): string {
  if (!payload || typeof payload !== "object") return "";
  const output = (payload as { output?: unknown }).output;
  if (!output || typeof output !== "object") return "";
  const out = output as { text?: unknown; choices?: Array<{ message?: { content?: string } }> };
  return typeof out.text === "string"
    ? out.text
    : out.choices?.[0]?.message?.content || "";
}

function getSessionId(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const output = (payload as { output?: { session_id?: unknown } }).output;
  return typeof output?.session_id === "string" ? output.session_id : null;
}

function hasThoughts(payload: unknown): boolean {
  if (!payload || typeof payload !== "object") return false;
  const output = (payload as { output?: { thoughts?: unknown } }).output;
  return Array.isArray(output?.thoughts) && output.thoughts.length > 0;
}

function endpoint() {
  return `https://dashscope.aliyuncs.com/api/v1/apps/${config.bailianAppId}/completion`;
}

export async function callBailianCompletion(
  prompt: string,
  sessionId?: string | null
): Promise<BailianCompletionResult> {
  if (!hasDashScopeConfig()) {
    return {
      text: `[mock Agent] 已收到：${prompt}`,
      sessionId: sessionId || `mock_session_${Date.now()}`
    };
  }

  const response = await fetch(endpoint(), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.dashscopeApiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      input: { prompt, ...(sessionId ? { session_id: sessionId } : {}) },
      parameters: {},
      debug: {}
    }),
    signal: AbortSignal.timeout(config.bailianCompletionTimeoutMs)
  });

  if (!response.ok) throw new Error("DashScope completion failed");
  const json = (await response.json()) as unknown;
  return { text: getOutputText(json), sessionId: getSessionId(json) || sessionId || null };
}

export async function callBailianStream(
  prompt: string,
  sessionId: string | null | undefined,
  onDelta: (text: string) => void,
  onDoneSession: (sessionId: string | null) => void,
  onThoughts?: () => void
) {
  if (!hasDashScopeConfig()) {
    onThoughts?.();
    const chunks = [`[mock Agent] `, `已收到：`, prompt];
    for (const chunk of chunks) onDelta(chunk);
    onDoneSession(sessionId || `mock_session_${Date.now()}`);
    return;
  }

  const response = await fetch(endpoint(), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.dashscopeApiKey}`,
      "Content-Type": "application/json",
      "X-DashScope-SSE": "enable"
    },
    body: JSON.stringify({
      input: { prompt, ...(sessionId ? { session_id: sessionId } : {}) },
      parameters: { incremental_output: true, has_thoughts: true },
      debug: {}
    }),
    signal: AbortSignal.timeout(config.bailianStreamTimeoutMs)
  });

  if (!response.ok || !response.body) throw new Error("DashScope stream failed");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let latestSessionId: string | null = sessionId || null;

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split(/\n\n/);
    buffer = events.pop() || "";
    for (const event of events) {
      const dataLine = event
        .split(/\n/)
        .find((line) => line.startsWith("data:"));
      if (!dataLine) continue;
      const raw = dataLine.slice(5).trim();
      if (!raw || raw === "[DONE]") continue;
      try {
        const payload = JSON.parse(raw) as unknown;
        if (hasThoughts(payload)) onThoughts?.();
        const text = getOutputText(payload);
        latestSessionId = getSessionId(payload) || latestSessionId;
        if (text) onDelta(text);
      } catch {
        // Ignore malformed provider chunks; the route writes the final friendly error.
      }
    }
  }

  onDoneSession(latestSessionId);
}
