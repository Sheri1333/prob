/**
 * Checks for src/analytics.ts. Run: npx tsx scripts/checkAnalytics.ts
 */
import assert from "node:assert/strict";
import { analyzeSection } from "../src/analytics.js";
import type { Question } from "../src/scoring.js";

const single = (id: number, correct: string): Question => ({
  id,
  type: "single_choice",
  text: `Q${id}`,
  options: ["A", "B", "C", "D"].map((x) => ({ id: x, label: x })),
  correctAnswer: correct,
});

// Profile subject: 40 questions, Q1–30 worth 1, Q31–40 worth 2.
const questions = Array.from({ length: 40 }, (_, i) => single(i + 1, "A"));
const answers: Record<string, string> = {};
for (let id = 1; id <= 40; id++) {
  if (id <= 20) answers[id] = "A"; // 20 right (1-point)
  else if (id <= 25) answers[id] = "B"; // 5 wrong (1-point)
  else if (id <= 30) continue; // 5 skipped (1-point)
  else if (id <= 36) answers[id] = "A"; // 6 right (2-point)
  else answers[id] = "C"; // 4 wrong (2-point)
}

const a = analyzeSection("profile", questions, answers);
assert.equal(a.questions, 40);
assert.equal(a.correct, 26);
assert.equal(a.wrong, 9);
assert.equal(a.unanswered, 5);
assert.equal(a.answered, 35);
assert.equal(a.partial, 0);
assert.deepEqual(a.byWeight, { one: { total: 30, correct: 20 }, two: { total: 10, correct: 6 } });
assert.deepEqual(a.byType.single_choice, { total: 40, correct: 26 });

// Mandatory block: no 1/2-point split.
const h = analyzeSection("history", questions.slice(0, 20), answers);
assert.equal(h.byWeight, null);
assert.equal(h.correct, 20);

console.log("analytics: all checks passed");
