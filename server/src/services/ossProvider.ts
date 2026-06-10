import OSS from "ali-oss";
import { v4 as uuidv4 } from "uuid";
import { config, hasOssConfig } from "../config.js";
import { safeProfilePath } from "../utils/http.js";

function client() {
  return new OSS({
    region: config.oss.region,
    endpoint: config.oss.endpoint,
    bucket: config.oss.bucket,
    accessKeyId: config.oss.accessKeyId,
    accessKeySecret: config.oss.accessKeySecret,
    secure: true
  });
}

export function buildPhotoKey(profileUserId: string) {
  const photoId = `photo_${uuidv4().replace(/-/g, "").slice(0, 12)}`;
  return `profile_photos/${safeProfilePath(profileUserId)}/${photoId}.jpg`;
}

export function buildInterviewAudioKey(profileUserId: string, extension = "wav") {
  const audioId = `audio_${uuidv4().replace(/-/g, "").slice(0, 12)}`;
  const safeExtension = extension.replace(/[^a-z0-9]/gi, "").toLowerCase() || "wav";
  return `interview_audio/${safeProfilePath(profileUserId)}/${audioId}.${safeExtension}`;
}

export function assertDownloadKeyOwned(key: string, profileUserId: string) {
  const expectedPrefix = `generated_resumes/${safeProfilePath(profileUserId)}/`;
  if (!key.startsWith("generated_resumes/")) {
    throw new Error("USER:只能下载已生成的简历文件");
  }
  if (!key.startsWith(expectedPrefix) || !key.endsWith(".docx")) {
    throw new Error("USER:无权访问该文件");
  }
}

export async function signPhotoPutUrl(key: string, contentType: string) {
  if (!hasOssConfig()) {
    return `https://mock-oss.local/${encodeURIComponent(key)}?mock_signature=1`;
  }
  return client().signatureUrl(key, {
    method: "PUT",
    expires: 600,
    "Content-Type": contentType
  });
}

export async function signDownloadUrl(key: string) {
  if (!hasOssConfig()) {
    return `https://mock-oss.local/${encodeURIComponent(key)}?mock_signature=1`;
  }
  return client().signatureUrl(key, {
    method: "GET",
    expires: 600
  });
}

export async function getPrivateObjectBuffer(key: string) {
  if (!hasOssConfig()) {
    throw new Error("USER:OSS 尚未配置，无法下载生成的简历文件");
  }
  const result = (await (client() as unknown as {
    get: (objectKey: string) => Promise<{ content?: Buffer | Uint8Array | string }>;
  }).get(key)) as { content?: Buffer | Uint8Array | string };
  const content = result.content;
  if (Buffer.isBuffer(content)) return content;
  if (content instanceof Uint8Array) return Buffer.from(content);
  if (typeof content === "string") return Buffer.from(content);
  throw new Error("USER:未读取到简历文件内容");
}

export async function uploadPrivateObject(key: string, body: Buffer, contentType: string) {
  if (!hasOssConfig()) {
    throw new Error("USER:语音转写失败，请重新录制");
  }
  await client().put(key, body, {
    headers: {
      "Content-Type": contentType
    }
  });
}

export async function signPrivateObjectReadUrl(key: string, expires = 3600) {
  if (!hasOssConfig()) {
    throw new Error("USER:语音转写失败，请重新录制");
  }
  return client().signatureUrl(key, {
    method: "GET",
    expires
  });
}

export async function deletePrivateObject(key: string) {
  if (!hasOssConfig()) return;
  await client().delete(key).catch(() => undefined);
}
