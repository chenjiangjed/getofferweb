import type { Request } from "express";

export type User = {
  id: string;
  username: string;
  nickname: string;
  password_hash: string;
  profile_user_id: string;
  failed_login_count: number;
  locked_until: string | null;
  created_at: string;
  updated_at: string;
};

export type AuthUser = Pick<User, "id" | "username" | "nickname" | "profile_user_id">;

export type Conversation = {
  id: string;
  user_id: string;
  title: string;
  pinned: number;
  bailian_session_id: string | null;
  created_at: string;
  updated_at: string;
};

export type MessageRole = "user" | "assistant";

export type Message = {
  id: string;
  conversation_id: string;
  role: MessageRole;
  content: string;
  created_at: string;
};

export type AuthedRequest = Request & {
  user: AuthUser;
};
