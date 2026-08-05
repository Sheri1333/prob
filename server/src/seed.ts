import bcrypt from "bcryptjs";
import { db } from "./db.js";
import { entGeographyTest } from "../../src/data/tests/ent-geography.ts";
import { catalog } from "../../src/data/catalog.ts";
import type { Question } from "./scoring.js";

function upsertTest(params: {
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
  db.prepare(
    `INSERT INTO tests (
      id, title, title_kz, section, exam_type, subject,
      duration_minutes, question_count, is_free, price_tenge,
      description, questions_json, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(id) DO UPDATE SET
      title = excluded.title,
      title_kz = excluded.title_kz,
      section = excluded.section,
      exam_type = excluded.exam_type,
      subject = excluded.subject,
      duration_minutes = excluded.duration_minutes,
      question_count = excluded.question_count,
      is_free = excluded.is_free,
      price_tenge = excluded.price_tenge,
      description = excluded.description,
      questions_json = excluded.questions_json,
      updated_at = datetime('now')`,
  ).run(
    params.id,
    params.title,
    params.titleKz,
    params.section,
    params.examType,
    params.subject,
    params.durationMinutes,
    params.questions.length,
    params.isFree ? 1 : 0,
    params.priceTenge ?? null,
    params.description,
    JSON.stringify(params.questions),
  );
}

const adminEmail = "admin@prob.kz";
const adminPass = "admin123";
const demoEmail = "demo@prob.kz";
const demoPass = "demo123";

const adminExists = db.prepare("SELECT id FROM users WHERE email = ?").get(adminEmail);
if (!adminExists) {
  db.prepare(
    "INSERT INTO users (email, password_hash, name, role) VALUES (?, ?, ?, 'admin')",
  ).run(adminEmail, bcrypt.hashSync(adminPass, 10), "Администратор");
  console.log(`Admin: ${adminEmail} / ${adminPass}`);
} else {
  console.log("Admin already exists");
}

const demoExists = db.prepare("SELECT id FROM users WHERE email = ?").get(demoEmail);
if (!demoExists) {
  db.prepare(
    "INSERT INTO users (email, password_hash, name, role) VALUES (?, ?, ?, 'user')",
  ).run(demoEmail, bcrypt.hashSync(demoPass, 10), "Демо пользователь");
  console.log(`Demo user: ${demoEmail} / ${demoPass}`);
}

upsertTest({
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
console.log(`Seeded test: ${entGeographyTest.id} (${entGeographyTest.questions.length} q)`);

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
  const exists = db.prepare("SELECT id FROM tests WHERE id = ?").get(item.id);
  if (exists) continue;
  upsertTest({
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
