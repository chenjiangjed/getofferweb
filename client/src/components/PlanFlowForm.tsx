import { FormEvent, useState } from "react";

export type PlanMaterials = {
  basic: { name: string; phone: string; email: string };
  intention: { targetCity: string; targetRole: string; stage: string };
  education: { period: string; school: string; major: string; degree: string; courses: string; certificates: string; honors: string };
  skills: string;
  projects: string;
  internships: string;
  campus: string;
};

const emptyMaterials: PlanMaterials = {
  basic: { name: "", phone: "", email: "" },
  intention: { targetCity: "", targetRole: "", stage: "寻找实习" },
  education: { period: "", school: "长安大学", major: "", degree: "本科", courses: "", certificates: "", honors: "" },
  skills: "",
  projects: "",
  internships: "",
  campus: ""
};

type PlanFlowFormProps = {
  onSubmit: (materials: PlanMaterials) => void;
  loading?: boolean;
};

export function PlanFlowForm({ onSubmit, loading }: PlanFlowFormProps) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<PlanMaterials>(emptyMaterials);
  const steps = ["基础信息", "求职意愿", "教育背景", "经历素材"];

  function submit(event: FormEvent) {
    event.preventDefault();
    onSubmit(form);
  }

  return (
    <form onSubmit={submit} className="rounded-[18px] border border-line bg-white p-5">
      <div className="flex gap-2 overflow-x-auto pb-2">
        {steps.map((label, index) => (
          <button
            key={label}
            type="button"
            onClick={() => setStep(index)}
            className={`h-9 shrink-0 rounded-full px-4 text-sm ${step === index ? "bg-ink text-white" : "bg-paper text-muted"}`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mt-5 grid gap-4">
        {step === 0 && (
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="姓名" value={form.basic.name} onChange={(value) => setForm({ ...form, basic: { ...form.basic, name: value } })} />
            <Field label="手机号" value={form.basic.phone} onChange={(value) => setForm({ ...form, basic: { ...form.basic, phone: value } })} />
            <Field label="邮箱" value={form.basic.email} onChange={(value) => setForm({ ...form, basic: { ...form.basic, email: value } })} />
          </div>
        )}
        {step === 1 && (
          <div className="grid gap-4 sm:grid-cols-3">
            <Field
              label="目标城市"
              value={form.intention.targetCity}
              onChange={(value) => setForm({ ...form, intention: { ...form.intention, targetCity: value } })}
            />
            <Field
              label="目标岗位"
              value={form.intention.targetRole}
              onChange={(value) => setForm({ ...form, intention: { ...form.intention, targetRole: value } })}
            />
            <Field label="求职阶段" value={form.intention.stage} onChange={(value) => setForm({ ...form, intention: { ...form.intention, stage: value } })} />
          </div>
        )}
        {step === 2 && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="时间段" value={form.education.period} onChange={(value) => setForm({ ...form, education: { ...form.education, period: value } })} />
            <Field label="学校" value={form.education.school} onChange={(value) => setForm({ ...form, education: { ...form.education, school: value } })} />
            <Field label="专业" value={form.education.major} onChange={(value) => setForm({ ...form, education: { ...form.education, major: value } })} />
            <Field label="学历" value={form.education.degree} onChange={(value) => setForm({ ...form, education: { ...form.education, degree: value } })} />
            <Field label="课程" value={form.education.courses} onChange={(value) => setForm({ ...form, education: { ...form.education, courses: value } })} />
            <Field label="证书/荣誉" value={`${form.education.certificates}${form.education.honors ? `；${form.education.honors}` : ""}`} onChange={(value) => setForm({ ...form, education: { ...form.education, certificates: value } })} />
          </div>
        )}
        {step === 3 && (
          <div className="grid gap-4">
            <TextArea label="个人优势/技能" value={form.skills} onChange={(value) => setForm({ ...form, skills: value })} />
            <TextArea label="项目经历" value={form.projects} onChange={(value) => setForm({ ...form, projects: value })} />
            <TextArea label="实习经历" value={form.internships} onChange={(value) => setForm({ ...form, internships: value })} />
            <TextArea label="校园经历" value={form.campus} onChange={(value) => setForm({ ...form, campus: value })} />
          </div>
        )}
      </div>

      <div className="mt-5 flex justify-between">
        <button type="button" onClick={() => setStep(Math.max(0, step - 1))} className="h-10 rounded-xl border border-line px-4 text-sm" disabled={step === 0}>
          上一步
        </button>
        {step < steps.length - 1 ? (
          <button type="button" onClick={() => setStep(step + 1)} className="h-10 rounded-xl bg-ink px-4 text-sm font-medium text-white">
            下一步
          </button>
        ) : (
          <button disabled={loading} className="h-10 rounded-xl bg-brand px-4 text-sm font-medium text-white disabled:bg-slate-300">
            生成方案
          </button>
        )}
      </div>
    </form>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-ink">{label}</span>
      <input value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-line px-3 outline-none" />
    </label>
  );
}

function TextArea({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-ink">{label}</span>
      <textarea value={value} onChange={(event) => onChange(event.target.value)} rows={3} className="mt-2 w-full resize-none rounded-xl border border-line px-3 py-2 outline-none" />
    </label>
  );
}
