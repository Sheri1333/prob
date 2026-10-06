import { Router } from "express";
import { attempts, tests, type AttemptDoc } from "../db.js";
import { adminRequired, authRequired, type AuthedRequest } from "../auth.js";
import {
  scoreTest,
  type AnswerValue,
} from "../scoring.js";
import { ObjectId } from "mongodb";

export const attemptsRouter = Router();

// Standalone attempts are an answer oracle for the ENT pool (submit, read the
// per-question results, repeat), so only admins may use them for checking.
attemptsRouter.post("/", adminRequired, async (req: AuthedRequest, res) => {
  const { testId, answers, startedAt } = req.body as {
    testId?: string;
    answers?: Record<string, AnswerValue>;
    startedAt?: string;
  };

  if (
    typeof testId !== "string" ||
    !testId ||
    !answers ||
    typeof answers !== "object" ||
    Array.isArray(answers)
  ) {
    res.status(400).json({ error: "testId и answers обязательны" });
    return;
  }

  const row = await tests().findOne({ _id: testId });
  if (!row) {
    res.status(404).json({ error: "Тест не найден" });
    return;
  }

  const { score, maxScore, results } = scoreTest(row.questions, answers);
  const finishedAt = new Date();
  const parsedStart = typeof startedAt === "string" ? new Date(startedAt) : null;
  const started =
    parsedStart && !Number.isNaN(parsedStart.getTime()) && parsedStart <= finishedAt
      ? parsedStart
      : finishedAt;

  const insert = await attempts().insertOne({
    userId: req.user ? new ObjectId(req.user.id) : null,
    testId,
    answers,
    score,
    maxScore,
    startedAt: started,
    finishedAt,
  } as AttemptDoc);

  res.status(201).json({
    attempt: {
      id: insert.insertedId.toHexString(),
      testId,
      score,
      maxScore,
      results,
      startedAt: started.toISOString(),
      finishedAt: finishedAt.toISOString(),
    },
    questions: row.questions,
  });
});

attemptsRouter.get("/me", authRequired, async (req: AuthedRequest, res) => {
  const userId = new ObjectId(req.user!.id);
  const rows = await attempts()
    .find({ userId })
    .sort({ finishedAt: -1 })
    .toArray();

  const testIds = [...new Set(rows.map((r) => r.testId))];
  const testDocs = await tests()
    .find({ _id: { $in: testIds } })
    .toArray();
  const byId = new Map(testDocs.map((t) => [t._id, t]));

  res.json({
    attempts: rows.map((row) => {
      const test = byId.get(row.testId);
      return {
        id: row._id.toHexString(),
        testId: row.testId,
        score: row.score,
        maxScore: row.maxScore,
        startedAt: row.startedAt.toISOString(),
        finishedAt: row.finishedAt.toISOString(),
        title: test?.title ?? row.testId,
        titleKz: test?.titleKz ?? row.testId,
        subject: test?.subject ?? "",
      };
    }),
  });
});
