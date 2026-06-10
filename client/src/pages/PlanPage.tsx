import { useMutation } from "@tanstack/react-query";
import { PlanFlowForm, type PlanMaterials } from "../components/PlanFlowForm";
import { ReportPanel } from "../components/ReportPanel";
import { agentApi } from "../services/agentApi";
import { useAuthStore } from "../stores/authStore";
import { makeConversationId, toAgentMessage } from "../utils/agentMessage";

export function PlanPage() {
  const user = useAuthStore((state) => state.user);
  const mutation = useMutation({
    mutationFn: (materials: PlanMaterials) =>
      agentApi.chat({
        conversationId: makeConversationId("plan"),
        userId: user?.profile_user_id || "demo_user",
        message: toAgentMessage({
          intent: "career_plan_collect_materials",
          user_id: user?.profile_user_id || materials.basic.name || "demo_user",
          payload: materials as unknown as Record<string, unknown>
        })
      })
  });

  return (
    <div className="mx-auto grid max-w-6xl gap-5 px-4 pb-10 sm:px-8 lg:grid-cols-[1fr_320px]">
      <section>
        <div className="mb-5">
          <h1 className="text-2xl font-semibold text-ink">一站式求职方案</h1>
          <p className="mt-2 text-sm text-muted">按文档字段收集素材，提交后通过 /api/agent/chat 交给百炼 Agent 生成方案。</p>
        </div>
        <PlanFlowForm onSubmit={(materials) => mutation.mutate(materials)} loading={mutation.isPending} />
        {mutation.data && (
          <div className="mt-5 rounded-[18px] border border-line bg-white p-5">
            <h2 className="text-lg font-semibold">Agent 方案</h2>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-muted">{mutation.data.text}</p>
          </div>
        )}
      </section>
      <ReportPanel
        title="当前流程"
        items={[
          { label: "模块", value: "一站式求职方案" },
          { label: "intent", value: "career_plan_collect_materials" },
          { label: "档案 ID", value: user?.profile_user_id || "demo_user" }
        ]}
      />
    </div>
  );
}
