import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useLocation, useParams } from "react-router-dom";
import {
  AgentProcessPanel,
  AgentStage,
  AgentStageKey,
  defaultAgentStages
} from "../components/AgentProcessPanel";
import { AgentMessage } from "../components/AgentMessage";
import { ChatInput } from "../components/ChatInput";
import { MockInterviewModal } from "../components/MockInterviewModal";
import { ResumeTemplateModal } from "../components/ResumeTemplateModal";
import { agentApi } from "../services/agentApi";
import { conversationApi } from "../services/conversationApi";
import { useAuthStore } from "../stores/authStore";
import type { AgentActionEvent } from "../types/api";

type Message =
  | {
      type: "message";
      role: "user" | "assistant";
      text: string;
      actions?: AgentActionEvent[];
    }
  | {
      type: "process";
      id: string;
      stages: AgentStage[];
    };

type ActiveAction =
  | {
      action: "open_resume_template_modal";
      payload: Record<string, unknown>;
    }
  | {
      action: "open_mock_interview_modal";
      payload: Record<string, unknown>;
    }
  | null;

const welcomeMessage =
  "你好，我是长大职通车。你可以直接描述求职问题，我会帮你拆解求职方向、简历表达和面试准备。";

const resumeCtaText = "如果需要我为你提供简历模板并生成简历初稿，请点击这里";
const interviewCtaText = "点击此处开启模拟面试";

function stripInlineActionText(text: string) {
  return text
    .replace(resumeCtaText, "")
    .replace(interviewCtaText, "")
    .replace(/\n{3,}/g, "\n\n")
    .trimEnd();
}

function freshStages(): AgentStage[] {
  return defaultAgentStages.map((stage) => ({ ...stage }));
}

function nextStageState(stages: AgentStage[], activeKey: AgentStageKey): AgentStage[] {
  const activeIndex = stages.findIndex((stage) => stage.key === activeKey);
  return stages.map((stage, index) => {
    if (index < activeIndex) return { ...stage, status: "done" };
    if (index === activeIndex) return { ...stage, status: "active" };
    return { ...stage, status: "pending" };
  });
}

function completeStages(stages: AgentStage[]): AgentStage[] {
  return stages.map((stage) => ({ ...stage, status: "done" }));
}

