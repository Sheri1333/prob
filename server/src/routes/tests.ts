import { Router } from "express";
import { db } from "../db.js";
import { optionalAuth, type AuthedRequest } from "../auth.js";
import { stripAnswers, type Question } from "../scoring.js";

export const testsRouter = Router();

interface TestRow {
  id: string;
  title: string;
  title_kz: string;
  section: string;
  exam_type: string;
  subject: string;
  duration_minutes: number;
  question_count: number;
  is_free: number;
  price_tenge: number | null;
  description: string;
  questions_json: string;
}

function toCatalogItem(row: TestRow) {
  return {
    id: row.id,
    title: row.title,
    titleKz: row.title_kz,
    examType: row.exam_type,
    subject: row.subject,
    section: row.section,
    durationMinutes: row.duration_minutes,
    questionCount: row.question_count,
    isFree: Boolean(row.is_free),
    priceTenge: row.price_tenge ?? undefined,
    description: row.description,
  };
}

testsRouter.get("/", (_req, res) => {
  const rows = db
    .prepare(
      `SELECT id, title, title_kz, section, exam_type, subject,
              duration_minutes, question_count, is_free, price_tenge, description
       FROM tests ORDER BY created_at DESC`,
    )
    .all() as Omit<TestRow, "questions_json">[];

  res.json({
    tests: rows.map((row) =>
      toCatalogItem({ ...row, questions_json: "[]" }),
    ),
  });
});

testsRouter.get("/:id", optionalAuth, (req: AuthedRequest, res) => {
  const row = db
    .prepare("SELECT * FROM tests WHERE id = ?")
    .get(req.params.id) as TestRow | undefined;

  if (!row) {
    res.status(404).json({ error: "Тест не найден" });
    return;
  }

  const questions = JSON.parse(row.questions_json) as Question[];
  const isAdmin = req.user?.role === "admin";

  res.json({
    test: {
      ...toCatalogItem(row),
      questions: isAdmin ? questions : stripAnswers(questions),
    },
  });
});
