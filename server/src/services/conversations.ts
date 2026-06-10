import { v4 as uuidv4 } from "uuid";
import { db } from "../db.js";
import type { Conversation, Message, MessageRole } from "../types.js";
import { nowIso } from "../utils/http.js";

const defaultTitle = "新的对话";

function makeTitle(content: string) {
  return content.replace(/\s+/g, " ").trim().slice(0, 30) || defaultTitle;
}

export function listConversations(userId: string) {
  return db
    .prepare(
      `SELECT id, title, pinned, bailian_session_id, created_at, updated_at
       FROM conversations
       WHERE user_id = ?
       ORDER BY pinned DESC, updated_at DESC`
    )
    .all(userId) as Omit<Conversation, "user_id">[];
}

export function createConversation(userId: string, title = defaultTitle, requestedId?: string) {
  const timestamp = nowIso();
  const conversation: Conversation = {
    id: requestedId || `conv_${uuidv4().replace(/-/g, "").slice(0, 16)}`,
    user_id: userId,
    title,
    pinned: 0,
    bailian_session_id: null,
    created_at: timestamp,
    updated_at: timestamp
  };
  db.prepare(
    `INSERT INTO conversations
      (id, user_id, title, pinned, bailian_session_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(
    conversation.id,
    conversation.user_id,
    conversation.title,
    conversation.pinned,
    conversation.bailian_session_id,
    conversation.created_at,
    conversation.updated_at
  );
  return conversation;
}

export function getConversationForUser(id: string, userId: string) {
  return db
    .prepare("SELECT * FROM conversations WHERE id = ? AND user_id = ?")
    .get(id, userId) as Conversation | undefined;
}

export function ensureConversation(userId: string, id?: string, title?: string) {
  if (id) {
    const existing = getConversationForUser(id, userId);
    if (existing) return existing;
  }
  return createConversation(userId, title, id);
}

export function updateConversationSession(id: string, sessionId: string | null) {
  db.prepare(
    "UPDATE conversations SET bailian_session_id = ?, updated_at = ? WHERE id = ?"
  ).run(sessionId, nowIso(), id);
}

export function updateConversationMeta(id: string, userId: string, changes: { title?: string; pinned?: boolean }) {
  const existing = getConversationForUser(id, userId);
  if (!existing) return null;
  const title = changes.title?.trim() ? changes.title.trim().slice(0, 80) : existing.title;
  const pinned =
    typeof changes.pinned === "boolean" ? (changes.pinned ? 1 : 0) : existing.pinned;
  db.prepare(
    `UPDATE conversations
     SET title = ?, pinned = ?, updated_at = ?
     WHERE id = ? AND user_id = ?`
  ).run(title, pinned, nowIso(), id, userId);
  return getConversationForUser(id, userId)!;
}

export function addMessage(conversationId: string, role: MessageRole, content: string) {
  const message: Message = {
    id: `msg_${uuidv4().replace(/-/g, "").slice(0, 16)}`,
    conversation_id: conversationId,
    role,
    content,
    created_at: nowIso()
  };
  db.prepare(
    `INSERT INTO messages (id, conversation_id, role, content, created_at)
     VALUES (?, ?, ?, ?, ?)`
  ).run(message.id, message.conversation_id, message.role, message.content, message.created_at);

  if (role === "user") {
    db.prepare(
      `UPDATE conversations
       SET title = CASE WHEN title = ? THEN ? ELSE title END,
           updated_at = ?
       WHERE id = ?`
    ).run(defaultTitle, makeTitle(content), nowIso(), conversationId);
  } else {
    db.prepare("UPDATE conversations SET updated_at = ? WHERE id = ?").run(
      nowIso(),
      conversationId
    );
  }

  return message;
}

export function listMessages(conversationId: string) {
  return db
    .prepare(
      `SELECT id, conversation_id, role, content, created_at
       FROM messages
       WHERE conversation_id = ?
       ORDER BY created_at ASC`
    )
    .all(conversationId) as Message[];
}

export function deleteConversation(id: string, userId: string) {
  const result = db
    .prepare("DELETE FROM conversations WHERE id = ? AND user_id = ?")
    .run(id, userId);
  return result.changes > 0;
}