export function ChatPage() {
  const { id = "conv_default" } = useParams();
  const location = useLocation();
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const initialSentRef = useRef(false);
  const fileStageTimerRef = useRef<number[]>([]);
  const typewriterQueueRef = useRef("");
  const typewriterTimerRef = useRef<number | null>(null);
  const typewriterResolversRef = useRef<Array<() => void>>([]);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const streamingRef = useRef(false);
  const [messages, setMessages] = useState<Message[]>([
    { type: "message", role: "assistant", text: welcomeMessage }
  ]);
  const [sending, setSending] = useState(false);
  const [activeAction, setActiveAction] = useState<ActiveAction>(null);

  const state = location.state as { initialMessage?: string; initialFile?: File | null } | null;
  const hasInitialPayload = Boolean(state?.initialMessage || state?.initialFile);

  const historyQuery = useQuery({
    queryKey: ["conversation-messages", id],
    queryFn: () => conversationApi.messages(id),
    enabled: !hasInitialPayload
  });

  function updateProcess(processId: string, updater: (stages: AgentStage[]) => AgentStage[]) {
    setMessages((items) =>
      items.map((item) =>
        item.type === "process" && item.id === processId
          ? { ...item, stages: updater(item.stages) }
          : item
      )
    );
  }

  function appendAssistantDeltaNow(text: string) {
    if (!text) return;
    setMessages((items) => {
      const next = [...items];
      const last = next[next.length - 1];
      if (last?.type === "message" && last.role === "assistant") {
        next[next.length - 1] = { ...last, text: last.text + text };
      } else {
        next.push({ type: "message", role: "assistant", text });
      }
      return next;
    });
  }

  function resolveTypewriterWaiters() {
    const waiters = typewriterResolversRef.current.splice(0);
    waiters.forEach((resolve) => resolve());
  }

  function stopTypewriter() {
    if (typewriterTimerRef.current) {
      window.clearInterval(typewriterTimerRef.current);
      typewriterTimerRef.current = null;
    }
  }

  function startTypewriter() {
    if (typewriterTimerRef.current) return;
    typewriterTimerRef.current = window.setInterval(() => {
      const queue = typewriterQueueRef.current;
      if (!queue) {
        stopTypewriter();
        resolveTypewriterWaiters();
        return;
      }
      const chunkSize = queue.length > 80 ? 3 : 2;
      const chunk = queue.slice(0, chunkSize);
      typewriterQueueRef.current = queue.slice(chunkSize);
      appendAssistantDeltaNow(chunk);
    }, 22);
  }

  function enqueueAssistantDelta(text: string) {
    if (!text) return;
    typewriterQueueRef.current += text;
    startTypewriter();
  }

  function waitForTypewriterIdle() {
    if (!typewriterQueueRef.current && !typewriterTimerRef.current) return Promise.resolve();
    return new Promise<void>((resolve) => {
      typewriterResolversRef.current.push(resolve);
    });
  }

  function addEmptyAssistantMessage() {
    setMessages((items) => [...items, { type: "message", role: "assistant", text: "" }]);
  }

  function appendAssistantMessage(text: string) {
    setMessages((items) => [...items, { type: "message", role: "assistant", text }]);
  }

  function attachActionLink(action: AgentActionEvent) {
    setMessages((items) => {
      const next = [...items];
      for (let index = next.length - 1; index >= 0; index -= 1) {
        const item = next[index];
        if (item.type === "message" && item.role === "assistant") {
          next[index] = {
            ...item,
            actions: [...(item.actions || []), action]
          };
          return next;
        }
      }
      return [
        ...next,
        {
          type: "message",
          role: "assistant",
          text: "",
          actions: [action]
        }
      ];
    });
  }

  function actionLabel(action: AgentActionEvent) {
    const label = action.payload.cta_label;
    if (typeof label === "string" && label.trim()) return label;
    if (action.action === "open_resume_template_modal") {
      return "如果需要我为你提供简历模板并生成简历初稿，请点击这里";
    }
    return "点击此处开启模拟面试";
  }

  function inferActionFromText(text: string): AgentActionEvent | null {
    const compact = text.replace(/\s+/g, "");
    const hasClickText = /(点击这里|请点击这里|点击此处|开启|开始)/.test(compact);
    const isResumeCta =
      hasClickText &&
      /(简历|DOCX|模板|初稿)/.test(compact) &&
      /(提供简历模板|生成简历初稿|选择.*模板|挑选.*模板|下载.*DOCX)/.test(compact);
    if (isResumeCta) {
      return {
        action: "open_resume_template_modal",
        payload: {
          resume_session_id: "resume_session_auto",
          cta_label: "如果需要我为你提供简历模板并生成简历初稿，请点击这里",
          auto_open: false
        }
      };
    }

    const isInterviewCta =
      hasClickText && /(模拟面试|面试练习|语音面试)/.test(compact);
    if (isInterviewCta) {
      return {
        action: "open_mock_interview_modal",
        payload: {
          interview_session_id: "interview_session_auto",
          cta_label: "点击此处开启模拟面试",
          auto_open: false
        }
      };
    }

    return null;
  }

  function visibleActions(message: Extract<Message, { type: "message" }>) {
    if (message.role !== "assistant") return [];
    if (message.actions?.length) return message.actions;
    const inferred = inferActionFromText(message.text);
    return inferred ? [inferred] : [];
  }

  function handleAction(action: AgentActionEvent) {
    if (
      action.action === "open_resume_template_modal" ||
      action.action === "open_mock_interview_modal"
    ) {
      void waitForTypewriterIdle().then(() => attachActionLink(action));
    }
  }

  function clearFileStageTimers() {
    for (const timer of fileStageTimerRef.current) window.clearTimeout(timer);
    fileStageTimerRef.current = [];
  }

  function playFileStages(processId: string) {
    clearFileStageTimers();
    const sequence: AgentStageKey[] = ["understood", "tooling", "observed", "answering"];
    sequence.forEach((stage, index) => {
      const timer = window.setTimeout(() => {
        updateProcess(processId, (stages) => nextStageState(stages, stage));
      }, index * 350);
      fileStageTimerRef.current.push(timer);
    });
  }

  async function send(text: string, file?: File | null) {
    if (sending) return;
    const displayText = file ? `${text}\n\n已上传文件：${file.name}` : text;
    const processId = `process_${Date.now()}`;
    const payload = {
      conversationId: id,
      userId: user?.profile_user_id || "demo_user",
      message: text
    };

    setSending(true);
    streamingRef.current = true;
    setMessages((items) => [
      ...items,
      { type: "message", role: "user", text: displayText },
      { type: "process", id: processId, stages: freshStages() }
    ]);

    try {
      if (file) {
        playFileStages(processId);
        const result = await agentApi.chatWithFile(payload, file);
        clearFileStageTimers();
        updateProcess(processId, completeStages);
        addEmptyAssistantMessage();
        for (let index = 0; index < result.text.length; index += 3) {
          appendAssistantDeltaNow(result.text.slice(index, index + 3));
          await new Promise((resolve) => window.setTimeout(resolve, 18));
        }
        if (result.actions?.length) {
          for (const action of result.actions) {
            attachActionLink(action);
          }
        }
      } else {
        await agentApi.chatStream(payload, {
          onStage: (stage) => {
            updateProcess(processId, (stages) => nextStageState(stages, stage.stage));
          },
          onDelta: (delta) => {
            enqueueAssistantDelta(delta);
          },
          onAction: handleAction,
          onDone: () => {
            updateProcess(processId, completeStages);
          },
          onError: (error) => {
            throw error;
          }
        });
        await waitForTypewriterIdle();
      }
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      queryClient.invalidateQueries({ queryKey: ["conversation-messages", id] });
    } catch {
      updateProcess(processId, completeStages);
      setMessages((items) => [
        ...items,
        { type: "message", role: "assistant", text: "正在处理，请稍后重试。" }
      ]);
    } finally {
      clearFileStageTimers();
      streamingRef.current = false;
      setSending(false);
    }
  }

  useEffect(() => {
    if (!historyQuery.data || hasInitialPayload || streamingRef.current) return;
    if (historyQuery.data.length === 0) {
      setMessages([{ type: "message", role: "assistant", text: welcomeMessage }]);
      return;
    }
    setMessages(
      historyQuery.data.map((item) => ({
        type: "message" as const,
        role: item.role,
        text: item.content
      }))
    );
  }, [historyQuery.data, hasInitialPayload]);

  useEffect(() => {
    if (initialSentRef.current) return;
    const initial = state?.initialMessage;
    if (initial || state?.initialFile) {
      initialSentRef.current = true;
      void send(initial || "请分析我上传的文件", state?.initialFile || null);
      window.history.replaceState({}, document.title);
    }
  }, []);

  useEffect(() => {
    window.requestAnimationFrame(() => {
      messagesEndRef.current?.scrollIntoView({ block: "end" });
    });
  }, [messages, id, historyQuery.isSuccess]);

  useEffect(() => {
    return () => {
      clearFileStageTimers();
      stopTypewriter();
    };
  }, []);

  return (
    <div className="mx-auto flex h-[calc(100vh-56px)] max-w-5xl flex-col px-4 pb-5 sm:px-8">
      <div className="scrollbar-thin flex-1 space-y-4 overflow-y-auto py-6">
        {messages.map((message, index) =>
          message.type === "process" ? (
            <AgentProcessPanel key={message.id} stages={message.stages} />
          ) : (
            <div key={`${message.role}-${index}`} className="space-y-2">
              <AgentMessage role={message.role}>
                {message.role === "assistant"
                  ? stripInlineActionText(message.text)
                  : message.text}
              </AgentMessage>
              {message.role === "assistant" && visibleActions(message).length ? (
                <div className="ml-2 flex flex-col items-start gap-2">
                  {visibleActions(message).map((action, actionIndex) => (
                    <button
                      key={`${action.action}-${actionIndex}`}
                      type="button"
                      onClick={async () => {
                        if (
                          action.action === "open_resume_template_modal" &&
                          action.payload.resume_session_id === "resume_session_auto"
                        ) {
                          try {
                            const session = await agentApi.createResumeSession(id);
                            setActiveAction({
                              ...action,
                              payload: {
                                ...action.payload,
                                resume_session_id: session.resumeSessionId
                              }
                            });
                          } catch {
                            appendAssistantMessage("正在处理，请稍后重试。");
                          }
                        } else {
                          setActiveAction(action);
                        }
                      }}
                      className="text-left text-sm font-medium text-blue-600 underline underline-offset-4 hover:text-blue-700"
                    >
                      {actionLabel(action)}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          )
        )}
        <div ref={messagesEndRef} />
      </div>
      <ChatInput minRows={3} onSubmit={send} disabled={sending} />
      {activeAction?.action === "open_resume_template_modal" && (
        <ResumeTemplateModal
          conversationId={id}
          resumeSessionId={String(activeAction.payload.resume_session_id || "")}
          onClose={() => setActiveAction(null)}
          onGenerated={appendAssistantMessage}
        />
      )}
      {activeAction?.action === "open_mock_interview_modal" && (
        <MockInterviewModal
          conversationId={id}
          payload={activeAction.payload}
          onClose={() => setActiveAction(null)}
          onFinished={appendAssistantMessage}
        />
      )}
    </div>
  );
}
