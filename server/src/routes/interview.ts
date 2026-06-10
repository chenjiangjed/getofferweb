import { Router } from "express";
import multer from "multer";
import { v4 as uuidv4 } from "uuid";
import { db } from "../db.js";
import { addMessage } from "../services/conversations.js";
import { callBailianCompletion } from "../services/dashscopeProvider.js";
import { transcribeAudio } from "../services/asrProvider.js";
import type { AuthedRequest } from "../types.js";
import { parseJsonBlock } from "../utils/agentAction.js";
import { withAgentContext } from "../utils/agentContext.js";
import { ok } from "../utils/http.js";

export const interviewRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024,
    files: 1
  }
});

type Question = {
  questionId: string;
  question: string;
  questionType: string;
};

type InterviewSession = {
  id: string;
  user_id: string;
  conversation_id: string;
  target_job: string;
  total_questions: number;
  current_index: number;
  current_question_id: string;
  current_question: string;
  current_question_type: string;
  status: string;
};

type InterviewAnswer = {
  id: string;
  question_id: string;
  question: string;
  question_type: string;
  answer_text: string;
  duration_seconds: number;
  feedback_json: string;
};

type NextQuestionResult = {
  type: "interview_next_question";
  current_feedback?: Record<string, unknown>;
  next_question?: {
    question_id?: string;
    question?: string;
    question_type?: string;
  };
};

type FinalReportResult = {
  type: "interview_final_report";
  final_report?: string;
  overall_score?: number;
  strengths?: string[];
  improvements?: string[];
};

function now() {
  return new Date().toISOString();
}

function clampQuestionCount(value: unknown) {
  const count = Number(value || 5);
  if (!Number.isFinite(count)) return 5;
  return Math.min(10, Math.max(1, Math.round(count)));
}

function normalizeQuestion(input: unknown, fallbackTargetJob: string): Question {
  const value = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  return {
    questionId: String(value.question_id || value.questionId || "q1"),
    question:
      String(value.question || "").trim() ||
      `请先做一个面向${fallbackTargetJob || "目标岗位"}的 1 分钟自我介绍。`,
    questionType: String(value.question_type || value.questionType || "behavior")
  };
}

function getSession(id: string, userId: string) {
  return db
    .prepare("SELECT * FROM interview_sessions WHERE id = ? AND user_id = ?")
    .get(id, userId) as InterviewSession | undefined;
}

function listPreviousAnswers(sessionId: string) {
  return db
    .prepare(
      `SELECT question_id, question, question_type, answer_text, duration_seconds, feedback_json
       FROM interview_answers
       WHERE session_id = ?
       ORDER BY created_at ASC`
    )
    .all(sessionId) as InterviewAnswer[];
}

function fallbackFinalReport(session: InterviewSession) {
  return [
    "综合评分：暂未生成分数",
    "",
    `本次模拟面试已完成，目标岗位：${session.target_job}。`,
    "",
    "改进建议：建议继续使用 STAR 结构组织回答，并补充更清晰的数据结果、个人行动和复盘收获。"
  ].join("\n");
}

interviewRouter.post("/start", async (req, res, next) => {
  try {
    const { user } = req as AuthedRequest;
    const conversationId = String(req.body?.conversationId || "");
    const targetJob = String(req.body?.targetJob || "目标岗位");
    const total = clampQuestionCount(req.body?.questionCount);
    const firstQuestion = normalizeQuestion(req.body?.question, targetJob);
    const id =
      typeof req.body?.interviewSessionId === "string" &&
      req.body.interviewSessionId &&
      req.body.interviewSessionId !== "interview_session_auto"
        ? req.body.interviewSessionId
        : `interview_session_${uuidv4().replace(/-/g, "").slice(0, 12)}`;
    const timestamp = now();

    db.prepare(
      `INSERT INTO interview_sessions
        (id, user_id, conversation_id, target_job, total_questions, current_index,
         current_question_id, current_question, current_question_type, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?, 'active', ?, ?)
       ON CONFLICT(id) DO UPDATE SET
        target_job = excluded.target_job,
        total_questions = excluded.total_questions,
        current_index = 1,
        current_question_id = excluded.current_question_id,
        current_question = excluded.current_question,
        current_question_type = excluded.current_question_type,
        status = 'active',
        updated_at = excluded.updated_at`
    ).run(
      id,
      user.id,
      conversationId,
      targetJob,
      total,
      firstQuestion.questionId,
      firstQuestion.question,
      firstQuestion.questionType,
      timestamp,
      timestamp
    );

    return ok(res, {
      interviewSessionId: id,
      targetJob,
      currentIndex: 1,
      total,
      secondsPerQuestion: 300,
      question: firstQuestion
    });
  } catch (error) {
    return next(error);
  }
});

