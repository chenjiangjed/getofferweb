import { request } from "./http";
import { useAuthStore } from "../stores/authStore";

export type ResumeGenerateResponse = {
  resumeId: string;
  templateId: string;
  files: Array<{
    type: "docx";
    ossKey: string;
    downloadPath: string;
  }>;
};

export const resumeApi = {
  generate(payload: {
    conversationId: string;
    resumeSessionId: string;
    templateId: string;
  }) {
    return request<ResumeGenerateResponse>("/api/resume/generate", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },

  async downloadDocx(ossKey: string, filename = "resume.docx") {
    const token = useAuthStore.getState().token;
    const apiBase = import.meta.env.VITE_API_BASE_URL || "";
    const response = await fetch(
      `${apiBase}/api/resume/download?key=${encodeURIComponent(ossKey)}`,
      {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      }
    );
    if (!response.ok) throw new Error("简历文件下载失败");
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  }
};
