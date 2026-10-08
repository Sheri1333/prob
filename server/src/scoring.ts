import { newTestId } from "./ids.js";
import {
  blockMaxScore,
  questionWeight,
  type EntBlockKind,
} from "./ent.js";

export type QuestionType = "single_choice" | "multiple_choice" | "matching";

export interface TestOption {
  id: string;
  label: string;
}

export interface MatchingRow {
  id: string;
  label: string;
  image?: string;
}

export interface BaseQuestion {
  id: number;
  type: QuestionType;
  text: string;
  images?: string[];
  /** Reading passage shown above the question (ENT context tasks). */
  context?: string;
}

export interface SingleChoiceQuestion extends BaseQuestion {
  type: "single_choice";
  options: TestOption[];
  correctAnswer: string;
}

export interface MultipleChoiceQuestion extends BaseQuestion {
  type: "multiple_choice";
  options: TestOption[];
  correctAnswers: string[];
}

export interface MatchingQuestion extends BaseQuestion {
  type: "matching";
  rows: MatchingRow[];
  options: TestOption[];
  correctAnswers: Record<string, string>;
}

export type Question =
  | SingleChoiceQuestion
  | MultipleChoiceQuestion
  | MatchingQuestion;

export type AnswerValue = string | string[] | Record<string, string>;

export interface TestPayload {
  id: string;
  title: string;
  titleKz: string;
  section: string;
  examType: "ENT" | "OGE" | string;
  subject: string;
  durationMinutes: number;
  isFree?: boolean;
  priceTenge?: number | null;
  description?: string;
  coverImage?: string;
  questions: Question[];
}

export function stripAnswers(questions: Question[]): Question[] {
  return questions.map((q) => {
    if (q.type === "single_choice") {
      const { correctAnswer: _, ...rest } = q;
      return rest as Question;
    }
    if (q.type === "multiple_choice") {
      const { correctAnswers: _, ...rest } = q;
      return rest as Question;
    }
    const { correctAnswers: _, ...rest } = q;
    return rest as Question;
  });
}

function arraysEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const sa = [...a].sort();
  const sb = [...b].sort();
  return sa.every((v, i) => v === sb[i]);
}

/**
 * A matching row may take several options ("A,C"); compare as sets so the
 * order a student clicked them in does not matter.
 */
export function matchIds(value: unknown): string[] {
  if (typeof value !== "string") return [];
  return [...new Set(value.split(",").map((s) => s.trim()).filter(Boolean))].sort();
}

function sameMatch(a: unknown, b: unknown): boolean {
  const x = matchIds(a);
  const y = matchIds(b);
  return x.length > 0 && x.length === y.length && x.every((v, i) => v === y[i]);
}

function recordsEqual(
  a: Record<string, string>,
  b: Record<string, string>,
): boolean {
  const keys = Object.keys(b);
  return keys.length > 0 && keys.every((k) => sameMatch(a[k], b[k]));
}

export function isQuestionCorrect(
  question: Question,
  answer: AnswerValue | undefined,
): boolean {
  if (answer === undefined) return false;
  switch (question.type) {
    case "single_choice":
      return answer === question.correctAnswer;
    case "multiple_choice":
      return Array.isArray(answer) && arraysEqual(answer, question.correctAnswers);
    case "matching":
      return (
        typeof answer === "object" &&
        !Array.isArray(answer) &&
        recordsEqual(answer, question.correctAnswers)
      );
    default:
      return false;
  }
}

export function scoreTest(
  questions: Question[],
  answers: Record<string, AnswerValue>,
): { score: number; maxScore: number; results: Record<number, boolean> } {
  const results: Record<number, boolean> = {};
  let score = 0;
  for (const q of questions) {
    const key = String(q.id);
    const ans = answers[key] ?? answers[q.id as unknown as string];
    const correct = isQuestionCorrect(q, ans);
    results[q.id] = correct;
    if (correct) score += 1;
  }
  return { score, maxScore: questions.length, results };
}

function answerFor(
  question: Question,
  answers: Record<string, AnswerValue>,
): AnswerValue | undefined {
  return answers[String(question.id)] ?? answers[question.id as unknown as string];
}

/**
 * ҰБТ rule for 2-point tasks: one mistake still earns 1 point.
 * Multiple choice — one missing or one extra option; matching — one wrong row.
 */
