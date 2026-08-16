import bcrypt from "bcryptjs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { closeDb, connectDb, tests, users } from "./db.js";
import { entGeographyTest } from "../../src/data/tests/ent-geography.ts";
import { catalog } from "../../src/data/catalog.ts";
import type { Question } from "./scoring.js";

async function upsertTest(params: {
  id: string;
  title: string;
  titleKz: string;
  section: string;
  examType: string;
  subject: string;
  durationMinutes: number;
  isFree: boolean;
  priceTenge?: number;
  description: string;
  questions: Question[];
}) {
  const now = new Date();
  await tests().updateOne(
    { _id: params.id },
    {
      $set: {
        title: params.title,
        titleKz: params.titleKz,
        section: params.section,
        examType: params.examType,
        subject: params.subject,
        durationMinutes: params.durationMinutes,
        questionCount: params.questions.length,
        isFree: params.isFree,
        priceTenge: params.priceTenge ?? null,
        description: params.description,
        questions: params.questions,
        updatedAt: now,
      },
      $setOnInsert: { createdAt: now },
    },
    { upsert: true },
  );
}

const adminEmail = "admin@prob.kz";
const adminPass = "admin123";
const demoEmail = "demo@prob.kz";
const demoPass = "demo123";

/** Safe to run on every boot: creates demo users/tests only if missing. */
export async function seedDatabase(): Promise<void> {
  const adminExists = await users().findOne({ email: adminEmail });
  if (!adminExists) {
    await users().insertOne({
      email: adminEmail,
      passwordHash: bcrypt.hashSync(adminPass, 10),
      name: "Администратор",
      role: "admin",
      createdAt: new Date(),
    });
    console.log(`Admin: ${adminEmail} / ${adminPass}`);
  }

  const demoExists = await users().findOne({ email: demoEmail });
  if (!demoExists) {
    await users().insertOne({
      email: demoEmail,
      passwordHash: bcrypt.hashSync(demoPass, 10),
      name: "Демо пользователь",
      role: "user",
      createdAt: new Date(),
    });
    console.log(`Demo user: ${demoEmail} / ${demoPass}`);
  }

  await upsertTest({
    id: entGeographyTest.id,
    title: entGeographyTest.title,
    titleKz: entGeographyTest.titleKz,
    section: entGeographyTest.section,
    examType: entGeographyTest.examType,
    subject: entGeographyTest.subject,
    durationMinutes: entGeographyTest.durationMinutes,
    isFree: entGeographyTest.isFree,
    priceTenge: entGeographyTest.priceTenge,
    description:
      "Пробный тест по географии в формате ЕНТ: одиночный выбор, множественный выбор, сопоставление.",
    questions: entGeographyTest.questions,
  });

  const placeholderQuestion: Question = {
    id: 1,
    type: "single_choice",
    text: "Пример вопроса (замените через админку)",
    options: [
      { id: "A", label: "Вариант A" },
      { id: "B", label: "Вариант B" },
      { id: "C", label: "Вариант C" },
      { id: "D", label: "Вариант D" },
    ],
    correctAnswer: "A",
  };

  for (const item of catalog) {
    if (item.id === "ent-geography") continue;
    const exists = await tests().findOne({ _id: item.id });
    if (exists) continue;
    await upsertTest({
      id: item.id,
      title: item.title,
      titleKz: item.titleKz,
      section: item.section,
      examType: item.examType,
      subject: item.subject,
      durationMinutes: item.durationMinutes,
      isFree: item.isFree,
      priceTenge: item.priceTenge,
      description: item.description,
      questions: [placeholderQuestion],
    });
    console.log(`Seeded placeholder: ${item.id}`);
  }

  console.log("Seed complete.");
}

const isCli =
  process.argv[1] &&
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (isCli) {
  await connectDb();
  await seedDatabase();
  await closeDb();
}
