import type { AnswerValue, Question } from "../types/test";

export interface ExamSectionMeta {
  block: "history" | "reading" | "math_literacy" | "profile";
  testId: string;
  subject: string;
  title: string;
  titleKz: string;
  questionCount: number;
  questions: Question[];
}

export interface ExamSectionResult {
  attemptId: string;
  testId: string;
  subject: string;
  title: string;
  titleKz: string;
  score: number;
  maxScore: number;
  results: Record<number, boolean>;
  points?: Record<number, number>;
  answerLabels: Record<number, string>;
  questionIds: number[];
  questionCount: number;
}

export interface ExamSubmitResponse {
  status?: "submitted";
  sessionId: string;
  score: number;
  maxScore: number;
  startedAt: string;
  finishedAt: string;
  sections: ExamSectionResult[];
}

export interface ExamStartResponse {
  status?: "in_progress" | "submitted";
  sessionId: string;
  durationMinutes: number;
  startedAt: string;
  endsAt: number;
  remainingSeconds?: number;
  comboId?: string | null;
  profileSubjects?: string[];
  sectionIndex?: number;
  answersByTest?: Record<string, Record<string, AnswerValue>>;
  currentIndexByTest?: Record<string, number>;
  sections: ExamSectionMeta[];
  usedTestIds?: string[];
}

export type ExamSessionResponse = ExamStartResponse | ExamSubmitResponse;

export function isSubmittedExam(
  data: ExamSessionResponse,
): data is ExamSubmitResponse {
  return data.status === "submitted" || "finishedAt" in data;
}

export function draftFromSession(session: ExamStartResponse): ExamDraft {
  return {
    sessionId: session.sessionId,
    startedAt: session.startedAt,
    endsAt: session.endsAt,
    sectionIndex: session.sectionIndex ?? 0,
    answersByTest: Object.fromEntries(
      session.sections.map((s) => [
        s.testId,
        answersToNumberKeys(session.answersByTest?.[s.testId] ?? {}),
      ]),
    ),
    currentIndexByTest: Object.fromEntries(
      session.sections.map((s) => [
        s.testId,
        session.currentIndexByTest?.[s.testId] ?? 0,
      ]),
    ),
    sections: session.sections,
    usedTestIds: session.usedTestIds ?? session.sections.map((s) => s.testId),
  };
}

function answersToNumberKeys(
  answers: Record<string, AnswerValue>,
): Record<number, AnswerValue> {
  const out: Record<number, AnswerValue> = {};
  for (const [key, value] of Object.entries(answers)) {
    const id = Number(key);
    if (Number.isFinite(id)) out[id] = value;
  }
  return out;
}

export function answersToStringKeys(
  answers: Record<number, AnswerValue>,
): Record<string, AnswerValue> {
  const out: Record<string, AnswerValue> = {};
  for (const [key, value] of Object.entries(answers)) out[key] = value;
  return out;
}

export interface ExamDraft {
  sessionId: string;
  startedAt: string;
  endsAt: number;
  sectionIndex: number;
  /** answers keyed by testId → questionId → value */
  answersByTest: Record<string, Record<number, AnswerValue>>;
  currentIndexByTest: Record<string, number>;
  sections: ExamSectionMeta[];
  /** test ids used so they aren't repeated next time */
  usedTestIds: string[];
}

const DRAFT_KEY = "prob_exam_draft";
const USED_KEY = "prob_used_variants";

export function loadUsedVariants(): string[] {
  try {
    const raw = localStorage.getItem(USED_KEY);
    if (!raw) return [];
    const data = JSON.parse(raw) as string[];
    return Array.isArray(data) ? data.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export function rememberUsedVariants(testIds: string[]): void {
  try {
    const prev = new Set(loadUsedVariants());
    for (const id of testIds) prev.add(id);
    localStorage.setItem(USED_KEY, JSON.stringify([...prev]));
  } catch {
    /* ignore */
  }
}

export function loadExamDraft(): ExamDraft | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as ExamDraft;
    if (!data.sessionId || !Array.isArray(data.sections)) return null;
    return data;
  } catch {
    return null;
  }
}

export function saveExamDraft(draft: ExamDraft): void {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch {
    /* ignore */
  }
}

export function clearExamDraft(): void {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch {
    /* ignore */
  }
}
