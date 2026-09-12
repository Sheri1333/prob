import type { Question } from "./scoring.js";

export interface ParsedAnswerKey {
  questionId: number;
  letters: string[];
  pairs?: Record<string, string>;
}

const LETTER = "[A-Ha-h]";

function uniqLetters(raw: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const ch of raw.toUpperCase()) {
    if (!/[A-H]/.test(ch)) continue;
    if (seen.has(ch)) continue;
    seen.add(ch);
    out.push(ch);
  }
  return out;
}

function parseJsonKeys(value: unknown): ParsedAnswerKey[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  const out: ParsedAnswerKey[] = [];
  for (const [rawId, rawVal] of Object.entries(value as Record<string, unknown>)) {
    const questionId = Number(rawId);
    if (!Number.isFinite(questionId)) continue;
    if (typeof rawVal === "string") {
      const pairs = parsePairMap(rawVal);
      out.push({
        questionId,
        letters: uniqLetters(rawVal),
        pairs: Object.keys(pairs).length ? pairs : undefined,
      });
      continue;
    }
    if (Array.isArray(rawVal)) {
      out.push({
        questionId,
        letters: uniqLetters(rawVal.map(String).join("")),
      });
      continue;
    }
    if (rawVal && typeof rawVal === "object") {
      const pairs: Record<string, string> = {};
      for (const [rowId, opt] of Object.entries(rawVal as Record<string, unknown>)) {
        const letter = uniqLetters(String(opt))[0];
        if (letter) pairs[String(rowId)] = letter;
      }
      out.push({
        questionId,
        letters: Object.values(pairs),
        pairs,
      });
    }
  }
  return out;
}

function parsePairMap(text: string): Record<string, string> {
  const pairs: Record<string, string> = {};
  const re = /(\d+)\s*[-:.)]?\s*([A-Ha-h])/g;
  for (const match of text.matchAll(re)) {
    pairs[match[1]] = match[2].toUpperCase();
  }
  return pairs;
}

export function parseAnswerKeyText(text: string): ParsedAnswerKey[] {
  const trimmed = text.trim();
  if (!trimmed) return [];

  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      const fromJson = parseJsonKeys(
        Array.isArray(parsed) ? Object.fromEntries(
          parsed.map((row, i) => [String(i + 1), row]),
        ) : parsed,
      );
      if (fromJson.length > 0) return fromJson;
    } catch {
      /* fall through to text parser */
    }
  }

  const byId = new Map<number, ParsedAnswerKey>();
  const upsert = (item: ParsedAnswerKey) => {
    const prev = byId.get(item.questionId);
    if (!prev) {
      byId.set(item.questionId, item);
      return;
    }
    const letters = [...prev.letters];
    for (const letter of item.letters) {
      if (!letters.includes(letter)) letters.push(letter);
    }
    byId.set(item.questionId, {
      questionId: item.questionId,
      letters,
      pairs: { ...(prev.pairs ?? {}), ...(item.pairs ?? {}) },
    });
  };

  const pairLine = new RegExp(
    `(\\d+)\\s*[-:.)]\\s*((?:\\d+\\s*[-:.]?\\s*${LETTER}\\s*,?\\s*){2,})`,
    "gi",
  );
  for (const match of trimmed.matchAll(pairLine)) {
    const questionId = Number(match[1]);
    const pairs = parsePairMap(match[2]);
    upsert({
      questionId,
      letters: Object.values(pairs),
      pairs,
    });
  }

  const simple = new RegExp(`(\\d+)\\s*[-:.)]?\\s*(${LETTER}(?:\\s*,?\\s*${LETTER})*)`, "gi");
  for (const match of trimmed.matchAll(simple)) {
    const questionId = Number(match[1]);
    if (byId.has(questionId) && byId.get(questionId)?.pairs) continue;
    upsert({
      questionId,
      letters: uniqLetters(match[2]),
    });
  }

  return [...byId.values()].sort((a, b) => a.questionId - b.questionId);
}

export function applyAnswerKeys(
  questions: Question[],
  keys: ParsedAnswerKey[],
): {
  questions: Question[];
  applied: number[];
  skipped: number[];
} {
  const byId = new Map(questions.map((q, index) => [q.id, index]));
  const next = questions.map((q) => structuredClone(q));
  const applied: number[] = [];
  const skipped: number[] = [];

  for (const key of keys) {
    const index = byId.get(key.questionId);
    if (index === undefined) {
      skipped.push(key.questionId);
      continue;
    }
    const question = next[index];
    if (question.type === "single_choice") {
      const letter = key.letters[0];
      if (!letter || !question.options.some((o) => o.id === letter)) {
        skipped.push(key.questionId);
        continue;
      }
      question.correctAnswer = letter;
      applied.push(key.questionId);
      continue;
    }
    if (question.type === "multiple_choice") {
      const letters = key.letters.filter((letter) =>
        question.options.some((o) => o.id === letter),
      );
      if (letters.length === 0) {
        skipped.push(key.questionId);
        continue;
      }
      question.correctAnswers = letters;
      applied.push(key.questionId);
      continue;
    }

    const pairs: Record<string, string> = { ...(key.pairs ?? {}) };
    if (Object.keys(pairs).length === 0 && key.letters.length > 0) {
      question.rows.forEach((row, rowIndex) => {
        const letter = key.letters[rowIndex];
        if (letter) pairs[row.id] = letter;
      });
    }
    const valid: Record<string, string> = {};
    for (const [rowId, optionId] of Object.entries(pairs)) {
      if (
        question.rows.some((row) => row.id === rowId) &&
        question.options.some((o) => o.id === optionId)
      ) {
        valid[rowId] = optionId;
      }
    }
    if (Object.keys(valid).length === 0) {
      skipped.push(key.questionId);
      continue;
    }
    question.correctAnswers = { ...question.correctAnswers, ...valid };
    applied.push(key.questionId);
  }

  return { questions: next, applied, skipped };
}
