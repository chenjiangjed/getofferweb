import { useMutation } from "@tanstack/react-query";
import { Download, Loader2 } from "lucide-react";
import { useState } from "react";
import { PhotoUploader } from "../components/PhotoUploader";
import { ResumeMaterialReview } from "../components/ResumeMaterialReview";
import { ResumeTemplatePicker } from "../components/ResumeTemplatePicker";
import { agentApi } from "../services/agentApi";
import { resumeApi } from "../services/resumeApi";
import { useAuthStore } from "../stores/authStore";
import { makeConversationId, parseJsonBlock, toAgentMessage } from "../utils/agentMessage";

type ResumeGenerated = {
  type: "resume_generated";
  resume_id: string;
  template_id: string;
  docx_oss_key: string;
};

const fieldGuide = [
  "name：姓名",
  "phone：联系电话",
  "email：电子邮箱",
  "education_section：教育背景",
  "courses：课程",
  "certificates：证书",
  "honors：荣誉",
  "internship_experiences：实习经历",
  "project_experiences：项目经历",
  "campus_experiences：校园经历"
];

export function ResumePage() {
  const user = useAuthStore((state) => state.user);
  const profileId = user?.profile_user_id || "demo_user";
  const [materials, setMaterials] = useState("");
  const [photoKey, setPhotoKey] = useState("");
  const [templateId, setTemplateId] = useState("temp_1");
  const [docxKey, setDocxKey] = useState("");

  const generateMutation = useMutation({
    mutationFn: () =>
      agentApi.chat({
        conversationId: makeConversationId("resume"),
        userId: profileId,
        message: toAgentMessage({
          intent: "generate_resume_docx",
          user_id: profileId,
          template_id: templateId,
          photo_oss_key: photoKey,
          payload: { materials }
        })
      }),
    onSuccess: (data) => {
      const parsed = parseJsonBlock<ResumeGenerated>(data.text);
      if (parsed?.docx_oss_key) setDocxKey(parsed.docx_oss_key);
    }
  });

  return (
    <div className="mx-auto grid max-w-6xl gap-5 px-4 pb-10 sm:px-8 xl:grid-cols-[1fr_360px]">
      <section className="space-y-5">
        <div>
          <h1 className="text-2xl font-semibold text-ink">简历生成</h1>
          <p className="mt-2 text-sm text-muted">
            按模板字段整理信息后交给 Agent/MCP 生成 DOCX，下载由本地后端代理完成。
          </p>
        </div>
        <ResumeMaterialReview value={materials} onChange={setMaterials} />
        <div className="rounded-[18px] border border-line bg-white p-5">
          <button
            onClick={() => generateMutation.mutate()}
            disabled={generateMutation.isPending}
            className="inline-flex h-11 items-center gap-2 rounded-xl bg-brand px-5 text-sm font-medium text-white disabled:bg-slate-300"
          >
            {generateMutation.isPending && <Loader2 size={16} className="animate-spin" />}
            生成 DOCX 简历
          </button>
          {generateMutation.data && (
            <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-muted">
              {generateMutation.data.text}
            </p>
          )}
          {docxKey && (
            <button
              onClick={() => resumeApi.downloadDocx(docxKey)}
              className="mt-4 inline-flex h-10 items-center gap-2 rounded-xl bg-ink px-4 text-sm font-medium text-white"
            >
              <Download size={16} />
              下载生成的简历
            </button>
          )}
        </div>
      </section>
      <aside className="space-y-5">
        <PhotoUploader userId={profileId} onUploaded={setPhotoKey} />
        <ResumeTemplatePicker value={templateId} onChange={setTemplateId} />
        <div className="rounded-[18px] border border-line bg-white p-5 text-sm leading-7 text-muted">
          <div className="font-semibold text-ink">模板字段标准</div>
          {fieldGuide.map((item) => (
            <div key={item}>{item}</div>
          ))}
          <div className="mt-3 break-all">photo_oss_key: {photoKey || "待上传"}</div>
        </div>
      </aside>
    </div>
  );
}
