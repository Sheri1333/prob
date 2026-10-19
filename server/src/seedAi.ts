/**
 * Insert the original AI variants. Re-running updates the same rows.
 * Run: npx tsx src/seedAi.ts  (from server/)
 */
import { connectDb, closeDb, tests, type TestDoc } from "./db.js";
import { newTestId } from "./ids.js";
import { assertAnswerKeys } from "./scoring.js";
import { AI_VARIANTS } from "./aiVariants.js";

async function main() {
  for (const spec of AI_VARIANTS) {
    assertAnswerKeys(spec.questions);
    if (spec.questions.length < 20) {
      throw new Error(`${spec.titleKz}: нужно минимум 20 вопросов`);
    }
  }

  await connectDb();
  for (const spec of AI_VARIANTS) {
    const existing = await tests().findOne({ titleKz: spec.titleKz, origin: "ai" });
    const now = new Date();
    const id = existing?._id ?? newTestId();
    const doc: TestDoc = {
      _id: id,
      title: spec.titleKz,
      titleKz: spec.titleKz,
      section: spec.subject,
      examType: "ENT",
      subject: spec.subject,
      durationMinutes: spec.durationMinutes,
      questionCount: spec.questions.length,
      isFree: true,
      priceTenge: null,
      description: spec.description,
      coverImage: "",
      origin: "ai",
      questions: spec.questions,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    await tests().replaceOne({ _id: id }, doc, { upsert: true });
    console.log(`✓ ${spec.subject}: ${spec.questions.length} Q → ${id}`);
  }
  await closeDb();
}

main().catch(async (err) => {
  console.error(err);
  await closeDb().catch(() => undefined);
  process.exit(1);
});
