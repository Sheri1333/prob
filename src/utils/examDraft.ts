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

export interface ExamStartResponse {
  sessionId: string;
  durationMinutes: number;
  startedAt: string;
  endsAt: number;
  sections: ExamSectionMeta[];
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
  answerLabels: Record<number, string>;
  questionIds: number[];
  questionCount: number;
}

export interface ExamSubmitResponse {
  sessionId: string;
  score: number;
  maxScore: number;
  startedAt: string;
  finishedAt: string;
  sections: ExamSectionResult[];
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
