export type AgentAction = {
  action: "open_resume_template_modal" | "open_mock_interview_modal";
  payload: Record<string, unknown>;
};

const allowedActions = new Set([
  "open_resume_template_modal",
  "open_mock_interview_modal"
]);

type ParsedAgentAction = {
  textWithoutAction: string;
  actions: AgentAction[];
};

function tryParseJson(value: string) {
  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function parseAgentActions(text: string): ParsedAgentAction {
  const actions: AgentAction[] = [];
  let textWithoutAction = text;
  const blocks = [...text.matchAll(/```(?:json)?\s*([\s\S]*?)```/gi)];

  for (const block of blocks) {
    const parsed = tryParseJson(block[1].trim());
    if (
      parsed?.type === "agent_action" &&
      typeof parsed.action === "string" &&
      allowedActions.has(parsed.action)
    ) {
      actions.push({
        action: parsed.action as AgentAction["action"],
        payload:
          parsed.payload && typeof parsed.payload === "object"
            ? (parsed.payload as Record<string, unknown>)
            : {}
      });
      textWithoutAction = textWithoutAction.replace(block[0], "").trim();
    }
  }

  return { textWithoutAction, actions };
}

export function parseJsonBlock<T>(text: string, expectedType?: string): T | null {
  const blocks = [...text.matchAll(/```(?:json)?\s*([\s\S]*?)```/gi)];
  for (const block of blocks) {
    const parsed = tryParseJson(block[1].trim());
    if (!parsed) continue;
    if (!expectedType || parsed.type === expectedType) return parsed as T;
  }

  const inline = tryParseJson(text.trim());
  if (inline && (!expectedType || inline.type === expectedType)) return inline as T;
  return null;
}
