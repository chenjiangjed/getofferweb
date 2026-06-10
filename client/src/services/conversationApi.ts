import { delay, request, USE_MOCK } from "./http";
import type { Conversation, ConversationMessage } from "../types/api";

const mockConversations: Conversation[] = [
  { id: "conv_plan", title: "长安大学AI求职从0到1", updatedAt: "今天", pinned: true },
  { id: "conv_resume", title: "简历优化", updatedAt: "7 天内" },
  { id: "conv_interview", title: "产品经理实习面试练习", updatedAt: "30 天内" },
  { id: "conv_data", title: "数据分析岗方向确认", updatedAt: "30 天内" }
];

export const conversationApi = {
  async list(): Promise<Conversation[]> {
    if (USE_MOCK) {
      await delay(200);
      return mockConversations;
    }
    return request<Conversation[]>("/api/conversations");
  },

  async create(): Promise<Conversation> {
    if (USE_MOCK) {
      await delay(150);
      return {
        id: `conv_${Date.now()}`,
        title: "新的求职对话",
        updatedAt: "刚刚"
      };
    }
    return request<Conversation>("/api/conversations", { method: "POST" });
  },

  async messages(conversationId: string): Promise<ConversationMessage[]> {
    if (USE_MOCK) {
      await delay(150);
      return [];
    }
    return request<ConversationMessage[]>(`/api/conversations/${conversationId}/messages`);
  },

  async update(conversationId: string, data: { title?: string; pinned?: boolean }): Promise<Conversation> {
    if (USE_MOCK) {
      await delay(150);
      return {
        id: conversationId,
        title: data.title || "新的对话",
        updatedAt: "刚刚",
        pinned: data.pinned
      };
    }
    return request<Conversation>(`/api/conversations/${conversationId}`, {
      method: "PATCH",
      body: JSON.stringify(data)
    });
  },

  async delete(conversationId: string): Promise<{ deleted: boolean }> {
    if (USE_MOCK) {
      await delay(150);
      return { deleted: true };
    }
    return request<{ deleted: boolean }>(`/api/conversations/${conversationId}`, {
      method: "DELETE"
    });
  }
};
