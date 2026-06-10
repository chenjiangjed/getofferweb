import type { AgentIntentMessage } from "../types/api";

export function toAgentMessage(message: AgentIntentMessage): string {
  return JSON.stringify(message);
}

export function parseJsonBlock<T>(text: string): T | null {
  const block = text.match(/```json\s*([\s\S]*?)```/i);
  const raw = block?.[1] || (text.trim().startsWith("{") ? text.trim() : "");
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function makeConversationId(prefix = "conv") {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
