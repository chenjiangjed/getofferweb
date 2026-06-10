import { Router } from "express";
import multer from "multer";
import {
  addMessage,
  ensureConversation,
  updateConversationSession
} from "../services/conversations.js";
import {
  callBailianCompletion,
  callBailianStream
} from "../services/dashscopeProvider.js";
import { extractFileText } from "../services/fileTextExtractor.js";
import type { AuthedRequest } from "../types.js";
import {
  parseAgentActions,
  type AgentAction
} from "../utils/agentAction.js";
import { withAgentContext } from "../utils/agentContext.js";
import { fail } from "../utils/http.js";
import { upsertResumeSession } from "./resume.js";

export const agentRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024
  }
});

async function fileSummary(file: Express.Multer.File) {
  const extracted = await extractFileText(file);

  const lines = [
    "用户上传了一个文件，请优先基于【文件正文】回答用户指令。",
    "",
    "【用户指令】（见上文消息）",
    "",
    "【文件元信息】",
    `文件名：${extracted.filename}`,
    `MIME：${extracted.mimeType || "unknown"}`,
    `大小：${extracted.sizeKb} KB`,
    `解析器：${extracted.parser}`,
    ""
  ];

  if (extracted.extractedText) {
    lines.push(
      "【文件正文】",
      "```text",
      extracted.extractedText,
      "```",
      ""
    );
  }

  if (extracted.warnings.length > 0) {
    lines.push(
      "【解析注意事项】",
      ...extracted.warnings.map((w) => `- ${w}`),
      ""
    );
  }

  if (!extracted.extractedText) {
    lines.push(
      "此文件未抽取到正文。请基于文件名、MIME 类型和用户问题给出下一步建议，例如建议用户上传 DOCX、PDF、TXT 或 MD 格式的文件。"
    );
  } else {
    lines.push(
      "【处理要求】",
      "1. 如果这是个人简历，请先识别并结构化其中的基本信息、教育背景、经历、技能、证书、荣誉等。",
      "2. 如果用户要求修改简历，请基于原文内容进行优化，不要凭空捏造经历。",
      "3. 如果信息缺失，请明确标注\"信息缺失\"并给出可补充建议。",
      "4. 如果用户要求生成简历初稿，或者在你完成最终信息核对后用户确认\"核对无误，帮我生成\"，你必须输出固定 CTA 文案和 agent_action JSON。",
      ""
    );
  }

  return lines.join("\n");
}

function readChatBody(req: AuthedRequest) {
  const message = String(req.body?.message || "").trim();
  const conversationId =
    typeof req.body?.conversationId === "string" ? req.body.conversationId : undefined;
  const userId = typeof req.body?.userId === "string" ? req.body.userId : undefined;
  if (!message) throw new Error("USER:请输入消息内容");
  if (userId && userId !== req.user.profile_user_id) {
    throw new Error("USER:userId 与当前登录用户不一致");
  }
  return { message, conversationId };
}

function prepareActionForClient(
  action: AgentAction,
  authReq: AuthedRequest,
  conversationId: string
) {
  if (action.action !== "open_resume_template_modal") return action;

  const payload = action.payload || {};
  const resumeSessionId = upsertResumeSession({
    id: typeof payload.resume_session_id === "string" ? payload.resume_session_id : undefined,
    userId: authReq.user.id,
    conversationId,
    collectedFields:
      payload.collected_fields && typeof payload.collected_fields === "object"
        ? payload.collected_fields
        : {},
    photoOssKey: typeof payload.photo_oss_key === "string" ? payload.photo_oss_key : ""
  });

  return {
    ...action,
    payload: {
      ...payload,
      resume_session_id: resumeSessionId
    }
  };
}

