import type { AnswerValue } from "../types/test";

export interface TestDraft {
  testId: string;
  answers: Record<number, AnswerValue>;
  currentIndex: number;
  startedAt: string;
  endsAt: number;
}

function key(testId: string): string {
  return `prob_attempt_${testId}`;
}

export function loadTestDraft(testId: string): TestDraft | null {
  try {
    const raw = localStorage.getItem(key(testId));
    if (!raw) return null;
    const data = JSON.parse(raw) as TestDraft;
    if (data.testId !== testId || typeof data.endsAt !== "number") return null;
    return data;
  } catch {
    return null;
  }
}

export function saveTestDraft(draft: TestDraft): void {
  try {
    localStorage.setItem(key(draft.testId), JSON.stringify(draft));
  } catch {
    /* quota / private mode */
  }
}

export function clearTestDraft(testId: string): void {
  try {
    localStorage.removeItem(key(testId));
  } catch {
    /* ignore */
  }
}
