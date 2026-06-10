import { delay, request, USE_MOCK } from "./http";
import type { DownloadUrl, PhotoUploadToken } from "../types/api";

export const ossApi = {
  async getPhotoUploadToken(userId: string, fileName: string, contentType = "image/jpeg"): Promise<PhotoUploadToken> {
    if (USE_MOCK) {
      await delay(300);
      return {
        uploadUrl: "mock://oss-photo-upload",
        photo_oss_key: `profile_photos/${userId}/photo_${Date.now()}.jpg`,
        expiresIn: 900
      };
    }
    return request<PhotoUploadToken>("/api/oss/photo-upload-token", {
      method: "POST",
      body: JSON.stringify({ profileUserId: userId, fileName, contentType })
    });
  },

  async uploadPhoto(uploadUrl: string, file: File, headers?: Record<string, string>) {
    if (USE_MOCK || uploadUrl.startsWith("mock://")) {
      await delay(500);
      return { uploaded: true };
    }
    const response = await fetch(uploadUrl, {
      method: "PUT",
      body: file,
      headers: headers || { "Content-Type": file.type || "image/jpeg" }
    });
    if (!response.ok) throw new Error("证件照上传失败，请重试");
    return { uploaded: true };
  },

  async getDownloadUrl(key: string): Promise<DownloadUrl> {
    if (USE_MOCK) {
      await delay(250);
      return {
        signed_url: `https://example.com/mock-download?key=${encodeURIComponent(key)}`,
        expiresIn: 600
      };
    }
    return request<DownloadUrl>(`/api/files/download-url?key=${encodeURIComponent(key)}`);
  }
};
