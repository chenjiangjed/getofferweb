export type AgentActionEvent = {
  action: "open_resume_template_modal" | "open_mock_interview_modal";
  payload: Record<string, unknown>;
};

export type ApiResponse<T> = {
  success: boolean;
  data: T;
  message: string;
};

export type AuthUser = {
  id: string;
  username: string;
  nickname: string;
  profile_user_id: string;
};

export type LoginData = {
  token: string;
  user: AuthUser;
};

export type AgentChatRequest = {
  conversationId: string;
  userId: string;
  message: string;
};

export type AgentChatResponse = {
  text: string;
  conversationId: string;
  sessionId: string;
  actions?: AgentActionEvent[];
};

export type PhotoUploadToken = {
  uploadUrl: string;
  method?: string;
  photo_oss_key: string;
  expiresIn?: number;
  expires_in?: number;
  headers?: Record<string, string>;
};

export type DownloadUrl = {
  signed_url: string;
  expiresIn?: number;
  expires_in?: number;
};

export type AsrResult = {
  answer_text: string;
  duration_seconds: number;
  provider?: string;
};

export type Conversation = {
  id: string;
  title: string;
  updatedAt: string;
  pinned?: boolean;
};

export type ConversationMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
};

export type AgentIntentMessage = {
  intent: string;
  user_id: string;
  payload?: Record<string, unknown>;
  template_id?: string;
  photo_oss_key?: string;
  target_job?: string;
  question?: string;
  question_type?: string;
  answer_text?: string;
  jd_keywords?: string[];
};
