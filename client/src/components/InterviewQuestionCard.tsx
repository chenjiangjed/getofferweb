type InterviewQuestionCardProps = {
  targetJob: string;
  question: string;
  status: string;
};

export function InterviewQuestionCard({ targetJob, question, status }: InterviewQuestionCardProps) {
  return (
    <div className="rounded-[18px] border border-line bg-white p-5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-brand">{targetJob || "待确认岗位"}</span>
        <span className="rounded-full bg-paper px-3 py-1 text-xs text-muted">{status}</span>
      </div>
      <h2 className="mt-5 text-xl font-semibold leading-8 text-ink">{question}</h2>
      <p className="mt-3 text-sm leading-7 text-muted">请用 STAR 结构作答：背景、任务、行动、结果。录音上限 5 分钟。</p>
    </div>
  );
}
