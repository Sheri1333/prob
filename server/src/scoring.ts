export type QuestionType = "single_choice" | "multiple_choice" | "matching";

export interface TestOption {
  id: string;
  label: string;
}

export interface MatchingRow {
  id: string;
  label: string;
}

export interface BaseQuestion {
  id: number;
  type: QuestionType;
  text: string;
  images?: string[];
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

function recordsEqual(
  a: Record<string, string>,
  b: Record<string, string>,
): boolean {
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  return keysA.every((k) => a[k] === b[k]);
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
        question.rows.every((row) =>
          Boolean(question.correctAnswers[row.id]),
        ) &&
        question.rows.every((row) =>
          question.options.some((o) => o.id === question.correctAnswers[row.id]),
        )
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
  if (typeof b.id !== "string" || !b.id.trim()) throw new Error("id обязателен");
  if (typeof b.title !== "string") throw new Error("title обязателен");
  if (typeof b.titleKz !== "string") throw new Error("titleKz обязателен");
  if (typeof b.section !== "string") throw new Error("section обязателен");
  if (typeof b.examType !== "string") throw new Error("examType обязателен");
  if (typeof b.subject !== "string") throw new Error("subject обязателен");
  if (typeof b.durationMinutes !== "number") {
    throw new Error("durationMinutes обязателен");
  }
  if (!Array.isArray(b.questions) || b.questions.length === 0) {
    throw new Error("questions должен быть непустым массивом");
  }
  assertAnswerKeys(b.questions as Question[]);
  return {
    id: b.id.trim(),
    title: b.title,
    titleKz: b.titleKz,
    section: b.section,
    examType: b.examType,
    subject: b.subject,
    durationMinutes: b.durationMinutes,
    isFree: b.isFree !== false,
    priceTenge: typeof b.priceTenge === "number" ? b.priceTenge : null,
    description: typeof b.description === "string" ? b.description : "",
    questions: b.questions as Question[],
  };
}
