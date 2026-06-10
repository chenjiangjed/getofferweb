import { Router } from "express";
import {
  createConversation,
  deleteConversation,
  getConversationForUser,
  listConversations,
  listMessages,
  updateConversationMeta
} from "../services/conversations.js";
import type { AuthedRequest } from "../types.js";
import { fail, ok } from "../utils/http.js";

export const conversationsRouter = Router();

function conversationDto(conversation: {
  id: string;
  title: string;
  pinned?: number;
  bailian_session_id?: string | null;
  created_at: string;
  updated_at: string;
}) {
  return {
    id: conversation.id,
    title: conversation.title || "新的对话",
    pinned: Boolean(conversation.pinned),
    bailian_session_id: conversation.bailian_session_id || null,
    created_at: conversation.created_at,
    updated_at: conversation.updated_at,
    updatedAt: "最近对话"
  };
}

function messageDto(message: { id: string; role: string; content: string; created_at: string }) {
  return {
    id: message.id,
    role: message.role,
    content: message.content,
    created_at: message.created_at
  };
}

conversationsRouter.get("/", (req, res) => {
  const { user } = req as AuthedRequest;
  return ok(res, listConversations(user.id).map(conversationDto));
});

conversationsRouter.post("/", (req, res) => {
  const { user } = req as AuthedRequest;
  const title =
    typeof req.body?.title === "string" && req.body.title.trim()
      ? req.body.title.trim().slice(0, 80)
      : "新的对话";
  const conversation = createConversation(user.id, title);
  return ok(res, conversationDto(conversation));
});

conversationsRouter.patch("/:id", (req, res) => {
  const { user } = req as unknown as AuthedRequest;
  const title = typeof req.body?.title === "string" ? req.body.title : undefined;
  const pinned = typeof req.body?.pinned === "boolean" ? req.body.pinned : undefined;
  const updated = updateConversationMeta(req.params.id, user.id, { title, pinned });
  if (!updated) return fail(res, 404, "会话不存在");
  return ok(res, conversationDto(updated));
});

conversationsRouter.get("/:id/messages", (req, res) => {
  const { user } = req as unknown as AuthedRequest;
  const conversation = getConversationForUser(req.params.id, user.id);
  if (!conversation) return fail(res, 404, "会话不存在");
  return ok(res, listMessages(conversation.id).map(messageDto));
});

conversationsRouter.delete("/:id", (req, res) => {
  const { user } = req as unknown as AuthedRequest;
  const deleted = deleteConversation(req.params.id, user.id);
  if (!deleted) return fail(res, 404, "会话不存在");
  return ok(res, { deleted: true });
});
