const templates = [
  { id: "temp_1", name: "清爽单栏", accent: "bg-blue-500" },
  { id: "temp_2", name: "左右分栏", accent: "bg-emerald-500" },
  { id: "temp_3", name: "校园经历强化", accent: "bg-amber-500" },
  { id: "temp_4", name: "项目能力突出", accent: "bg-rose-500" }
] as const;

type ResumeTemplatePickerProps = {
  value: string;
  onChange: (value: string) => void;
};

export function ResumeTemplatePicker({ value, onChange }: ResumeTemplatePickerProps) {
  return (
    <div className="rounded-[18px] border border-line bg-white p-5">
      <h3 className="text-base font-semibold text-ink">模板选择</h3>
      <div className="scrollbar-thin mt-4 flex gap-3 overflow-x-auto pb-2 lg:grid lg:grid-cols-2 lg:overflow-visible">
        {templates.map((template) => (
          <button
            key={template.id}
            onClick={() => onChange(template.id)}
            className={`w-40 shrink-0 rounded-2xl border p-3 text-left transition lg:w-auto ${
              value === template.id ? "border-brand bg-blue-50" : "border-line bg-white hover:bg-paper"
            }`}
          >
            <div className="h-24 rounded-xl bg-paper p-3">
              <div className={`h-2 w-16 rounded-full ${template.accent}`} />
              <div className="mt-3 h-2 rounded-full bg-slate-300" />
              <div className="mt-2 h-2 w-2/3 rounded-full bg-slate-200" />
              <div className="mt-4 grid grid-cols-2 gap-2">
                <div className="h-8 rounded bg-white" />
                <div className="h-8 rounded bg-white" />
              </div>
            </div>
            <div className="mt-3 text-sm font-semibold text-ink">{template.id}</div>
            <div className="text-xs text-muted">{template.name}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
