import { Router } from "express";
import { db } from "../db.js";
import { authRequired, type AuthedRequest } from "../auth.js";
import {
  scoreTest,
  type AnswerValue,
  type Question,
} from "../scoring.js";

export const attemptsRouter = Router();

attemptsRouter.post("/", authRequired, (req: AuthedRequest, res) => {
  const { testId, answers, startedAt } = req.body as {
    testId?: string;
    answers?: Record<string, AnswerValue>;
    startedAt?: string;
  };

  if (!testId || !answers || typeof answers !== "object") {
    res.status(400).json({ error: "testId и answers обязательны" });
    return;
  }

  const row = db
    .prepare("SELECT * FROM tests WHERE id = ?")
    .get(testId) as { questions_json: string; id: string } | undefined;

  if (!row) {
    res.status(404).json({ error: "Тест не найден" });
    return;
  }

  const questions = JSON.parse(row.questions_json) as Question[];
  const { score, maxScore, results } = scoreTest(questions, answers);
  const finishedAt = new Date().toISOString();

  const result = db
    .prepare(
      `INSERT INTO attempts (user_id, test_id, answers_json, score, max_score, started_at, finished_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      req.user!.id,
      testId,
      JSON.stringify(answers),
      score,
      maxScore,
      startedAt || finishedAt,
      finishedAt,
    );

  res.status(201).json({
    attempt: {
      id: Number(result.lastInsertRowid),
      testId,
      score,
      maxScore,
      results,
      startedAt: startedAt || finishedAt,
      finishedAt,
    },
    questions,
  });
});

attemptsRouter.get("/me", authRequired, (req: AuthedRequest, res) => {
  const rows = db
    .prepare(
      `SELECT a.id, a.test_id, a.score, a.max_score, a.started_at, a.finished_at,
              t.title, t.title_kz, t.subject
       FROM attempts a
       JOIN tests t ON t.id = a.test_id
       WHERE a.user_id = ?
       ORDER BY a.finished_at DESC`,
    )
    .all(req.user!.id);

  res.json({
    attempts: rows.map((r) => {
      const row = r as {
        id: number;
        test_id: string;
        score: number;
        max_score: number;
        started_at: string;
        finished_at: string;
        title: string;
        title_kz: string;
        subject: string;
      };
      return {
        id: row.id,
        testId: row.test_id,
        score: row.score,
        maxScore: row.max_score,
        startedAt: row.started_at,
        finishedAt: row.finished_at,
        title: row.title,
        titleKz: row.title_kz,
        subject: row.subject,
      };
    }),
  });
});