function inferMissingAction(assistantText: string): AgentAction | null {
  const text = assistantText.replace(/\s+/g, "");
  const asksForResumeTemplate =
    /简历/.test(text) &&
    /(模板|DOCX|下载|挑选|选择|初稿)/.test(text) &&
    /(选择|挑选|模板)/.test(text);

  if (asksForResumeTemplate) {
    return {
      action: "open_resume_template_modal",
      payload: {
        resume_session_id: "resume_session_auto",
        cta_label: "如果需要我为你提供简历模板并生成简历初稿，请点击这里",
        auto_open: false,
        collected_fields: {},
        photo_oss_key: ""
      }
    };
  }

  const asksForMockInterview =
    /(模拟面试|面试练习|语音面试)/.test(text) &&
    /(点击|开启|开始|进入)/.test(text);

  if (asksForMockInterview) {
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

const inlineCtaPatterns = [
  "如果需要我为你提供简历模板并生成简历初稿，请点击这里",
  "点击此处开启模拟面试"
];

function stripInlineCtaText(text: string) {
  let result = text;
  for (const pattern of inlineCtaPatterns) {
    result = result.replace(pattern, "");
  }
  return result.replace(/\n{3,}/g, "\n\n").trimEnd();
}

function buildAssistantResponse(args: {
  assistantText: string;
  authReq: AuthedRequest;
  conversationId: string;
}) {
  const parsed = parseAgentActions(args.assistantText);
  const actions =
    parsed.actions.length > 0
      ? parsed.actions
      : [inferMissingAction(parsed.textWithoutAction)].filter(
          (action): action is AgentAction => Boolean(action)
        );

  const preparedActions = actions.map((action) =>
    prepareActionForClient(action, args.authReq, args.conversationId)
  );

  const cleanText = stripInlineCtaText(parsed.textWithoutAction || "");

  return { text: cleanText, actions: preparedActions };
}

function writeCleanAssistantOutput(args: {
  assistantText: string;
  authReq: AuthedRequest;
  conversationId: string;
  writeEvent: (event: string, data: unknown) => void;
}) {
  console.info("[agent.action] assistantText tail", args.assistantText.slice(-600));

  const { text, actions } = buildAssistantResponse({
    assistantText: args.assistantText,
    authReq: args.authReq,
    conversationId: args.conversationId
  });

  console.info("[agent.action] parsed", {
    actionCount: actions.length,
    textLength: text.length,
    textTail: text.slice(-200)
  });

  if (text) {
    addMessage(args.conversationId, "assistant", text);
    for (let index = 0; index < text.length; index += 8) {
      args.writeEvent("delta", { text: text.slice(index, index + 8) });
    }
  }

  for (const action of actions) {
    console.info("[agent.action] write event:action", { action: action.action, payloadKeys: Object.keys(action.payload) });
    args.writeEvent("action", action);
  }
}

agentRouter.post("/chat", async (req, res, next) => {
  try {
    const authReq = req as AuthedRequest;
    const { message, conversationId } = readChatBody(authReq);
    const conversation = ensureConversation(authReq.user.id, conversationId);
    addMessage(conversation.id, "user", message);

    const agentMessage = withAgentContext(message, authReq.user);
    const result = await callBailianCompletion(agentMessage, conversation.bailian_session_id);
    if (result.sessionId) updateConversationSession(conversation.id, result.sessionId);

    const assistant = buildAssistantResponse({
      assistantText: result.text,
      authReq,
      conversationId: conversation.id
    });
    addMessage(conversation.id, "assistant", assistant.text);

    return res.json({
      text: assistant.text,
      actions: assistant.actions,
      conversationId: conversation.id,
      sessionId: result.sessionId
    });
  } catch (error) {
    return next(error);
  }
});

agentRouter.post("/chat-with-file", upload.single("file"), async (req, res, next) => {
  try {
    const authReq = req as AuthedRequest;
    const { message, conversationId } = readChatBody(authReq);
    const file = req.file;
    if (!file) throw new Error("USER:请选择要上传的文件");

    const summary = await fileSummary(file);
    const fullMessage = [message, summary].join("\n\n");
    const conversation = ensureConversation(authReq.user.id, conversationId);
    addMessage(conversation.id, "user", fullMessage);

    const agentMessage = withAgentContext(fullMessage, authReq.user);
    const result = await callBailianCompletion(agentMessage, conversation.bailian_session_id);
    if (result.sessionId) updateConversationSession(conversation.id, result.sessionId);

    const assistant = buildAssistantResponse({
      assistantText: result.text,
      authReq,
      conversationId: conversation.id
    });
    addMessage(conversation.id, "assistant", assistant.text);

    return res.json({
      text: assistant.text,
      actions: assistant.actions,
      conversationId: conversation.id,
      sessionId: result.sessionId
    });
  } catch (error) {
    return next(error);
  }
});

agentRouter.post("/chat/stream", async (req, res, next) => {
  try {
    const authReq = req as AuthedRequest;
    const { message, conversationId } = readChatBody(authReq);
    const conversation = ensureConversation(authReq.user.id, conversationId);
    addMessage(conversation.id, "user", message);

    res.writeHead(200, {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive"
    });

    let assistantText = "";
    const sentStages = new Set<string>();
    const writeEvent = (event: string, data: unknown) => {
      res.write(`event: ${event}\n`);
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };
    const writeStage = (stage: string, label: string) => {
      if (sentStages.has(stage)) return;
      sentStages.add(stage);
      writeEvent("stage", { stage, label });
    };

    writeStage("understood", "已理解需求");
    writeStage("tooling", "正在检索/调用工具");

    await callBailianStream(
      withAgentContext(message, authReq.user),
      conversation.bailian_session_id,
      (text) => {
        writeStage("observed", "已读取工具结果");
        writeStage("answering", "正在生成建议");
        assistantText += text;
      },
      (sessionId) => {
        writeStage("observed", "已读取工具结果");
        writeStage("answering", "正在生成建议");
        if (sessionId) updateConversationSession(conversation.id, sessionId);
        writeCleanAssistantOutput({
          assistantText,
          authReq,
          conversationId: conversation.id,
          writeEvent
        });
        writeEvent("done", { sessionId, conversationId: conversation.id });
      },
      () => writeStage("observed", "已读取工具结果")
    );

    return res.end();
  } catch (error) {
    if (res.headersSent) {
      res.write("event: error\n");
      res.write(`data: ${JSON.stringify({ message: "正在处理，请稍后重试" })}\n\n`);
      return res.end();
    }
    return next(error);
  }
});

agentRouter.use((_req, res) => fail(res, 404, "接口不存在"));
