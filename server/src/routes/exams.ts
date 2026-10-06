import { Router } from "express";
import { ObjectId } from "mongodb";
import {
  attempts,
  examSessions,
  tests,
  users,
  type AttemptDoc,
  type ExamSessionDoc,
  type ExamSessionSection,
  type TestDoc,
} from "../db.js";
import { authRequired, optionalAuth, type AuthedRequest } from "../auth.js";
import { rateLimit } from "../rateLimit.js";
import {
  shuffleQuestionsForSession,
  toOriginalAnswers,
  toSessionAnswers,
} from "../shuffle.js";
import { newTestId } from "../ids.js";
import {
  buildEntPoolCoverage,
  detectEntBlock,
  ENT_BLOCK_LABELS,
  ENT_TOTAL_MAX,
  ENT_TOTAL_MINUTES,
  getProfileCombo,
  groupTestsByEnt,
  subjectPoolKey,
  type EntBlockKind,
} from "../ent.js";
import { scoreEntSection, stripAnswers, type AnswerValue } from "../scoring.js";
import { getPricing } from "../settings.js";
import { isBrevoConfigured } from "../brevo.js";
import { queueMail, sendExamResultEmail } from "../mail.js";

export const examsRouter = Router();
const SUBMIT_GRACE_MS = 5_000;
const startLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: "Слишком много запусков ЕНТ. Попробуйте позже",
  key: (req) => (req as AuthedRequest).user?.id ?? req.ip ?? "unknown",
});

examsRouter.get("/pricing", async (_req, res) => {
  res.json(await getPricing());
});

function sectionOrder(subject: string): number {
  const block = detectEntBlock(subject);
  if (block === "history") return 0;
  if (block === "reading") return 1;
  if (block === "math_literacy") return 2;
  return 3;
}

function blockForSubject(subject: string): EntBlockKind {
  return detectEntBlock(subject) ?? "profile";
}

function asAnswers(
  value: Record<string, unknown> | undefined,
): Record<string, AnswerValue> {
  const out: Record<string, AnswerValue> = {};
  if (!value) return out;
  for (const [key, raw] of Object.entries(value)) {
    if (typeof raw === "string" || Array.isArray(raw) || (raw && typeof raw === "object")) {
      out[key] = raw as AnswerValue;
    }
  }
  return out;
}

function mergeAnswers(
  base: Record<string, Record<string, unknown>>,
  extra?: Record<string, Record<string, AnswerValue>>,
): Record<string, Record<string, unknown>> {
  if (!extra) return base;
  const next: Record<string, Record<string, unknown>> = { ...base };
  for (const [testId, answers] of Object.entries(extra)) {
    next[testId] = { ...(next[testId] ?? {}), ...answers };
  }
  return next;
}

function answerLabelsFrom(
  questions: TestDoc["questions"],
  answers: Record<string, unknown>,
): Record<number, string> {
  const labels: Record<number, string> = {};
  for (const q of questions) {
    const ans = answers[String(q.id)];
    if (ans === undefined) {
      labels[q.id] = "";
      continue;
    }
    if (typeof ans === "string") labels[q.id] = ans;
    else if (Array.isArray(ans)) labels[q.id] = ans.join(",");
    else if (ans && typeof ans === "object") {
      labels[q.id] = Object.values(ans as Record<string, string>).join(",");
    } else labels[q.id] = "";
  }
  return labels;
}

function remainingSeconds(endsAt: Date, now = new Date()): number {
  return Math.max(0, Math.ceil((endsAt.getTime() - now.getTime()) / 1000));
}

function canAccessSession(session: ExamSessionDoc, req: AuthedRequest): boolean {
  if (!session.userId) return true;
  if (!req.user) return false;
  if (req.user.role === "admin") return true;
  return req.user.id === session.userId.toHexString();
}

function publicInProgress(session: ExamSessionDoc, now = new Date()) {
  return {
    status: "in_progress" as const,
    sessionId: session._id,
    durationMinutes: ENT_TOTAL_MINUTES,
    comboId: session.comboId,
    profileSubjects: session.profileSubjects,
    startedAt: session.startedAt.toISOString(),
    endsAt: session.endsAt.getTime(),
    remainingSeconds: remainingSeconds(session.endsAt, now),
    sectionIndex: session.sectionIndex,
    answersByTest: session.answersByTest,
    currentIndexByTest: session.currentIndexByTest,
    sections: session.sections.map(({ optionMaps: _secret, ...rest }) => rest),
    usedTestIds: session.usedTestIds,
  };
}

