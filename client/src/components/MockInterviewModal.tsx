import { Loader2, RotateCcw, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { interviewApi, InterviewQuestion } from "../services/interviewApi";
import { AudioRecorder } from "./AudioRecorder";
import { CountdownTimer } from "./CountdownTimer";

type MockInterviewModalProps = {
  conversationId: string;
  payload: Record<string, unknown>;
  onClose: () => void;
  onFinished: (report: string) => void;
};

type InterviewStatus =
  | "starting"
  | "ready"
  | "recording"
  | "analyzing"
  | "finished";

type LastSubmit = {
  blob: Blob;
  durationSeconds: number;
  questionId: string;
};

function getFirstQuestion(payload: Record<string, unknown>) {
  const questions = Array.isArray(payload.questions) ? payload.questions : [];
  return questions[0] as Record<string, unknown> | undefined;
}

function getQuestionCount(payload: Record<string, unknown>) {
  const count = Number(payload.question_count || payload.questionCount || 5);
  if (!Number.isFinite(count)) return 5;
  return Math.min(10, Math.max(1, Math.round(count)));
}

export function MockInterviewModal({
  conversationId,
  payload,
  onClose,
  onFinished
}: MockInterviewModalProps) {
  const [status, setStatus] = useState<InterviewStatus>("starting");
  const [sessionId, setSessionId] = useState("");
  const [targetJob, setTargetJob] = useState(String(payload.target_job || payload.targetJob || "目标岗位"));
  const [currentIndex, setCurrentIndex] = useState(1);
  const [total, setTotal] = useState(getQuestionCount(payload));
  const [secondsLeft, setSecondsLeft] = useState(300);
  const [question, setQuestion] = useState<InterviewQuestion | null>(null);
  const [error, setError] = useState("");
  const [lastSubmit, setLastSubmit] = useState<LastSubmit | null>(null);
  const [retrying, setRetrying] = useState(false);
  const submittingRef = useRef(false);

  useEffect(() => {
    let mounted = true;
    async function start() {
      setStatus("starting");
      setError("");
      try {
        const result = await interviewApi.start({
          conversationId,
          interviewSessionId: String(payload.interview_session_id || payload.interviewSessionId || ""),
          targetJob: String(payload.target_job || payload.targetJob || "目标岗位"),
          questionCount: getQuestionCount(payload),
          question: getFirstQuestion(payload)
        });
        if (!mounted) return;
        setSessionId(result.interviewSessionId);
        setTargetJob(result.targetJob);
        setCurrentIndex(result.currentIndex);
        setTotal(result.total);
        setSecondsLeft(result.secondsPerQuestion);
        setQuestion(result.question);
        setStatus("ready");
      } catch (err) {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : "模拟面试启动失败");
        setStatus("ready");
      }
    }
    void start();
    return () => {
      mounted = false;
    };
  }, [conversationId, payload]);

  const tick = useCallback(() => setSecondsLeft((value) => Math.max(0, value - 1)), []);
  const stopByTime = useCallback(() => {
    setStatus((current) => (current === "recording" ? "analyzing" : current));
  }, []);

  function startRecording() {
    setSecondsLeft(300);
    setError("");
    setLastSubmit(null);
    setStatus("recording");
  }

  async function submitAnswer(blob: Blob, durationSeconds: number, questionId: string) {
    if (!sessionId) return;
    const result = await interviewApi.answer({
      interviewSessionId: sessionId,
      questionId,
      durationSeconds,
      audio: blob
    });
    if (result.status === "finished") {
      setStatus("finished");
      setLastSubmit(null);
      onFinished(result.finalReport);
      onClose();
      return;
    }
    setCurrentIndex(result.currentIndex);
    setTotal(result.total);
    setQuestion(result.question);
    setSecondsLeft(300);
    setLastSubmit(null);
    setStatus("ready");
  }

  async function stopRecording(blob: Blob, durationSeconds: number) {
    if (!question || !sessionId || submittingRef.current) return;
    submittingRef.current = true;
    setStatus("analyzing");
    setError("");
    setLastSubmit({
      blob,
      durationSeconds,
      questionId: question.questionId
    });
    try {
      await submitAnswer(blob, durationSeconds, question.questionId);
    } catch (err) {
      console.error("[mock-interview] submit answer failed", err);
      setError(err instanceof Error ? err.message : "语音转写失败，请重新录制");
      setSecondsLeft(300);
      setStatus("ready");
    } finally {
      submittingRef.current = false;
    }
  }

  async function retryLastSubmit() {
    if (!lastSubmit || retrying || submittingRef.current) return;
    submittingRef.current = true;
    setRetrying(true);
    setStatus("analyzing");
    setError("");
    try {
      await submitAnswer(lastSubmit.blob, lastSubmit.durationSeconds, lastSubmit.questionId);
    } catch (err) {
      console.error("[mock-interview] retry submit failed", err);
      setError(err instanceof Error ? err.message : "重试失败，请稍后再试");
      setSecondsLeft(300);
      setStatus("ready");
    } finally {
      setRetrying(false);
      submittingRef.current = false;
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/30 px-4">
      <div className="w-full max-w-2xl rounded-2xl bg-white p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-ink">模拟面试</h2>
            <p className="mt-1 text-sm text-muted">{targetJob}</p>
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

        <div className="mt-5 rounded-xl border border-line bg-slate-50 p-4">
          <div className="text-sm font-medium text-brand">
            第 {currentIndex} / {total} 题
          </div>
          <div className="mt-3 min-h-[72px] text-lg font-semibold leading-8 text-ink">
            {question?.question || "正在生成面试题..."}
          </div>
        </div>

        <div className="mt-5 rounded-xl border border-line p-5">
          <CountdownTimer
            secondsLeft={secondsLeft}
            running={status === "recording"}
            onTick={tick}
            onDone={stopByTime}
          />
          <div className="mt-5">
            {status === "starting" || status === "analyzing" ? (
              <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted">
                <Loader2 size={17} className="animate-spin" />
                {status === "starting"
                  ? "正在准备面试"
                  : "系统正在撰写并分析中，请保持该页面耐心等待~"}
              </div>
            ) : (
              <AudioRecorder
                recording={status === "recording"}
                onStart={startRecording}
                onStop={stopRecording}
              />
            )}
          </div>
        </div>

        {error && (
          <div className="mt-4 flex items-center justify-between gap-3">
            <p className="text-sm text-coral">{error}</p>
            {lastSubmit && (
              <button
                type="button"
                onClick={retryLastSubmit}
                disabled={retrying || status === "analyzing"}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line px-3 text-sm font-medium text-ink hover:bg-slate-50 disabled:opacity-60"
              >
                <RotateCcw size={14} />
                {retrying ? "重试中..." : "重试"}
              </button>
            )}
          </div>
        )}

        <div className="mt-5 flex justify-between gap-3 text-sm text-muted">
          <span>{status === "recording" ? "录音中" : "准备回答"}</span>
          <span>每题 5 分钟，语音作答</span>
        </div>
      </div>
    </div>
  );
}
