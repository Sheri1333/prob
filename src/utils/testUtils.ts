import type { AnswerValue, Question, TestAttempt } from "../types/test";

export function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function arraysEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const sortedA = [...a].sort();
  const sortedB = [...b].sort();
  return sortedA.every((val, i) => val === sortedB[i]);
}

function recordsEqual(
  a: Record<string, string>,
  b: Record<string, string>,
): boolean {
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  return keysA.every((key) => a[key] === b[key]);
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
      return (
        Array.isArray(answer) &&
        arraysEqual(answer, question.correctAnswers)
      );
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
  answers: Record<number, AnswerValue>,
): { score: number; maxScore: number; results: Record<number, boolean> } {
  const results: Record<number, boolean> = {};
  let score = 0;

  for (const question of questions) {
    const correct = isQuestionCorrect(question, answers[question.id]);
    results[question.id] = correct;
    if (correct) score += 1;
  }

  return { score, maxScore: questions.length, results };
}

const STORAGE_KEY = "prob_attempts";

export function saveAttempt(attempt: TestAttempt): void {
  const existing = loadAttempts();
  existing.unshift(attempt);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(existing.slice(0, 50)));
}

export function loadAttempts(): TestAttempt[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as TestAttempt[]) : [];
  } catch {
    return [];
  }
}

export function getAttemptsForTest(testId: string): TestAttempt[] {
  return loadAttempts().filter((a) => a.testId === testId);
}

export function entScoreToGrade(score: number, maxScore: number): number {
  return Math.round((score / maxScore) * 140);
}
