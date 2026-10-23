import type { EntBlockKind } from "./ent.js";
import { scoreEntSection, type AnswerValue, type Question, type QuestionType } from "./scoring.js";
import { questionWeight } from "./ent.js";

/** One right/total pair, e.g. "single-choice questions: 14 of 20". */
export interface Tally {
  total: number;
  correct: number;
}

/** Per-question breakdown of one finished ҰБТ section for the cabinet. */
export interface SectionAnalytics {
  questions: number;
  answered: number;
  correct: number;
  /** 2-point tasks with one slip: 1 point instead of 2. */
  partial: number;
  wrong: number;
  unanswered: number;
  byType: Record<QuestionType, Tally>;
  /** Profile subjects only: Q1–30 are worth 1 point, Q31+ are worth 2. */
  byWeight: { one: Tally; two: Tally } | null;
}

function hasAnswer(value: AnswerValue | undefined): boolean {
  if (value === undefined || value === null) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return Object.values(value).some((v) => typeof v === "string" && v.trim().length > 0);
}

function emptyTally(): Tally {
  return { total: 0, correct: 0 };
}

/**
 * Re-scores stored answers against the test's answer key. Needs the full
 * test (with keys); the session copy has them stripped.
 */
export function analyzeSection(
  block: EntBlockKind,
  questions: Question[],
  answers: Record<string, AnswerValue>,
): SectionAnalytics {
  const { results, points } = scoreEntSection(block, questions, answers);
  const byType: Record<QuestionType, Tally> = {
    single_choice: emptyTally(),
    multiple_choice: emptyTally(),
    matching: emptyTally(),
  };
  const byWeight = block === "profile" ? { one: emptyTally(), two: emptyTally() } : null;
  const out: SectionAnalytics = {
    questions: questions.length,
    answered: 0,
    correct: 0,
    partial: 0,
    wrong: 0,
    unanswered: 0,
    byType,
    byWeight,
  };

  questions.forEach((q, index) => {
    const answer = answers[String(q.id)];
    const answered = hasAnswer(answer);
    const correct = results[q.id] === true;
    const tally = byType[q.type] ?? byType.single_choice;
    tally.total += 1;
    if (correct) tally.correct += 1;
    if (byWeight) {
      const bucket = questionWeight(block, index) === 2 ? byWeight.two : byWeight.one;
      bucket.total += 1;
      if (correct) bucket.correct += 1;
    }

    if (!answered) {
      out.unanswered += 1;
      return;
    }
    out.answered += 1;
    if (correct) out.correct += 1;
    else if ((points[q.id] ?? 0) > 0) out.partial += 1;
    else out.wrong += 1;
  });

  return out;
}
