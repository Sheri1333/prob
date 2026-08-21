import { Router } from "express";
import { ObjectId } from "mongodb";
import { attempts, tests, type TestDoc } from "../db.js";
import { optionalAuth, type AuthedRequest } from "../auth.js";
import { newTestId } from "../ids.js";
import {
  detectEntBlock,
  ENT_BLOCK_LABELS,
  ENT_PROFILE_COUNT,
  ENT_TOTAL_MINUTES,
  normalizeSubject,
  type EntBlockKind,
} from "../ent.js";
import { scoreTest, stripAnswers, type AnswerValue } from "../scoring.js";

export const examsRouter = Router();

function pickVariant(
  pool: TestDoc[],
  usedIds: Set<string>,
): TestDoc | null {
  if (pool.length === 0) return null;
  const fresh = pool.filter((t) => !usedIds.has(t._id));
  const source = fresh.length > 0 ? fresh : pool;
  return source[Math.floor(Math.random() * source.length)] ?? null;
}

examsRouter.get("/blueprint", optionalAuth, async (req: AuthedRequest, res) => {
  const rows = await tests().find().toArray();
  const byBlock: Record<string, TestDoc[]> = {
    history: [],
    reading: [],
    math_literacy: [],
  };
  const profileBySubject = new Map<string, TestDoc[]>();

  for (const row of rows) {
    const block = detectEntBlock(row.subject);
    if (block) {
      byBlock[block].push(row);
      continue;
    }
    const key = normalizeSubject(row.subject);
    if (!key) continue;
    const list = profileBySubject.get(key) ?? [];
    list.push(row);
    profileBySubject.set(key, list);
  }

  const mandatory = (
    ["history", "reading", "math_literacy"] as const
  ).map((key) => ({
    key,
    label: ENT_BLOCK_LABELS[key],
    variantCount: byBlock[key].length,
    ready: byBlock[key].length > 0,
  }));

  const profileSubjects = [...profileBySubject.entries()]
    .map(([key, list]) => ({
      key,
      subject: list[0].subject,
      variantCount: list.length,
    }))
    .sort((a, b) => a.subject.localeCompare(b.subject, "ru"));

  res.json({
    durationMinutes: ENT_TOTAL_MINUTES,
    profileCount: ENT_PROFILE_COUNT,
    mandatory,
    profileSubjects,
    ready:
      mandatory.every((m) => m.ready) &&
      profileSubjects.length >= ENT_PROFILE_COUNT,
  });
});

