import { Router } from "express";
import { v4 as uuidv4 } from "uuid";
import { db } from "../db.js";
import { addMessage } from "../services/conversations.js";
import { callBailianCompletion } from "../services/dashscopeProvider.js";
import { assertDownloadKeyOwned, getPrivateObjectBuffer } from "../services/ossProvider.js";
import type { AuthedRequest } from "../types.js";
import { parseJsonBlock } from "../utils/agentAction.js";
import { withAgentContext } from "../utils/agentContext.js";
import { ok } from "../utils/http.js";

export const resumeRouter = Router();

const templateIds = new Set(["temp_1", "temp_2", "temp_3", "temp_4"]);
const standardResumeFields = [
  "name",
  "phone",
  "email",
  "education_section",
  "courses",
  "certificates",
  "honors",
  "internship_experiences",
  "project_experiences",
  "campus_experiences"
] as const;

type ResumeSession = {
  id: string;
  user_id: string;
  conversation_id: string;
  collected_fields: string;
  photo_oss_key: string;
};

type ResumeGenerated = {
  type: "resume_generated";
  resume_id: string;
  template_id: string;
  docx_oss_key: string;
};

type StoredResumeFields = {
  materials: Record<string, string>;
  structured_materials: Record<string, unknown>;
};

function now() {
  return new Date().toISOString();
}

function stringifyField(value: unknown) {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === "string") return item;
        if (item && typeof item === "object") {
          return Object.values(item as Record<string, unknown>)
            .filter((part) => part != null && String(part).trim())
            .join(" ");
        }
        return String(item || "");
      })
      .filter((item) => item.trim())
      .join("\n");
  }
  if (typeof value === "object") {
    return Object.values(value as Record<string, unknown>)
      .filter((part) => part != null && String(part).trim())
      .join(" ");
  }
  return String(value);
}

function sourceObject(input: unknown) {
  return input && typeof input === "object" ? (input as Record<string, unknown>) : {};
}

function asList(value: unknown) {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

function pickText(source: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = source[key];
    if (value != null && String(value).trim()) return String(value).trim();
  }
  return "";
}

function normalizeBullet(value: unknown) {
  if (value && typeof value === "object") {
    const source = value as Record<string, unknown>;
    return {
      label: pickText(source, ["label", "title", "name", "category"]),
      text: pickText(source, ["text", "content", "description", "detail", "value"])
    };
  }
  const text = String(value || "").trim();
  const separator = text.includes("：") ? "：" : text.includes(":") ? ":" : "";
  if (separator) {
    const [label, ...rest] = text.split(separator);
    const content = rest.join(separator).trim();
    if (label.trim().length <= 12 && content) return { label: label.trim(), text: content };
  }
  return { label: "", text };
}

function normalizeExperienceList(value: unknown) {
  return asList(value)
    .map((item) => {
      if (!item || typeof item !== "object") {
        const text = String(item || "").trim();
        return text ? { title: text, bullets: [] } : null;
      }
      const source = item as Record<string, unknown>;
      const rawBullets =
        source.bullets ?? source.description ?? source.descriptions ?? source.details ?? [];
      return {
        time: pickText(source, ["time", "date", "period", "date_range"]),
        company: pickText(source, ["company", "organization", "employer"]),
        title: pickText(source, ["title", "name", "project_name"]),
        role: pickText(source, ["role", "position", "job_title"]),
        bullets: asList(rawBullets)
          .map(normalizeBullet)
          .filter((bullet) => bullet.text)
      };
    })
    .filter(Boolean);
}

function normalizeStructuredResumeFields(input: unknown) {
  const source = sourceObject(input);
  const nestedMaterials = sourceObject(source.materials);
  const nestedStructured = sourceObject(source.structured_materials);
  const aliases: Record<string, unknown> = {
    ...source,
    ...nestedMaterials,
    ...nestedStructured,
    education: source.education_section ?? source.education ?? nestedStructured.education,
    project_experiences:
      source.project_experiences ?? source.projects ?? nestedStructured.project_experiences,
    internship_experiences:
      source.internship_experiences ?? source.internships ?? nestedStructured.internship_experiences,
    campus_experiences:
      source.campus_experiences ?? source.campus_experience ?? nestedStructured.campus_experiences
  };

  return {
    education: asList(aliases.education),
    courses: asList(aliases.courses),
    certificates: asList(aliases.certificates),
    honors: asList(aliases.honors),
    project_experiences: normalizeExperienceList(aliases.project_experiences),
    internship_experiences: normalizeExperienceList(aliases.internship_experiences),
    campus_experiences: normalizeExperienceList(aliases.campus_experiences)
  };
}

export function normalizeResumeFields(input: unknown) {
  const source = sourceObject(input);
  const nestedMaterials = sourceObject(source.materials);
  const aliases: Record<string, unknown> = {
    ...source,
    ...nestedMaterials,
    education_section: source.education_section ?? source.education ?? nestedMaterials.education_section,
    courses: source.courses ?? source.coursework ?? source.skills ?? nestedMaterials.courses,
    certificates: source.certificates ?? source.certs,
    honors: source.honors ?? source.awards,
    internship_experiences:
      source.internship_experiences ?? source.internships ?? nestedMaterials.internship_experiences,
    project_experiences:
      source.project_experiences ?? source.projects ?? nestedMaterials.project_experiences,
    campus_experiences:
      source.campus_experiences ?? source.campus_experience ?? nestedMaterials.campus_experiences
  };

  return standardResumeFields.reduce<Record<string, string>>((fields, key) => {
    fields[key] = stringifyField(aliases[key]).trim();
    return fields;
  }, {});
}

