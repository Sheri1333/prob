import type { Question, QuestionType } from "../types/test";

export function isAnswerKeyComplete(question: Question): boolean {
  switch (question.type) {
    case "single_choice":
      return Boolean(
        question.correctAnswer &&
          question.options.some((o) => o.id === question.correctAnswer),
      );
    case "multiple_choice":
      return Boolean(
        question.correctAnswers &&
          question.correctAnswers.length > 0 &&
          question.correctAnswers.every((id) =>
            question.options.some((o) => o.id === id),
          ),
      );
    case "matching":
      return Boolean(
        question.rows?.length &&
          question.correctAnswers &&
          question.rows.every(
            (row) =>
              question.correctAnswers?.[row.id] &&
              question.options.some(
                (o) => o.id === question.correctAnswers?.[row.id],
              ),
          ),
      );
    default:
      return false;
  }
}

export function keyedCount(questions: Question[]): number {
  return questions.filter(isAnswerKeyComplete).length;
}

export function nextQuestionId(questions: Question[]): number {
  return questions.reduce((max, q) => Math.max(max, q.id), 0) + 1;
}

export function createBlankQuestion(
  id: number,
  type: QuestionType = "single_choice",
): Question {
  const options = [
    { id: "A", label: "" },
    { id: "B", label: "" },
    { id: "C", label: "" },
    { id: "D", label: "" },
  ];
  if (type === "matching") {
    return {
      id,
      type,
      text: "",
      rows: [
        { id: "1", label: "" },
        { id: "2", label: "" },
      ],
      options,
      correctAnswers: {},
    };
  }
  if (type === "multiple_choice") {
    return { id, type, text: "", options, correctAnswers: [] };
  }
  return { id, type: "single_choice", text: "", options, correctAnswer: "" };
}

export function convertQuestionType(
  question: Question,
  type: QuestionType,
): Question {
  const base = {
    id: question.id,
    text: question.text,
    images: question.images,
    options: question.options.length
      ? question.options
      : [
          { id: "A", label: "" },
          { id: "B", label: "" },
          { id: "C", label: "" },
          { id: "D", label: "" },
        ],
  };

  if (type === "single_choice") {
    return {
      ...base,
      type,
      correctAnswer:
        question.type === "single_choice" ? question.correctAnswer ?? "" : "",
    };
  }

  if (type === "multiple_choice") {
    return {
      ...base,
      type,
      correctAnswers:
        question.type === "multiple_choice" ? question.correctAnswers ?? [] : [],
    };
  }

  return {
    ...base,
    type: "matching",
    rows:
      question.type === "matching" && question.rows.length
        ? question.rows
        : [
            { id: "1", label: "" },
            { id: "2", label: "" },
          ],
    correctAnswers:
      question.type === "matching" ? question.correctAnswers ?? {} : {},
  };
}

export interface ParsedAnswerKey {
  questionId: number;
  letters: string[];
  pairs?: Record<string, string>;
}

function uniqLetters(raw: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const ch of raw.toUpperCase()) {
    if (!/[A-H]/.test(ch) || seen.has(ch)) continue;
    seen.add(ch);
    out.push(ch);
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
  if (trimmed.startsWith("{")) {
    try {
      const parsed = JSON.parse(trimmed) as Record<string, unknown>;
      return Object.entries(parsed).flatMap(([id, value]) => {
        const questionId = Number(id);
        if (!Number.isFinite(questionId)) return [];
        if (typeof value === "string") {
          const pairs = parsePairMap(value);
          return [{
            questionId,
            letters: uniqLetters(value),
            pairs: Object.keys(pairs).length ? pairs : undefined,
          }];
        }
        if (Array.isArray(value)) {
          return [{ questionId, letters: uniqLetters(value.map(String).join("")) }];
        }
        if (value && typeof value === "object") {
          const pairs: Record<string, string> = {};
          for (const [rowId, opt] of Object.entries(value as Record<string, unknown>)) {
            const letter = uniqLetters(String(opt))[0];
            if (letter) pairs[String(rowId)] = letter;
          }
          return [{ questionId, letters: Object.values(pairs), pairs }];
        }
        return [];
      });
    } catch {
      /* text format */
    }
  }

  const byId = new Map<number, ParsedAnswerKey>();
  const upsert = (item: ParsedAnswerKey) => {
    const prev = byId.get(item.questionId);
    if (!prev) {
      byId.set(item.questionId, item);
      return;
    }
    byId.set(item.questionId, {
      questionId: item.questionId,
      letters: [...new Set([...prev.letters, ...item.letters])],
      pairs: { ...(prev.pairs ?? {}), ...(item.pairs ?? {}) },
    });
  };

  const pairLine =
    /(\d+)\s*[-:.)]\s*((?:\d+\s*[-:.]?\s*[A-Ha-h]\s*,?\s*){2,})/gi;
  for (const match of trimmed.matchAll(pairLine)) {
    const pairs = parsePairMap(match[2]);
    upsert({
      questionId: Number(match[1]),
      letters: Object.values(pairs),
      pairs,
    });
  }
  const simple = /(\d+)\s*[-:.)]?\s*([A-Ha-h](?:\s*,?\s*[A-Ha-h])*)/gi;
  for (const match of trimmed.matchAll(simple)) {
    const questionId = Number(match[1]);
    if (byId.get(questionId)?.pairs) continue;
    upsert({ questionId, letters: uniqLetters(match[2]) });
  }
  return [...byId.values()].sort((a, b) => a.questionId - b.questionId);
}

export function applyAnswerKeys(
  questions: Question[],
  text: string,
): { questions: Question[]; applied: number; skipped: number[] } {
  const keys = parseAnswerKeyText(text);
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
    } else if (question.type === "multiple_choice") {
      const letters = key.letters.filter((letter) =>
        question.options.some((o) => o.id === letter),
      );
      if (!letters.length) {
        skipped.push(key.questionId);
        continue;
      }
      question.correctAnswers = letters;
      applied.push(key.questionId);
    } else {
      const pairs: Record<string, string> = { ...(key.pairs ?? {}) };
      if (!Object.keys(pairs).length) {
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
      if (!Object.keys(valid).length) {
        skipped.push(key.questionId);
        continue;
      }
      question.correctAnswers = { ...question.correctAnswers, ...valid };
      applied.push(key.questionId);
    }
  }

  return { questions: next, applied: applied.length, skipped };
}