examsRouter.post("/start", optionalAuth, async (req: AuthedRequest, res) => {
  const body = req.body as {
    profileSubjects?: string[];
    excludeTestIds?: string[];
  };

  const profileKeys = (body.profileSubjects ?? [])
    .map((s) => normalizeSubject(String(s)))
    .filter(Boolean);

  if (profileKeys.length !== ENT_PROFILE_COUNT) {
    res.status(400).json({
      error: `Выберите ${ENT_PROFILE_COUNT} профильных предмета`,
    });
    return;
  }
  if (new Set(profileKeys).size !== profileKeys.length) {
    res.status(400).json({ error: "Профильные предметы должны быть разными" });
    return;
  }

  const used = new Set<string>(
    (body.excludeTestIds ?? []).filter((id) => typeof id === "string"),
  );

  if (req.user) {
    const past = await attempts()
      .find({ userId: new ObjectId(req.user.id) })
      .project({ testId: 1 })
      .toArray();
    for (const a of past) used.add(a.testId);
  }

  const rows = await tests().find().toArray();
  const byBlock: Record<string, TestDoc[]> = {
    history: [],
    reading: [],
    math_literacy: [],
  };
  const profileBySubject = new Map<string, TestDoc[]>();

  for (const row of rows) {
    const block = detectEntBlock(row.subject);
    if (block) {
      byBlock[block].push(row);
      continue;
    }
    const key = normalizeSubject(row.subject);
    const list = profileBySubject.get(key) ?? [];
    list.push(row);
    profileBySubject.set(key, list);
  }

  const sections: Array<{
    block: EntBlockKind;
    testId: string;
    subject: string;
    title: string;
    titleKz: string;
    questionCount: number;
  }> = [];

  for (const key of ["history", "reading", "math_literacy"] as const) {
    const picked = pickVariant(byBlock[key], used);
    if (!picked) {
      res.status(400).json({
        error: `Нет вариантов для блока «${ENT_BLOCK_LABELS[key].ru}»`,
      });
      return;
    }
    used.add(picked._id);
    sections.push({
      block: key,
      testId: picked._id,
      subject: picked.subject,
      title: picked.title,
      titleKz: picked.titleKz,
      questionCount: picked.questionCount,
    });
  }

  for (const key of profileKeys) {
    const pool = profileBySubject.get(key) ?? [];
    const picked = pickVariant(pool, used);
    if (!picked) {
      res.status(400).json({
        error: `Нет вариантов для предмета «${key}»`,
      });
      return;
    }
    used.add(picked._id);
    sections.push({
      block: "profile",
      testId: picked._id,
      subject: picked.subject,
      title: picked.title,
      titleKz: picked.titleKz,
      questionCount: picked.questionCount,
    });
  }

  const sessionId = newTestId();
  const questionDocs = await tests()
    .find({ _id: { $in: sections.map((s) => s.testId) } })
    .toArray();
  const byId = new Map(questionDocs.map((t) => [t._id, t]));

  res.status(201).json({
    sessionId,
    durationMinutes: ENT_TOTAL_MINUTES,
    startedAt: new Date().toISOString(),
    endsAt: Date.now() + ENT_TOTAL_MINUTES * 60 * 1000,
    sections: sections.map((s) => {
      const doc = byId.get(s.testId)!;
      return {
        ...s,
        questions: stripAnswers(doc.questions),
      };
    }),
  });
});

examsRouter.post("/submit", optionalAuth, async (req: AuthedRequest, res) => {
  const body = req.body as {
    sessionId?: string;
    startedAt?: string;
    sections?: Array<{
      testId: string;
      answers: Record<string, AnswerValue>;
    }>;
  };

  if (!body.sessionId || !Array.isArray(body.sections) || body.sections.length === 0) {
    res.status(400).json({ error: "sessionId и sections обязательны" });
    return;
  }

  const finishedAt = new Date();
  const started = body.startedAt ? new Date(body.startedAt) : finishedAt;
  const userId = req.user ? new ObjectId(req.user.id) : null;

  const results = [];
  let totalScore = 0;
  let totalMax = 0;

  for (const section of body.sections) {
    const row = await tests().findOne({ _id: section.testId });
    if (!row) {
      res.status(404).json({ error: `Тест не найден: ${section.testId}` });
      return;
    }
    const scored = scoreTest(row.questions, section.answers ?? {});
    totalScore += scored.score;
    totalMax += scored.maxScore;

    const insert = await attempts().insertOne({
      userId,
      testId: section.testId,
      answers: section.answers ?? {},
      score: scored.score,
      maxScore: scored.maxScore,
      startedAt: started,
      finishedAt,
      sessionId: body.sessionId,
    });

    const answerLabels: Record<number, string> = {};
    for (const q of row.questions) {
      const ans = section.answers?.[String(q.id)];
      if (ans === undefined) {
        answerLabels[q.id] = "";
        continue;
      }
      if (typeof ans === "string") {
        answerLabels[q.id] = ans;
      } else if (Array.isArray(ans)) {
        answerLabels[q.id] = ans.join(",");
      } else {
        answerLabels[q.id] = Object.values(ans).join(",");
      }
    }

    results.push({
      attemptId: insert.insertedId.toHexString(),
      testId: row._id,
      subject: row.subject,
      title: row.title,
      titleKz: row.titleKz,
      score: scored.score,
      maxScore: scored.maxScore,
      results: scored.results,
      answerLabels,
      questionIds: row.questions.map((q) => q.id),
      questionCount: row.questions.length,
    });
  }

  res.status(201).json({
    sessionId: body.sessionId,
    score: totalScore,
    maxScore: totalMax,
    startedAt: started.toISOString(),
    finishedAt: finishedAt.toISOString(),
    sections: results,
  });
});