async function sessionPayload(sessionId: string, rows: AttemptDoc[]) {
  const testIds = [...new Set(rows.map((r) => r.testId))];
  const testDocs = await tests()
    .find({ _id: { $in: testIds } })
    .toArray();
  const byId = new Map(testDocs.map((t) => [t._id, t]));
  const stored = await examSessions().findOne({ _id: sessionId });
  const blockByTest = new Map(
    (stored?.sections ?? []).map((s) => [s.testId, s.block]),
  );
  const mapsByTest = new Map(
    (stored?.sections ?? []).map((s) => [s.testId, s.optionMaps]),
  );

  const sections = [...rows]
    .map((row) => {
      const test = byId.get(row.testId);
      if (!test) return null;
      const block = blockByTest.get(row.testId) ?? blockForSubject(test.subject);
      const scored = scoreEntSection(
        block,
        test.questions,
        asAnswers(row.answers as Record<string, unknown>),
      );
      return {
        attemptId: row._id.toHexString(),
        testId: test._id,
        subject: test.subject,
        title: test.titleKz || test.title,
        titleKz: test.titleKz || test.title,
        score: row.score,
        maxScore: row.maxScore,
        results: scored.results,
        points: scored.points,
        answerLabels: answerLabelsFrom(
          test.questions,
          toSessionAnswers(
            asAnswers(row.answers as Record<string, unknown>),
            mapsByTest.get(row.testId),
          ),
        ),
        questionIds: test.questions.map((q) => q.id),
        questionCount: test.questions.length,
      };
    })
    .filter((s): s is NonNullable<typeof s> => s !== null)
    .sort((a, b) => sectionOrder(a.subject) - sectionOrder(b.subject));

  const score = sections.reduce((sum, s) => sum + s.score, 0);
  const maxScore = sections.reduce((sum, s) => sum + s.maxScore, 0) || ENT_TOTAL_MAX;
  const startedAt = rows[0]?.startedAt ?? new Date();
  const finishedAt = rows.reduce(
    (latest, r) => (r.finishedAt > latest ? r.finishedAt : latest),
    rows[0]?.finishedAt ?? new Date(),
  );

  return {
    status: "submitted" as const,
    sessionId,
    score,
    maxScore,
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    sections,
  };
}

/** Keep only answers for tests that belong to this session. */
function sectionAnswersOnly(
  session: ExamSessionDoc,
  extra?: Record<string, Record<string, AnswerValue>>,
): Record<string, Record<string, AnswerValue>> | undefined {
  if (!extra || typeof extra !== "object") return undefined;
  const out: Record<string, Record<string, AnswerValue>> = {};
  for (const section of session.sections) {
    const answers = extra[section.testId];
    if (answers && typeof answers === "object" && !Array.isArray(answers)) {
      out[section.testId] = answers;
    }
  }
  return out;
}

function sanitizeIndexes(
  session: ExamSessionDoc,
  extra: unknown,
): Record<string, number> {
  const out: Record<string, number> = {};
  if (!extra || typeof extra !== "object") return out;
  const raw = extra as Record<string, unknown>;
  for (const section of session.sections) {
    const value = raw[section.testId];
    if (typeof value === "number" && Number.isInteger(value)) {
      out[section.testId] = Math.max(
        0,
        Math.min(section.questions.length - 1, value),
      );
    }
  }
  return out;
}

/**
 * Another request already claimed this session. Its attempts may still be
 * inserting, so wait briefly until all sections are visible.
 */
