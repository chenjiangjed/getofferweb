import { useMutation } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useCallback, useState } from "react";
import { AudioRecorder } from "../components/AudioRecorder";
import { CountdownTimer } from "../components/CountdownTimer";
import { InterviewQuestionCard } from "../components/InterviewQuestionCard";
import { ReportPanel } from "../components/ReportPanel";
import { agentApi } from "../services/agentApi";
import { asrApi } from "../services/asrApi";
import { useAuthStore } from "../stores/authStore";
import { makeConversationId, toAgentMessage } from "../utils/agentMessage";

type InterviewStatus = "waiting_question" | "ready_to_record" | "recording" | "transcribing" | "analyzing" | "follow_up" | "finished";

const defaultQuestion = "请介绍一次你主导需求分析或项目推进的经历。";

export function InterviewPage() {
  const user = useAuthStore((state) => state.user);
  const profileId = user?.profile_user_id || "demo_user";
  const [targetJob, setTargetJob] = useState("产品经理实习生");
  const [question, setQuestion] = useState(defaultQuestion);
  const [status, setStatus] = useState<InterviewStatus>("ready_to_record");
  const [secondsLeft, setSecondsLeft] = useState(300);
  const [answerText, setAnswerText] = useState("");
  const [feedback, setFeedback] = useState("");

  const transcribeMutation = useMutation({
    mutationFn: ({ blob, duration }: { blob: Blob; duration: number }) => asrApi.transcribe(blob, duration),
    onSuccess: (data) => {
      setAnswerText(data.answer_text);
      setStatus("analyzing");
      analyzeMutation.mutate(data.answer_text);
    },
    onError: () => setStatus("ready_to_record")
  });

  const analyzeMutation = useMutation({
    mutationFn: (text: string) =>
      agentApi.chat({
        conversationId: makeConversationId("interview"),
        userId: profileId,
        message: toAgentMessage({
          intent: "submit_interview_answer",
          user_id: profileId,
          target_job: targetJob,
          question,
          question_type: "behavior",
          answer_text: text,
          jd_keywords: ["用户调研", "需求分析", "原型设计"]
        })
      }),
    onSuccess: (data) => {
      setFeedback(data.text);
      setStatus("follow_up");
    },
    onError: () => {
      setFeedback("语音转写失败，请重新录制");
      setStatus("follow_up");
    }
  });

  const tick = useCallback(() => setSecondsLeft((value) => Math.max(0, value - 1)), []);
  const stopByTime = useCallback(() => {
    setStatus((current) => (current === "recording" ? "transcribing" : current));
  }, []);

  function startRecording() {
    setSecondsLeft(300);
    setStatus("recording");
  }

  function stopRecording(blob: Blob, duration: number) {
    setStatus("transcribing");
    transcribeMutation.mutate({ blob, duration });
  }

  return (
    <div className="mx-auto grid max-w-6xl gap-5 px-4 pb-10 sm:px-8 xl:grid-cols-[1fr_320px]">
      <section className="space-y-5">
        <div>
          <h1 className="text-2xl font-semibold text-ink">模拟面试</h1>
          <p className="mt-2 text-sm text-muted">前端控制 5 分钟倒计时；音频上传给微后端转写，再提交给 Agent 分析。</p>
        </div>
        <div className="rounded-[18px] border border-line bg-white p-5">
          <label className="block text-sm font-medium text-ink">目标岗位</label>
          <input value={targetJob} onChange={(event) => setTargetJob(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-line px-3 outline-none" />
          <label className="mt-4 block text-sm font-medium text-ink">面试题</label>
          <textarea value={question} onChange={(event) => setQuestion(event.target.value)} rows={2} className="mt-2 w-full resize-none rounded-xl border border-line px-3 py-2 outline-none" />
        </div>
        <InterviewQuestionCard targetJob={targetJob} question={question} status={status} />
        <div className="rounded-[18px] border border-line bg-white p-6">
          <CountdownTimer secondsLeft={secondsLeft} running={status === "recording"} onTick={tick} onDone={stopByTime} />
          <div className="mt-6">
            <AudioRecorder recording={status === "recording"} onStart={startRecording} onStop={stopRecording} />
          </div>
          {(status === "transcribing" || status === "analyzing") && (
            <div className="mt-5 flex items-center justify-center gap-2 text-sm text-muted">
              <Loader2 size={16} className="animate-spin" />
              {status === "transcribing" ? "正在上传音频并转写" : "正在提交 Agent 分析"}
            </div>
          )}
        </div>
        {feedback && (
          <div className="rounded-[18px] border border-line bg-white p-5">
            <h3 className="text-base font-semibold text-ink">单题反馈与追问</h3>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-muted">{feedback}</p>
            <button onClick={() => setStatus("finished")} className="mt-4 h-10 rounded-xl bg-brand px-4 text-sm font-medium text-white">
              结束并查看报告
            </button>
          </div>
        )}
      </section>
      <ReportPanel
        title="面试状态"
        items={[
          { label: "状态", value: status },
          { label: "计时", value: `${secondsLeft}s` },
          { label: "intent", value: "submit_interview_answer" },
          { label: "档案 ID", value: profileId }
        ]}
      />
    </div>
  );
}
