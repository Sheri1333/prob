import { Router } from "express";
import { ObjectId } from "mongodb";
import { attempts, tests, type TestDoc } from "../db.js";
import { optionalAuth, type AuthedRequest } from "../auth.js";
import { newTestId } from "../ids.js";
import {
  detectEntBlock,
  ENT_BLOCK_LABELS,
  ENT_PROFILE_COMBOS,
  ENT_TOTAL_MINUTES,
  getProfileCombo,
  subjectPoolKey,
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

function groupTests(rows: TestDoc[]) {
  const byBlock: Record<string, TestDoc[]> = {
    history: [],
    reading: [],
    math_literacy: [],
  };
  const profileByKey = new Map<string, TestDoc[]>();

  for (const row of rows) {
    const block = detectEntBlock(row.subject);
    if (block) {
      byBlock[block].push(row);
      continue;
    }
    const key = subjectPoolKey(row.subject);
    if (!key) continue;
    const list = profileByKey.get(key) ?? [];
    list.push(row);
    profileByKey.set(key, list);
  }
  return { byBlock, profileByKey };
}

examsRouter.get("/blueprint", optionalAuth, async (_req: AuthedRequest, res) => {
  const rows = await tests().find().toArray();
  const { byBlock, profileByKey } = groupTests(rows);

  const mandatory = (
    ["history", "reading", "math_literacy"] as const
  ).map((key) => ({
    key,
    label: ENT_BLOCK_LABELS[key],
    variantCount: byBlock[key].length,
    ready: byBlock[key].length > 0,
  }));

  const combinations = ENT_PROFILE_COMBOS.map((combo) => {
    const k1 = subjectPoolKey(combo.subject1);
    const k2 = subjectPoolKey(combo.subject2);
    const pool1 = profileByKey.get(k1) ?? [];
    const pool2 = profileByKey.get(k2) ?? [];
    const same = k1 === k2;
    const ready = same
      ? pool1.length >= 1
      : pool1.length > 0 && pool2.length > 0;
    return {
      id: combo.id,
      labelKz: combo.labelKz,
      labelRu: combo.labelRu,
      subject1: combo.subject1,
      subject2: combo.subject2,
      ready,
      variantCount1: pool1.length,
      variantCount2: pool2.length,
    };
  });

  res.json({
    durationMinutes: ENT_TOTAL_MINUTES,
    mandatory,
    combinations,
    ready:
      mandatory.every((m) => m.ready) && combinations.some((c) => c.ready),
  });
});

examsRouter.post("/start", optionalAuth, async (req: AuthedRequest, res) => {
  const body = req.body as {
    comboId?: string;
    profileSubjects?: string[];
    excludeTestIds?: string[];
  };

  let profileLabels: string[] = [];

  if (body.comboId) {
    const combo = getProfileCombo(body.comboId);
    if (!combo) {
      res.status(400).json({ error: "Неизвестная комбинация предметов" });
      return;
    }
    profileLabels = [combo.subject1, combo.subject2];
  } else if (Array.isArray(body.profileSubjects) && body.profileSubjects.length === 2) {
    profileLabels = body.profileSubjects.map(String);
  } else {
    res.status(400).json({ error: "Выберите комбинацию бейіндік пәндер" });
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
  const { byBlock, profileByKey } = groupTests(rows);

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

  for (const label of profileLabels) {
    const key = subjectPoolKey(label);
    const pool = profileByKey.get(key) ?? [];
    const picked = pickVariant(pool, used);
    if (!picked) {
      res.status(400).json({
        error: `Нет пробного теста для предмета «${label}». Добавьте его в админке.`,
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
    comboId: body.comboId ?? null,
    profileSubjects: profileLabels,
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