async function waitForSubmittedPayload(session: ExamSessionDoc) {
  const expected = session.sections.length;
  let rows: AttemptDoc[] = [];
  for (let i = 0; i < 20; i++) {
    rows = await attempts().find({ sessionId: session._id }).toArray();
    if (rows.length >= expected) break;
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  return sessionPayload(session._id, rows);
}

async function finalizeSession(
  session: ExamSessionDoc,
  extraAnswers?: Record<string, Record<string, AnswerValue>>,
  allowMerge = true,
) {
  if (session.status === "submitted") {
    return waitForSubmittedPayload(session);
  }
  const existing = await attempts()
    .find({ sessionId: session._id })
    .toArray();
  if (existing.length > 0) {
    await examSessions().updateOne(
      { _id: session._id },
      { $set: { status: "submitted", submittedAt: new Date() } },
    );
    return sessionPayload(session._id, existing);
  }

  const now = new Date();
  const answersByTest = allowMerge
    ? mergeAnswers(session.answersByTest, sectionAnswersOnly(session, extraAnswers))
    : session.answersByTest;
  const finishedAt = now;

  // Claim the session atomically so concurrent submits (double click, timer +
  // button, expiry on GET) cannot insert the section attempts twice.
  const claim = await examSessions().updateOne(
    { _id: session._id, status: { $ne: "submitted" } },
    {
      $set: {
        status: "submitted",
        submittedAt: finishedAt,
        answersByTest,
      },
    },
  );
  if (claim.modifiedCount === 0) {
    return waitForSubmittedPayload(session);
  }

  const testDocs = await tests()
    .find({ _id: { $in: session.sections.map((s) => s.testId) } })
    .toArray();
  const testById = new Map(testDocs.map((t) => [t._id, t]));
  const results = [];
  const rows: AttemptDoc[] = [];
  let totalScore = 0;
  let totalMax = 0;

  for (const section of session.sections) {
    const row = testById.get(section.testId);
    const questions = row?.questions ?? section.questions;
    // Answers arrive in this session's shuffled letters; score and store
    // them against the original option ids.
    const shownAnswers = asAnswers(answersByTest[section.testId]);
    const answers = toOriginalAnswers(shownAnswers, section.optionMaps);
    const scored = scoreEntSection(section.block, questions, answers);
    totalScore += scored.score;
    totalMax += scored.maxScore;

    const attemptId = new ObjectId();
    rows.push({
      _id: attemptId,
      userId: session.userId,
      testId: section.testId,
      answers,
      score: scored.score,
      maxScore: scored.maxScore,
      startedAt: session.startedAt,
      finishedAt,
      sessionId: session._id,
    });

    results.push({
      attemptId: attemptId.toHexString(),
      testId: section.testId,
      subject: section.subject,
      title: row?.title ?? section.title,
      titleKz: row?.titleKz ?? section.titleKz,
      score: scored.score,
      maxScore: scored.maxScore,
      results: scored.results,
      points: scored.points,
      answerLabels: answerLabelsFrom(questions, shownAnswers),
      questionIds: questions.map((q) => q.id),
      questionCount: questions.length,
    });
  }

  if (rows.length > 0) await attempts().insertMany(rows);

  if (session.userId && isBrevoConfigured()) {
    const user = await users().findOne({ _id: session.userId });
    if (user) {
      queueMail(
        sendExamResultEmail({
          email: user.email,
          name: user.name,
          score: totalScore,
          maxScore: totalMax || ENT_TOTAL_MAX,
          sessionId: session._id,
        }),
      );
    }
  }

  return {
    status: "submitted" as const,
    sessionId: session._id,
    score: totalScore,
    maxScore: totalMax || ENT_TOTAL_MAX,
    startedAt: session.startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    sections: results,
  };
}

async function loadAndMaybeExpire(sessionId: string) {
  const session = await examSessions().findOne({ _id: sessionId });
  if (!session) return null;
  if (
    session.status === "in_progress" &&
    Date.now() > session.endsAt.getTime() + SUBMIT_GRACE_MS
  ) {
    return {
      session,
      expired: true as const,
      result: await finalizeSession(session, undefined, false),
    };
  }
  return { session, expired: false as const };
}

examsRouter.get("/history", authRequired, async (req: AuthedRequest, res) => {
  const userId = new ObjectId(req.user!.id);
  const rows = await attempts()
    .find({
      userId,
      sessionId: { $exists: true, $type: "string", $ne: "" },
    })
    .sort({ finishedAt: -1 })
    .toArray();

  const groups = new Map<string, AttemptDoc[]>();
  for (const row of rows) {
    const id = row.sessionId;
    if (!id) continue;
    const list = groups.get(id) ?? [];
    list.push(row);
    groups.set(id, list);
  }

  const sessions = [...groups.entries()]
    .map(([sessionId, list]) => {
      const score = list.reduce((sum, r) => sum + r.score, 0);
      const maxScore =
        list.reduce((sum, r) => sum + r.maxScore, 0) || ENT_TOTAL_MAX;
      const finishedAt = list.reduce(
        (latest, r) => (r.finishedAt > latest ? r.finishedAt : latest),
        list[0].finishedAt,
      );
      const startedAt = list.reduce(
        (earliest, r) => (r.startedAt < earliest ? r.startedAt : earliest),
        list[0].startedAt,
      );
      return {
        sessionId,
        score,
        maxScore,
        sectionCount: list.length,
        startedAt: startedAt.toISOString(),
        finishedAt: finishedAt.toISOString(),
      };
    })
    .sort((a, b) => +new Date(b.finishedAt) - +new Date(a.finishedAt));

  res.json({ sessions });
});

examsRouter.get("/active", optionalAuth, async (req: AuthedRequest, res) => {
  if (!req.user) {
    res.json({ session: null });
    return;
  }
  const session = await examSessions().findOne({
    userId: new ObjectId(req.user.id),
    status: "in_progress",
  });
  if (!session) {
    res.json({ session: null });
    return;
  }
  const loaded = await loadAndMaybeExpire(session._id);
  if (!loaded || loaded.expired) {
    res.json({ session: null });
    return;
  }
  res.json({ session: publicInProgress(loaded.session) });
});

examsRouter.get("/sessions/:sessionId", optionalAuth, async (req: AuthedRequest, res) => {
  const sessionId = String(req.params.sessionId ?? "");
  const loaded = await loadAndMaybeExpire(sessionId);
  if (loaded) {
    if (!canAccessSession(loaded.session, req)) {
      res.status(403).json({ error: "Нет доступа к этой сессии" });
      return;
    }
    if (loaded.expired) {
      res.json(loaded.result);
      return;
    }
    if (loaded.session.status === "in_progress") {
      res.json(publicInProgress(loaded.session));
      return;
    }
  }

  const rows = await attempts().find({ sessionId }).toArray();
  if (rows.length === 0) {
    res.status(404).json({ error: "Сессия не найдена" });
    return;
  }
  if (loaded && !canAccessSession(loaded.session, req)) {
    res.status(403).json({ error: "Нет доступа к этой сессии" });
    return;
  }
  res.json(await sessionPayload(sessionId, rows));
});

examsRouter.patch("/sessions/:sessionId", optionalAuth, async (req: AuthedRequest, res) => {
  const loaded = await loadAndMaybeExpire(String(req.params.sessionId ?? ""));
  if (!loaded) {
    res.status(404).json({ error: "Сессия не найдена" });
    return;
  }
  if (!canAccessSession(loaded.session, req)) {
    res.status(403).json({ error: "Нет доступа к этой сессии" });
    return;
  }
  if (loaded.expired) {
    res.json(loaded.result);
    return;
  }
  if (loaded.session.status !== "in_progress") {
    const rows = await attempts().find({ sessionId: loaded.session._id }).toArray();
    res.json(await sessionPayload(loaded.session._id, rows));
    return;
  }

  const body = (req.body ?? {}) as {
    sectionIndex?: number;
    answersByTest?: Record<string, Record<string, AnswerValue>>;
    currentIndexByTest?: Record<string, number>;
  };
  const now = new Date();
  const allowMerge = now.getTime() <= loaded.session.endsAt.getTime() + SUBMIT_GRACE_MS;
  const answersByTest = allowMerge
    ? mergeAnswers(
        loaded.session.answersByTest,
        sectionAnswersOnly(loaded.session, body.answersByTest),
      )
    : loaded.session.answersByTest;
  const sectionIndex =
    typeof body.sectionIndex === "number" && Number.isInteger(body.sectionIndex)
      ? Math.max(0, Math.min(loaded.session.sections.length - 1, body.sectionIndex))
      : loaded.session.sectionIndex;
  const currentIndexByTest = {
    ...loaded.session.currentIndexByTest,
    ...sanitizeIndexes(loaded.session, body.currentIndexByTest),
  };

  // Only touch sessions that are still running: a concurrent submit must not
  // be overwritten with stale answers.
  await examSessions().updateOne(
    { _id: loaded.session._id, status: "in_progress" },
    { $set: { answersByTest, sectionIndex, currentIndexByTest } },
  );

  if (!allowMerge) {
    res.json(await finalizeSession({ ...loaded.session, answersByTest }, undefined, false));
    return;
  }

  res.json(
    publicInProgress({
      ...loaded.session,
      answersByTest,
      sectionIndex,
      currentIndexByTest,
    }),
  );
});

function pickVariant(
  pool: TestDoc[],
  usedIds: Set<string>,
): TestDoc | null {
  if (pool.length === 0) return null;
  const fresh = pool.filter((t) => !usedIds.has(t._id));
  const source = fresh.length > 0 ? fresh : pool;
  return source[Math.floor(Math.random() * source.length)] ?? null;
}

examsRouter.get("/blueprint", optionalAuth, async (_req: AuthedRequest, res) => {
  const rows = await tests().find().toArray();
  const coverage = buildEntPoolCoverage(rows);
  res.json({
    durationMinutes: ENT_TOTAL_MINUTES,
    mandatory: coverage.mandatory,
    combinations: coverage.combinations,
    ready: coverage.ready,
  });
});

examsRouter.post("/start", authRequired, startLimiter, async (req: AuthedRequest, res) => {
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
    (Array.isArray(body.excludeTestIds) ? body.excludeTestIds : []).filter(
      (id): id is string => typeof id === "string",
    ),
  );

  if (req.user) {
    const userId = new ObjectId(req.user.id);
    const past = await attempts()
      .find({ userId })
      .project({ testId: 1 })
      .toArray();
    for (const a of past) used.add(a.testId);
    await examSessions().updateMany(
      { userId, status: "in_progress" },
      { $set: { status: "abandoned" } },
    );
  }

  const rows = await tests().find().toArray();
  const { byBlock, profileByKey } = groupTestsByEnt(rows);

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

  const questionDocs = await tests()
    .find({ _id: { $in: sections.map((s) => s.testId) } })
    .toArray();
  const byId = new Map(questionDocs.map((t) => [t._id, t]));
  const now = new Date();
  const storedSections: ExamSessionSection[] = sections.map((s) => {
    const doc = byId.get(s.testId)!;
    const shuffled = shuffleQuestionsForSession(stripAnswers(doc.questions));
    return {
      ...s,
      questions: shuffled.questions,
      optionMaps: shuffled.optionMaps,
    };
  });

  const sessionId = newTestId();
  const session: ExamSessionDoc = {
    _id: sessionId,
    userId: req.user ? new ObjectId(req.user.id) : null,
    comboId: body.comboId ?? null,
    profileSubjects: profileLabels,
    startedAt: now,
    endsAt: new Date(now.getTime() + ENT_TOTAL_MINUTES * 60 * 1000),
    status: "in_progress",
    sectionIndex: 0,
    answersByTest: Object.fromEntries(storedSections.map((s) => [s.testId, {}])),
    currentIndexByTest: Object.fromEntries(
      storedSections.map((s) => [s.testId, 0]),
    ),
    sections: storedSections,
    usedTestIds: storedSections.map((s) => s.testId),
  };
  await examSessions().insertOne(session);

  res.status(201).json(publicInProgress(session, now));
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

  if (typeof body.sessionId !== "string" || !body.sessionId) {
    res.status(400).json({ error: "sessionId обязателен" });
    return;
  }

  const extraAnswers: Record<string, Record<string, AnswerValue>> = {};
  for (const section of Array.isArray(body.sections) ? body.sections : []) {
    if (!section || typeof section.testId !== "string") continue;
    extraAnswers[section.testId] = section.answers ?? {};
  }

  const loaded = await loadAndMaybeExpire(body.sessionId);
  if (loaded) {
    if (!canAccessSession(loaded.session, req)) {
      res.status(403).json({ error: "Нет доступа к этой сессии" });
      return;
    }
    if (loaded.expired) {
      res.json(loaded.result);
      return;
    }
    const now = new Date();
    const allowMerge = now.getTime() <= loaded.session.endsAt.getTime() + SUBMIT_GRACE_MS;
    res.status(201).json(await finalizeSession(loaded.session, extraAnswers, allowMerge));
    return;
  }

  const existing = await attempts().find({ sessionId: body.sessionId }).toArray();
  if (existing.length > 0) {
    res.json(await sessionPayload(body.sessionId, existing));
    return;
  }

  res.status(404).json({ error: "Сессия не найдена" });
});
