import { request } from "./http";

export type InterviewQuestion = {
  questionId: string;
  question: string;
  questionType: string;
};

export type InterviewStartResponse = {
  interviewSessionId: string;
  targetJob: string;
  currentIndex: number;
  total: number;
  secondsPerQuestion: number;
  question: InterviewQuestion;
};

export type InterviewAnswerResponse =
  | {
      status: "next_question";
      currentIndex: number;
      total: number;
      question: InterviewQuestion;
    }
  | {
      status: "finished";
      finalReport: string;
    };

export const interviewApi = {
  start(payload: {
    conversationId: string;
    interviewSessionId?: string;
    targetJob: string;
    questionCount: number;
    question?: {
      question_id?: string;
      questionId?: string;
      question?: string;
      question_type?: string;
      questionType?: string;
    };
  }) {
    return request<InterviewStartResponse>("/api/interview/start", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },

  answer(payload: {
    interviewSessionId: string;
    questionId: string;
    durationSeconds: number;
    audio: Blob;
  }) {
    const form = new FormData();
    form.append("interviewSessionId", payload.interviewSessionId);
    form.append("questionId", payload.questionId);
    form.append("durationSeconds", String(payload.durationSeconds));
    form.append("audio", payload.audio, "answer.wav");
    return request<InterviewAnswerResponse>("/api/interview/answer", {
      method: "POST",
      body: form
    });
  }
};