function packResumeFields(input: unknown): StoredResumeFields {
  return {
    materials: normalizeResumeFields(input),
    structured_materials: normalizeStructuredResumeFields(input)
  };
}

function unpackResumeFields(raw: string): StoredResumeFields {
  const parsed = JSON.parse(raw || "{}") as unknown;
  const source = sourceObject(parsed);
  if (source.materials || source.structured_materials) {
    return {
      materials: normalizeResumeFields(source.materials || parsed),
      structured_materials: normalizeStructuredResumeFields(source.structured_materials || parsed)
    };
  }
  return packResumeFields(parsed);
}

export function upsertResumeSession(input: {
  id?: string;
  userId: string;
  conversationId: string;
  collectedFields: unknown;
  photoOssKey?: string;
}) {
  const id =
    input.id && input.id !== "resume_session_auto"
      ? input.id
      : `resume_session_${uuidv4().replace(/-/g, "").slice(0, 12)}`;
  const timestamp = now();
  db.prepare(
    `INSERT INTO resume_sessions
      (id, user_id, conversation_id, collected_fields, photo_oss_key, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
      collected_fields = excluded.collected_fields,
      photo_oss_key = excluded.photo_oss_key,
      updated_at = excluded.updated_at`
  ).run(
    id,
    input.userId,
    input.conversationId,
    JSON.stringify(packResumeFields(input.collectedFields)),
    input.photoOssKey || "",
    timestamp,
    timestamp
  );
  return id;
}

resumeRouter.post("/session", async (req, res, next) => {
  try {
    const { user } = req as AuthedRequest;
    const conversationId = String(req.body?.conversationId || "");

    if (!conversationId) throw new Error("USER:缺少会话 ID");

    const sessionId = upsertResumeSession({
      userId: user.id,
      conversationId,
      collectedFields: {}
    });

    return ok(res, { resumeSessionId: sessionId });
  } catch (error) {
    return next(error);
  }
});

resumeRouter.post("/generate", async (req, res, next) => {
  try {
    const { user } = req as AuthedRequest;
    const resumeSessionId = String(req.body?.resumeSessionId || "");
    const templateId = String(req.body?.templateId || "");

    if (!resumeSessionId) throw new Error("USER:缺少简历会话");
    if (!templateIds.has(templateId)) throw new Error("USER:请选择有效的简历模板");

    const session = db
      .prepare("SELECT * FROM resume_sessions WHERE id = ? AND user_id = ?")
      .get(resumeSessionId, user.id) as ResumeSession | undefined;
    if (!session) throw new Error("USER:简历会话不存在或已失效");

    const fields = unpackResumeFields(session.collected_fields || "{}");
    const materials = fields.materials;
    const structuredMaterials = fields.structured_materials;
    const message = JSON.stringify({
      intent: "generate_resume_docx",
      user_id: user.profile_user_id,
      template_id: templateId,
      photo_oss_key: session.photo_oss_key || "",
      payload: {
        materials,
        resume_data: {
          ...materials,
          structured_materials: structuredMaterials
        },
        formatting_requirements: {
          experience_header: "time / organization-or-project / role",
          bullets: "render each responsibility as a separate bullet; keep label bold when provided",
          do_not_flatten_experiences: true
        }
      }
    });

    const result = await callBailianCompletion(withAgentContext(message, user), null);
    const parsed = parseJsonBlock<ResumeGenerated>(result.text, "resume_generated");
    if (!parsed?.docx_oss_key) {
      throw new Error("USER:简历生成失败，未收到 DOCX 文件路径");
    }

    assertDownloadKeyOwned(parsed.docx_oss_key, user.profile_user_id);
    const downloadPath = `/api/resume/download?key=${encodeURIComponent(parsed.docx_oss_key)}`;
    addMessage(
      session.conversation_id,
      "assistant",
      "简历初稿生成完毕啦，请查看你的浏览器下载列表哦~"
    );

    return ok(res, {
      resumeId: parsed.resume_id,
      templateId: parsed.template_id || templateId,
      files: [
        {
          type: "docx",
          ossKey: parsed.docx_oss_key,
          downloadPath
        }
      ]
    });
  } catch (error) {
    return next(error);
  }
});

resumeRouter.get("/download", async (req, res, next) => {
  try {
    const { user } = req as AuthedRequest;
    const key = String(req.query.key || "");
    if (!key) throw new Error("USER:缺少简历文件路径");
    assertDownloadKeyOwned(key, user.profile_user_id);
    const buffer = await getPrivateObjectBuffer(key);
    const filename = key.split("/").pop() || "resume.docx";

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    );
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Length", String(buffer.length));
    return res.send(buffer);
  } catch (error) {
    return next(error);
  }
});
