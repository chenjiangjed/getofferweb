import { Download, Loader2, X } from "lucide-react";
import { useState } from "react";
import { resumeApi } from "../services/resumeApi";

type ResumeTemplateModalProps = {
  conversationId: string;
  resumeSessionId: string;
  onClose: () => void;
  onGenerated: (message: string) => void;
};

const templates = [
  { id: "temp_1", name: "薄荷绿", image: "/resume_templets_bg/temp_1_bg.png" },
  { id: "temp_2", name: "玄墨黑", image: "/resume_templets_bg/temp_2_bg.png" },
  { id: "temp_3", name: "松针绿", image: "/resume_templets_bg/temp_3_bg.png" },
  { id: "temp_4", name: "晴空蓝", image: "/resume_templets_bg/temp_4_bg.png" }
];

export function ResumeTemplateModal({
  conversationId,
  resumeSessionId,
  onClose,
  onGenerated
}: ResumeTemplateModalProps) {
  const [templateId, setTemplateId] = useState("temp_1");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");

  async function generate() {
    setGenerating(true);
    setError("");
    try {
      const result = await resumeApi.generate({
        conversationId,
        resumeSessionId,
        templateId
      });
      const file = result.files[0];
      if (!file) {
        onGenerated("简历已生成，但暂未收到可下载文件。");
        onClose();
        return;
      }

      await resumeApi.downloadDocx(file.ossKey, `${result.resumeId || "resume"}.docx`);
      onGenerated("简历初稿生成完毕啦，请查看你的浏览器下载列表哦~");
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "简历生成失败，请稍后重试");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/30 px-4">
      <div className="w-full max-w-3xl rounded-2xl bg-white p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-ink">选择简历模板</h2>
            <p className="mt-1 text-sm text-muted">选择模板后开始生成 DOCX 简历</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-9 w-9 place-items-center rounded-full text-muted hover:bg-slate-100 hover:text-ink"
            title="关闭"
          >
            <X size={18} />
          </button>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          {templates.map((template) => {
            const selected = template.id === templateId;
            return (
              <button
                key={template.id}
                type="button"
                onClick={() => setTemplateId(template.id)}
                className={`overflow-hidden rounded-xl border bg-white text-left transition ${
                  selected ? "border-brand ring-2 ring-brand/20" : "border-line hover:border-brand/50"
                }`}
              >
                <div className="aspect-[4/3] bg-slate-50">
                  <img
                    src={template.image}
                    alt={template.name}
                    className="h-full w-full object-cover object-top"
                  />
                </div>
                <div className="px-4 py-3 text-sm font-medium text-ink">{template.name}</div>
              </button>
            );
          })}
        </div>

        {error && <p className="mt-4 text-sm text-coral">{error}</p>}

        <div className="mt-5 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="h-10 rounded-xl border border-line px-4 text-sm text-muted hover:bg-slate-50"
          >
            取消
          </button>
          <button
            type="button"
            onClick={generate}
            disabled={generating}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-brand px-4 text-sm font-medium text-white disabled:bg-slate-300"
          >
            {generating ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
            开始生成
          </button>
        </div>
      </div>
    </div>
  );
}
