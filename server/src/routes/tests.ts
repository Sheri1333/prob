import { Router } from "express";
import { tests } from "../db.js";
import { optionalAuth, type AuthedRequest } from "../auth.js";
import { stripAnswers } from "../scoring.js";

export const testsRouter = Router();

function toCatalogItem(row: {
  _id: string;
  title: string;
  titleKz: string;
  examType: string;
  subject: string;
  section: string;
  durationMinutes: number;
  questionCount: number;
  isFree: boolean;
  priceTenge: number | null;
  description: string;
}) {
  return {
    id: row._id,
    title: row.title,
    titleKz: row.titleKz,
    examType: row.examType,
    subject: row.subject,
    section: row.section,
    durationMinutes: row.durationMinutes,
    questionCount: row.questionCount,
    isFree: row.isFree,
    priceTenge: row.priceTenge ?? undefined,
    description: row.description,
  };
}

testsRouter.get("/", async (_req, res) => {
  const rows = await tests().find().sort({ createdAt: -1 }).toArray();
  res.json({ tests: rows.map(toCatalogItem) });
});

testsRouter.get("/:id", optionalAuth, async (req: AuthedRequest, res) => {
  const row = await tests().findOne({ _id: req.params.id });
  if (!row) {
    res.status(404).json({ error: "Тест не найден" });
    return;
  }

  const isAdmin = req.user?.role === "admin";
  res.json({
    test: {
      ...toCatalogItem(row),
      questions: isAdmin ? row.questions : stripAnswers(row.questions),
    },
  });
});
