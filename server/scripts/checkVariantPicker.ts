/**
 * Checks for src/variantPicker.ts. Run: npx tsx scripts/checkVariantPicker.ts
 */
import assert from "node:assert/strict";
import { emptyHistory, markSeen, pickFreshVariant, questionKey } from "../src/variantPicker.js";

const q = (text: string, options = ["1", "2", "3", "4"], context?: string) => ({
  text,
  context,
  options: options.map((label) => ({ label })),
});
const variant = (id: string, texts: string[]) => ({ _id: id, questions: texts.map((t) => q(t)) });

const A = variant("a", ["Қазақ хандығы қай жылы құрылды?", "Абылай хан кім?", "Тәуке хан заңы"]);
const B = variant("b", ["Алаш партиясы", "Жетісу", "Отырар"]);
const C = variant("c", ["Сарайшық", "Түркістан", "Тараз"]);
const always = () => 0;

// 1. A fresh variant is preferred over a seen id.
{
  const h = emptyHistory();
  markSeen(h, "a", A.questions, 1000);
  const r = pickFreshVariant([A, B], h, new Set(), always)!;
  assert.equal(r.test._id, "b");
  assert.equal(r.seenShare, 0);
}

// 2. An admin copy (new id, same questions) counts as seen.
{
  const copy = { ...A, _id: "a-copy" };
  const h = emptyHistory();
  markSeen(h, "a", A.questions, 1000);
  assert.equal(pickFreshVariant([copy, B], h, new Set(), always)!.test._id, "b");
}

// 3. Spacing, case, punctuation and option order do not make a question new.
{
  const k1 = questionKey(q("Қазақ хандығы қай жылы құрылды?", ["1456", "1465", "1511"]));
  const k2 = questionKey(q("  қазақ  хандығы қай жылы құрылды ", ["1511", "1465", "1456"]));
  assert.equal(k1, k2);
}

// 4. Same wording over a different passage is a different question.
{
  const k1 = questionKey(q("Мәтінге сәйкес негізгі ой?", ["a", "b"], "Арал теңізі туралы"));
  const k2 = questionKey(q("Мәтінге сәйкес негізгі ой?", ["a", "b"], "Байқоңыр туралы"));
  assert.notEqual(k1, k2);
}

// 5. A partly edited copy loses to an untouched variant, beats a full repeat.
{
  const edited = variant("a2", ["Қазақ хандығы қай жылы құрылды?", "Жаңа сұрақ 1", "Жаңа сұрақ 2"]);
  const h = emptyHistory();
  markSeen(h, "a", A.questions, 1000);
  markSeen(h, "b", B.questions, 2000);
  assert.equal(pickFreshVariant([edited, C, A], h, new Set(), always)!.test._id, "c");
  const r = pickFreshVariant([edited, A], h, new Set(), always)!;
  assert.equal(r.test._id, "a2");
  assert.ok(r.seenShare > 0 && r.seenShare < 1);
}

// 6. All seen: the one seen longest ago comes back, not yesterday's.
{
  const h = emptyHistory();
  markSeen(h, "a", A.questions, 3000);
  markSeen(h, "b", B.questions, 1000);
  markSeen(h, "c", C.questions, 2000);
  for (const roll of [0, 0.5, 0.99]) {
    assert.equal(pickFreshVariant([A, B, C], h, new Set(), () => roll)!.test._id, "b");
  }
}

// 7. Within one session the same variant is never given twice.
{
  const r = pickFreshVariant([A, B], emptyHistory(), new Set(["a"]), always)!;
  assert.equal(r.test._id, "b");
  assert.equal(pickFreshVariant([A], emptyHistory(), new Set(["a"])), null);
}

// 8. Picture-only questions (maths PDF) are told apart by their images.
{
  const p1 = { text: "", images: ["/uploads/1.webp"] };
  const p2 = { text: "", images: ["/uploads/2.webp"] };
  assert.notEqual(questionKey(p1), questionKey(p2));
  assert.equal(questionKey({ text: "" }), null);
}

console.log("variantPicker: all 8 checks passed");
