import { CheckCircle2, Loader2, Circle } from "lucide-react";

export type AgentStageKey = "understood" | "tooling" | "observed" | "answering";

export type AgentStage = {
  key: AgentStageKey;
  label: string;
  status: "pending" | "active" | "done";
};

type AgentProcessPanelProps = {
  stages: AgentStage[];
};

export const defaultAgentStages: AgentStage[] = [
  { key: "understood", label: "已理解需求", status: "pending" },
  { key: "tooling", label: "正在检索/调用工具", status: "pending" },
  { key: "observed", label: "已读取工具结果", status: "pending" },
  { key: "answering", label: "正在生成建议", status: "pending" }
];

export function AgentProcessPanel({ stages }: AgentProcessPanelProps) {
  return (
    <div className="max-w-[82%] rounded-2xl border border-line bg-white px-4 py-3 text-sm shadow-sm">
      <div className="mb-2 font-medium text-ink">Agent 正在处理</div>
      <div className="space-y-2">
        {stages.map((stage) => (
          <div key={stage.key} className="flex items-center gap-2 text-muted">
            {stage.status === "done" && <CheckCircle2 size={16} className="text-mint" />}
            {stage.status === "active" && <Loader2 size={16} className="animate-spin text-brand" />}
            {stage.status === "pending" && <Circle size={16} className="text-slate-300" />}
            <span className={stage.status === "active" ? "text-ink" : ""}>{stage.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