interviewRouter.post("/answer", upload.single("audio"), async (req, res, next) => {
  try {
    const { user } = req as AuthedRequest;
    const interviewSessionId = String(req.body?.interviewSessionId || "");
    const questionId = String(req.body?.questionId || "");
    const durationSeconds = Math.max(1, Math.round(Number(req.body?.durationSeconds || 0)));
    const session = getSession(interviewSessionId, user.id);

    console.info("[interview.answer] start", { interviewSessionId, questionId, sessionStatus: session?.status });

    if (!session) throw new Error("USER:模拟面试会话不存在或已失效");

    // Idempotency: if session is finished, check if this question already has an answer
    // and return the existing final report (handles retry after backend already succeeded)
    if (session.status !== "active") {
      const existingAnswer = db
        .prepare("SELECT * FROM interview_answers WHERE session_id = ? AND question_id = ? ORDER BY created_at DESC LIMIT 1")
        .get(session.id, questionId) as InterviewAnswer | undefined;
      if (existingAnswer && session.status === "finished") {
        console.info("[interview.answer] session already finished, returning existing report");
        const feedback = JSON.parse(existingAnswer.feedback_json || "{}") as Record<string, unknown>;
        const finalReport =
          (feedback.final_report as string) ||
          fallbackFinalReport(session);
        return ok(res, { status: "finished", finalReport });
      }
      throw new Error("USER:本场模拟面试已经结束");
    }
    if (questionId !== session.current_question_id) throw new Error("USER:当前题目已更新，请重新录制");

    // Idempotency: check for existing answer with feedback (already completed)
    const existingAnswer = db
      .prepare("SELECT * FROM interview_answers WHERE session_id = ? AND question_id = ? LIMIT 1")
      .get(session.id, session.current_question_id) as InterviewAnswer | undefined;
    if (existingAnswer) {
      const hasFeedback = (() => {
        try {
          const fb = JSON.parse(existingAnswer.feedback_json || "{}") as Record<string, unknown>;
          return Object.keys(fb).length > 0;
        } catch {
          return false;
        }
      })();
      if (hasFeedback) {
        console.info("[interview.answer] duplicate with feedback, returning existing result");
        const isFinal = session.current_index >= session.total_questions;
        if (isFinal) {
          const feedback = JSON.parse(existingAnswer.feedback_json || "{}") as Record<string, unknown>;
          const finalReport =
            (feedback.final_report as string) ||
            fallbackFinalReport(session);
          return ok(res, { status: "finished", finalReport });
        }
        return ok(res, {
          status: "next_question",
          currentIndex: session.current_index,
          total: session.total_questions,
          question: {
            questionId: session.current_question_id,
            question: session.current_question,
            questionType: session.current_question_type
          }
        });
      }
      // ASR already done but Bailian not yet called (retry scenario)
      console.info("[interview.answer] retry detected, reusing existing ASR text", {
        textLength: existingAnswer.answer_text.length
      });
    }

    let answerText: string;
    let answerDuration: number;
    let answerId: string;

    if (existingAnswer?.answer_text) {
      // Retry: reuse saved ASR text, skip re-transcription
      answerText = existingAnswer.answer_text;
      answerDuration = existingAnswer.duration_seconds;
      answerId = existingAnswer.id || `answer_${uuidv4().replace(/-/g, "").slice(0, 12)}`;
      console.info("[interview.answer] reusing saved ASR", { textLength: answerText.length });
    } else {
      // First attempt: do ASR and save immediately
      const asr = await transcribeAudio(req.file, user.profile_user_id);
      console.info("[interview.answer] asr success", { textLength: asr.text.length });
      answerText = asr.text;
      answerDuration = durationSeconds || asr.duration;
      answerId = `answer_${uuidv4().replace(/-/g, "").slice(0, 12)}`;

      // Save pending answer (ASR text only, no feedback yet) so retry can reuse
      const pendingTs = now();
      db.prepare(
        `INSERT INTO interview_answers
          (id, session_id, question_id, question, question_type, answer_text,
           duration_seconds, feedback_json, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        answerId,
        session.id,
        session.current_question_id,
        session.current_question,
        session.current_question_type,
        answerText,
        answerDuration,
        "{}",
        pendingTs
      );
      console.info("[interview.answer] pending answer saved", {
        sessionId: session.id,
        questionId: session.current_question_id
      });
    }

    const previousAnswers = listPreviousAnswers(session.id);
    const isFinal = session.current_index >= session.total_questions;
    const prompt = JSON.stringify({
      intent: "submit_interview_answer",
      user_id: user.profile_user_id,
      target_job: session.target_job,
      interview_session_id: session.id,
      current_index: session.current_index,
      total_questions: session.total_questions,
      question: session.current_question,
      question_type: session.current_question_type,
      answer_text: answerText,
      duration_seconds: answerDuration,
      previous_answers: previousAnswers,
      expected_result_type: isFinal ? "interview_final_report" : "interview_next_question"
    });

    const bailianStartMs = Date.now();
    console.info("[interview.answer] bailian start", { isFinal, promptLength: prompt.length });
    const result = await callBailianCompletion(withAgentContext(prompt, user), null);
    console.info("[interview.answer] agent success", {
      resultLength: result.text.length,
      isFinal,
      elapsedMs: Date.now() - bailianStartMs
    });

    const feedback =
      parseJsonBlock<FinalReportResult>(result.text, "interview_final_report") ||
      parseJsonBlock<NextQuestionResult>(result.text, "interview_next_question");
    const timestamp = now();

    // Update the pending answer with feedback
    db.prepare(
      `UPDATE interview_answers SET feedback_json = ? WHERE id = ?`
    ).run(JSON.stringify(feedback || {}), answerId);
    console.info("[interview.answer] feedback saved", { answerId, sessionId: session.id, questionId: session.current_question_id });

    if (isFinal) {
      const report =
        (feedback as FinalReportResult | null)?.final_report ||
        result.text ||
        fallbackFinalReport(session);
      db.prepare("UPDATE interview_sessions SET status = 'finished', updated_at = ? WHERE id = ?").run(
        timestamp,
        session.id
      );
      if (session.conversation_id) {
        addMessage(session.conversation_id, "assistant", report);
      }
      console.info("[interview.answer] response finished");
      return ok(res, { status: "finished", finalReport: report });
    }

    const parsedNext = feedback as NextQuestionResult | null;
    const nextIndex = session.current_index + 1;
    const nextQuestion = normalizeQuestion(
      parsedNext?.next_question || {
        question_id: `q${nextIndex}`,
        question: `请继续回答一个和${session.target_job}相关的项目或情景问题。`,
        question_type: "behavior"
      },
      session.target_job
    );

    db.prepare(
      `UPDATE interview_sessions
       SET current_index = ?, current_question_id = ?, current_question = ?,
           current_question_type = ?, updated_at = ?
       WHERE id = ?`
    ).run(
      nextIndex,
      nextQuestion.questionId,
      nextQuestion.question,
      nextQuestion.questionType,
      timestamp,
      session.id
    );

    console.info("[interview.answer] response next_question");
    return ok(res, {
      status: "next_question",
      currentIndex: nextIndex,
      total: session.total_questions,
      question: nextQuestion
    });
  } catch (error) {
    console.error("[interview.answer] failed", error);
    return next(error);
  }
});
