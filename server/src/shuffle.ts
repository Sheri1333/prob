import { randomInt } from "node:crypto";
import type { AnswerValue, Question, TestOption } from "./scoring.js";

/** questionId → (letter shown in this session → original option id). */
export type OptionMaps = Record<string, Record<string, string>>;

function shuffled<T>(items: T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Options whose text is only in the question image (label empty or just the
 * letter) must keep their order, otherwise the picture and letters disagree.
 */
function canShuffle(options: TestOption[]): boolean {
  if (options.length < 2) return false;
  return options.every((o) => {
    const label = (o.label ?? "").trim();
    return label.length > 0 && label.toLowerCase() !== o.id.toLowerCase();
  });
}

/**
 * Shuffle options per exam session and re-letter them, so an answer key
 * leaked from another attempt ("3 — B") is useless here. Questions must
 * already be stripped of correct answers.
 */
export function shuffleQuestionsForSession(questions: Question[]): {
  questions: Question[];
  optionMaps: OptionMaps;
} {
  const optionMaps: OptionMaps = {};
  const out = questions.map((q) => {
    if (!canShuffle(q.options)) return q;
    const letters = q.options.map((o) => o.id);
    const order = shuffled(q.options);
    const map: Record<string, string> = {};
    const options = order.map((o, i) => {
      map[letters[i]] = o.id;
      return { ...o, id: letters[i] };
    });
    optionMaps[String(q.id)] = map;
    return { ...q, options } as Question;
  });
  return { questions: out, optionMaps };
}

function mapValue(
  value: AnswerValue,
  map: Record<string, string>,
): AnswerValue {
  const one = (id: string) => map[id] ?? id;
  if (typeof value === "string") return one(value);
  if (Array.isArray(value)) return value.map((v) => one(String(v)));
  // Matching rows may hold several options: "A,C".
  const out: Record<string, string> = {};
  for (const [row, ids] of Object.entries(value)) {
    out[row] = String(ids)
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean)
      .map(one)
      .sort()
      .join(",");
  }
  return out;
}

function invert(map: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(map).map(([k, v]) => [v, k]));
}

/** Session letters → original option ids (for scoring and storage). */
export function toOriginalAnswers(
  answers: Record<string, AnswerValue>,
  maps: OptionMaps | undefined,
): Record<string, AnswerValue> {
  if (!maps) return answers;
  const out: Record<string, AnswerValue> = {};
  for (const [qid, value] of Object.entries(answers)) {
    const map = maps[qid];
    out[qid] = map ? mapValue(value, map) : value;
  }
  return out;
}

/** Original option ids → letters the student actually saw. */
export function toSessionAnswers(
  answers: Record<string, AnswerValue>,
  maps: OptionMaps | undefined,
): Record<string, AnswerValue> {
  if (!maps) return answers;
  const out: Record<string, AnswerValue> = {};
  for (const [qid, value] of Object.entries(answers)) {
    const map = maps[qid];
    out[qid] = map ? mapValue(value, invert(map)) : value;
  }
  return out;
}
