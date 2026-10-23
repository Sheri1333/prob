import { createHash } from "node:crypto";
import type { Question } from "./scoring.js";

/**
 * Chooses ҰБТ variants a student has not met before.
 *
 * "Seen" is tracked per question, not per test id: an admin copy, a second
 * upload of the same PDF or a lightly edited variant gets a new id but keeps
 * its questions, and those must still count as already done.
 */

type QuestionLike = Pick<Question, "text"> & {
  images?: string[];
  context?: string;
  options?: Array<{ label: string }>;
  rows?: Array<{ label: string }>;
};

function norm(value: string | undefined): string {
  return (value ?? "")
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[«»"'`.,;:!?()[\]{}–—-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Identity of a question across copies: passage, wording, pictures and the
 * set of answers (order-free, since options are shuffled anyway). Reading
 * tasks share wording like "Мәтінге сәйкес…", so the passage is part of it.
 */
export function questionKey(q: QuestionLike): string | null {
  const options = (q.options ?? []).map((o) => norm(o.label)).sort();
  const rows = (q.rows ?? []).map((r) => norm(r.label)).sort();
  const parts = [
    norm(q.context),
    norm(q.text),
    ...(q.images ?? []).map(String),
    "|",
    ...options,
    "|",
    ...rows,
  ];
  if (parts.every((p) => !p || p === "|")) return null;
  return createHash("sha1").update(parts.join("\u0001")).digest("base64url");
}

export interface SeenHistory {
  /** Test ids the student was given, with when (ms). */
  testSeenAt: Map<string, number>;
  /** Question keys the student was shown, with when (ms). */
  questionSeenAt: Map<string, number>;
}

export function emptyHistory(): SeenHistory {
  return { testSeenAt: new Map(), questionSeenAt: new Map() };
}

function later(map: Map<string, number>, key: string, at: number): void {
  const prev = map.get(key);
  if (prev === undefined || at > prev) map.set(key, at);
}

/** Record that a variant was shown; questions may come from the session copy. */
export function markSeen(
  history: SeenHistory,
  testId: string,
  questions: QuestionLike[] | undefined,
  at: number,
): void {
  later(history.testSeenAt, testId, at);
  for (const q of questions ?? []) {
    const key = questionKey(q);
    if (key) later(history.questionSeenAt, key, at);
  }
}

interface Candidate {
  _id: string;
  questions: QuestionLike[];
}

/** Variants in the pool the student has not seen a single question of. */
export function countFresh(pool: Candidate[], history: SeenHistory): number {
  let fresh = 0;
  for (const test of pool) {
    if (history.testSeenAt.has(test._id)) continue;
    const seenAny = test.questions.some((q) => {
      const key = questionKey(q);
      return key !== null && history.questionSeenAt.has(key);
    });
    if (!seenAny) fresh += 1;
  }
  return fresh;
}

export interface PickResult<T> {
  test: T;
  /** Share of its questions the student has already seen, 0…1. */
  seenShare: number;
}

/**
 * Least-seen variant first; among equally seen ones, the one seen longest
 * ago; then random. Variants already taken in this session are skipped.
 */
export function pickFreshVariant<T extends Candidate>(
  pool: T[],
  history: SeenHistory,
  takenNow: Set<string>,
  random: () => number = Math.random,
): PickResult<T> | null {
  const candidates = pool.filter((t) => !takenNow.has(t._id));
  if (candidates.length === 0) return null;

  const scored = candidates.map((test) => {
    const keys = test.questions
      .map((q) => questionKey(q))
      .filter((k): k is string => k !== null);
    let seen = 0;
    let lastSeen = history.testSeenAt.get(test._id) ?? -Infinity;
    for (const key of keys) {
      const at = history.questionSeenAt.get(key);
      if (at === undefined) continue;
      seen += 1;
      if (at > lastSeen) lastSeen = at;
    }
    const byQuestions = keys.length > 0 ? seen / keys.length : 0;
    // The same id always counts as fully seen, even if it was edited since.
    const seenShare = history.testSeenAt.has(test._id) ? 1 : byQuestions;
    return { test, seenShare, lastSeen };
  });

  const EPS = 1e-9;
  const minShare = Math.min(...scored.map((s) => s.seenShare));
  let best = scored.filter((s) => s.seenShare <= minShare + EPS);
  if (minShare > EPS) {
    const oldest = Math.min(...best.map((s) => s.lastSeen));
    best = best.filter((s) => s.lastSeen <= oldest);
  }
  const chosen = best[Math.floor(random() * best.length)] ?? best[0];
  return { test: chosen.test, seenShare: chosen.seenShare };
}