function partialPoints(
  question: Question,
  answer: AnswerValue | undefined,
  weight: number,
): number {
  if (weight < 2 || answer === undefined) return 0;
  if (question.type === "multiple_choice") {
    if (!Array.isArray(answer) || answer.length === 0) return 0;
    const picked = new Set(answer);
    const correct = new Set(question.correctAnswers);
    let mistakes = 0;
    for (const id of picked) if (!correct.has(id)) mistakes += 1;
    for (const id of correct) if (!picked.has(id)) mistakes += 1;
    return mistakes === 1 ? 1 : 0;
  }
  if (question.type === "matching") {
    if (typeof answer !== "object" || Array.isArray(answer)) return 0;
    const rowIds = question.rows.map((r) => r.id);
    if (rowIds.length < 2) return 0;
    const wrong = rowIds.filter(
      (id) => !sameMatch(answer[id], question.correctAnswers[id]),
    ).length;
    return wrong === 1 ? 1 : 0;
  }
  return 0;
}

export function scaleToOfficial(
  raw: number,
  rawMax: number,
  officialMax: number,
): number {
  if (rawMax <= 0 || officialMax <= 0) return 0;
  if (rawMax === officialMax) {
    return Math.min(officialMax, Math.max(0, Math.round(raw)));
  }
  return Math.min(
    officialMax,
    Math.max(0, Math.round((raw / rawMax) * officialMax)),
  );
}

export function scoreEntSection(
  block: EntBlockKind,
  questions: Question[],
  answers: Record<string, AnswerValue>,
): {
  score: number;
  maxScore: number;
  results: Record<number, boolean>;
  points: Record<number, number>;
} {
  const officialMax = blockMaxScore(block);
  const results: Record<number, boolean> = {};
  const rawPoints: Record<number, number> = {};
  let raw = 0;
  let rawMax = 0;

  questions.forEach((q, index) => {
    const weight = questionWeight(block, index);
    rawMax += weight;
    const answer = answerFor(q, answers);
    const correct = isQuestionCorrect(q, answer);
    results[q.id] = correct;
    const earned = correct ? weight : partialPoints(q, answer, weight);
    rawPoints[q.id] = earned;
    raw += earned;
  });

  const score = scaleToOfficial(raw, rawMax, officialMax);
  const scale = rawMax > 0 ? officialMax / rawMax : 0;
  const points: Record<number, number> = {};
  for (const q of questions) {
    points[q.id] = Math.round((rawPoints[q.id] ?? 0) * scale);
  }

  return { score, maxScore: officialMax, results, points };
}

export function isAnswerKeyComplete(question: Question): boolean {
  switch (question.type) {
    case "single_choice":
      return (
        Boolean(question.correctAnswer) &&
        question.options.some((o) => o.id === question.correctAnswer)
      );
    case "multiple_choice":
      return (
        Array.isArray(question.correctAnswers) &&
        question.correctAnswers.length > 0 &&
        question.correctAnswers.every((id) =>
          question.options.some((o) => o.id === id),
        )
      );
    case "matching":
      return (
        question.rows.length > 0 &&
        question.rows.every((row) => {
          const ids = matchIds(question.correctAnswers[row.id]);
          return (
            ids.length > 0 &&
            ids.every((id) => question.options.some((o) => o.id === id))
          );
        })
      );
    default:
      return false;
  }
}

export function assertAnswerKeys(questions: Question[]): void {
  const missing = questions.filter((q) => !isAnswerKeyComplete(q)).map((q) => q.id);
  if (missing.length > 0) {
    throw new Error(
      `Отметьте правильные ответы у вопросов: ${missing.join(", ")}`,
    );
  }
}

export function validateTestPayload(body: unknown): TestPayload {
  if (!body || typeof body !== "object") {
    throw new Error("Некорректное тело запроса");
  }
  const b = body as Record<string, unknown>;
  const requestedId = typeof b.id === "string" ? b.id.trim() : "";
  const titleKz =
    typeof b.titleKz === "string" && b.titleKz.trim()
      ? b.titleKz.trim()
      : typeof b.title === "string"
        ? b.title.trim()
        : "";
  if (!titleKz) throw new Error("Название на казахском обязательно");
  if (typeof b.section !== "string") throw new Error("section обязателен");
  if (typeof b.subject !== "string") throw new Error("subject обязателен");
  if (typeof b.durationMinutes !== "number") {
    throw new Error("durationMinutes обязателен");
  }
  if (!Array.isArray(b.questions) || b.questions.length === 0) {
    throw new Error("questions должен быть непустым массивом");
  }
  assertAnswerKeys(b.questions as Question[]);
  return {
    id: requestedId || newTestId(),
    title: titleKz,
    titleKz,
    section: b.section,
    examType: "ENT",
    subject: b.subject,
    durationMinutes: b.durationMinutes,
    isFree: true,
    priceTenge: null,
    description: typeof b.description === "string" ? b.description : "",
    coverImage: typeof b.coverImage === "string" ? b.coverImage : "",
    questions: b.questions as Question[],
  };
}
