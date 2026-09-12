import { Router } from "express";
import multer from "multer";
import { ObjectId } from "mongodb";
import { attempts, tests, toObjectId, users } from "../db.js";
import { adminRequired, type AuthedRequest } from "../auth.js";
import { validateTestPayload, type Question } from "../scoring.js";
import { persistCoverImage, persistQuestionImages, storeImage } from "../gridfs.js";
import { parsePdfBuffer, toTestQuestions } from "../pdfParser.js";
import { isUuid, newTestId } from "../ids.js";
import { getPricing, savePricing } from "../settings.js";
import { buildEntPoolCoverage } from "../ent.js";
import { applyAnswerKeys, parseAnswerKeyText } from "../answerKeys.js";
import {
  createEmailCampaign,
  getBrevoStatus,
  isBrevoConfigured,
  sendCampaignNow,
  sendSmtpEmail,
} from "../brevo.js";
import { asEmailHtml, syncUserToBrevo } from "../mail.js";

export const adminRouter = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15_000_000 },
});

const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8_000_000 },
  fileFilter: (_req, file, cb) => {
    if (/^image\/(jpeg|png|webp|gif)$/i.test(file.mimetype)) {
      cb(null, true);
      return;
    }
    cb(new Error("Нужно изображение JPEG, PNG, WebP или GIF"));
  },
});

adminRouter.use(adminRequired);

adminRouter.get("/pricing", async (_req, res) => {
  res.json(await getPricing());
});

adminRouter.put("/pricing", async (req, res) => {
  try {
    const body = (req.body ?? {}) as {
      trialEnabled?: boolean;
      singlePriceTenge?: number;
      bundlePriceTenge?: number;
    };
    res.json(await savePricing(body));
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : "Ошибка сохранения цен" });
  }
});

adminRouter.get("/pool", async (_req, res) => {
  const rows = await tests().find().toArray();
  res.json(buildEntPoolCoverage(rows));
});

function toBrevoSchedule(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(+date)) throw new Error("Некорректная дата отправки");
  return date
    .toLocaleString("sv-SE", { timeZone: "Asia/Almaty" })
    .replace("T", " ");
}

adminRouter.get("/email", async (_req, res) => {
  if (!isBrevoConfigured()) {
    res.json({ configured: false });
    return;
  }
  try {
    res.json(await getBrevoStatus());
  } catch (e) {
    res.json({
      configured: true,
      error: e instanceof Error ? e.message : "Ошибка Brevo",
    });
  }
});

adminRouter.post("/email/test", async (req: AuthedRequest, res) => {
  if (!isBrevoConfigured()) {
    res.status(503).json({ error: "BREVO_API_KEY не задан" });
    return;
  }
  const to =
    typeof req.body?.email === "string" && req.body.email.trim()
      ? req.body.email.trim()
      : req.user?.email;
  if (!to) {
    res.status(400).json({ error: "email обязателен" });
    return;
  }
  try {
    await sendSmtpEmail({
      to: { email: to, name: req.user?.name },
      subject: "Talapker · тест Brevo",
      tags: ["admin-test"],
      html: asEmailHtml(
        "Brevo подключен",
        "<p>Это тестовое письмо от Талапкер. Транзакционная почта работает.</p>",
      ),
    });
    res.json({ ok: true, to });
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : "Не отправилось" });
  }
});

adminRouter.post("/email/sync", async (_req, res) => {
  if (!isBrevoConfigured()) {
    res.status(503).json({ error: "BREVO_API_KEY не задан" });
    return;
  }
  const rows = await users().find().project({ email: 1, name: 1 }).toArray();
  let synced = 0;
  const errors: string[] = [];
  for (const row of rows) {
    try {
      await syncUserToBrevo(row.email, row.name);
      synced += 1;
    } catch (e) {
      errors.push(
        `${row.email}: ${e instanceof Error ? e.message : "ошибка"}`,
      );
    }
  }
  res.json({ ok: errors.length === 0, synced, total: rows.length, errors });
});

adminRouter.post("/email/campaign", async (req, res) => {
  if (!isBrevoConfigured()) {
    res.status(503).json({ error: "BREVO_API_KEY не задан" });
    return;
  }
  const body = (req.body ?? {}) as {
    name?: string;
    subject?: string;
    htmlContent?: string;
    scheduledAt?: string | null;
    sendNow?: boolean;
  };
  const subject = body.subject?.trim() ?? "";
  const htmlContent = body.htmlContent?.trim() ?? "";
  if (!subject || !htmlContent) {
    res.status(400).json({ error: "subject и htmlContent обязательны" });
    return;
  }
  try {
    const campaign = await createEmailCampaign({
      name: body.name?.trim() || subject,
      subject,
      htmlContent: asEmailHtml(subject, htmlContent),
      scheduledAt: body.scheduledAt ? toBrevoSchedule(body.scheduledAt) : null,
    });
    if (body.sendNow !== false && !body.scheduledAt) {
      await sendCampaignNow(campaign.id);
    }
    res.status(201).json({ ok: true, id: campaign.id });
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : "Кампания не создана" });
  }
});

async function resolveTestId(requested: string): Promise<string> {
  const existing = await tests().findOne({ _id: requested });
  if (existing) return requested;
  return isUuid(requested) ? requested : newTestId();
}

async function upsertTest(payload: ReturnType<typeof validateTestPayload>) {
  const now = new Date();
  const existing = await tests().findOne({ _id: payload.id });
  await tests().updateOne(
    { _id: payload.id },
    {
      $set: {
        title: payload.titleKz,
        titleKz: payload.titleKz,
        section: payload.section,
        examType: "ENT",
        subject: payload.subject,
        durationMinutes: payload.durationMinutes,
        questionCount: payload.questions.length,
        isFree: true,
        priceTenge: null,
        description: payload.description ?? "",
        coverImage: payload.coverImage ?? "",
        questions: payload.questions,
        updatedAt: now,
      },
      $setOnInsert: {
        createdAt: now,
      },
    },
    { upsert: true },
  );
  return existing;
}

adminRouter.get("/stats", async (_req, res) => {
  const [userCount, adminCount, testCount, attemptCount, avgAgg, recentUsers, topAttempts] =
    await Promise.all([
      users().countDocuments(),
      users().countDocuments({ role: "admin" }),
      tests().countDocuments(),
      attempts().countDocuments(),
      attempts()
        .aggregate<{ avg: number | null }>([
          { $match: { maxScore: { $gt: 0 } } },
          {
            $group: {
              _id: null,
              avg: { $avg: { $multiply: [{ $divide: ["$score", "$maxScore"] }, 100] } },
            },
          },
        ])
        .toArray(),
      users().find().sort({ createdAt: -1 }).limit(5).toArray(),
      attempts()
        .aggregate([
          { $match: { maxScore: { $gt: 0 } } },
          {
            $addFields: {
              ratio: { $divide: ["$score", "$maxScore"] },
            },
          },
          { $sort: { ratio: -1, finishedAt: -1 } },
          { $limit: 10 },
        ])
        .toArray(),
    ]);

  const userIds = topAttempts
    .map((a) => a.userId)
    .filter((id): id is ObjectId => id instanceof ObjectId);
  const testIds = topAttempts.map((a) => a.testId as string);
  const [userDocs, testDocs] = await Promise.all([
    userIds.length
      ? users().find({ _id: { $in: userIds } }).toArray()
      : Promise.resolve([]),
    testIds.length
      ? tests().find({ _id: { $in: testIds } }).toArray()
      : Promise.resolve([]),
  ]);
  const userMap = new Map(userDocs.map((u) => [u._id.toHexString(), u]));
  const testMap = new Map(testDocs.map((t) => [t._id, t]));

  res.json({
    stats: {
      users: userCount,
      admins: adminCount,
      tests: testCount,
      attempts: attemptCount,
      avgScorePercent: Math.round((avgAgg[0]?.avg ?? 0) * 10) / 10,
    },
    recentUsers: recentUsers.map((u) => ({
      id: u._id.toHexString(),
      email: u.email,
      name: u.name,
      role: u.role,
      created_at: u.createdAt.toISOString(),
    })),
    topAttempts:     topAttempts.map((a) => {
      const uid = a.userId instanceof ObjectId ? a.userId.toHexString() : "";
      const u = uid ? userMap.get(uid) : undefined;
      const t = testMap.get(a.testId as string);
      return {
        id: (a._id as ObjectId).toHexString(),
        score: a.score,
        max_score: a.maxScore,
        finished_at: (a.finishedAt as Date).toISOString(),
        user_name: u?.name ?? "Гость",
        user_email: u?.email ?? "",
        test_title: t?.title ?? a.testId,
      };
    }),
  });
});

adminRouter.get("/users", async (_req, res) => {
  const rows = await users()
    .aggregate([
      { $sort: { createdAt: -1 } },
      {
        $lookup: {
          from: "attempts",
          localField: "_id",
          foreignField: "userId",
          as: "attempts",
        },
      },
      {
        $addFields: {
          attemptsCount: { $size: "$attempts" },
          avgPercent: {
            $avg: {
              $map: {
                input: {
                  $filter: {
                    input: "$attempts",
                    as: "a",
                    cond: { $gt: ["$$a.maxScore", 0] },
                  },
                },
                as: "a",
                in: {
                  $multiply: [{ $divide: ["$$a.score", "$$a.maxScore"] }, 100],
                },
              },
            },
          },
        },
      },
      { $project: { attempts: 0, passwordHash: 0 } },
    ])
    .toArray();

  res.json({
    users: rows.map((row) => ({
      id: (row._id as ObjectId).toHexString(),
      email: row.email,
      name: row.name,
      role: row.role,
      createdAt: (row.createdAt as Date).toISOString(),
      attemptsCount: row.attemptsCount ?? 0,
      avgPercent:
        typeof row.avgPercent === "number"
          ? Math.round(row.avgPercent * 10) / 10
          : null,
    })),
  });
});

adminRouter.get("/attempts", async (req, res) => {
  const userIdRaw = typeof req.query.userId === "string" ? req.query.userId : null;
  const testId = typeof req.query.testId === "string" ? req.query.testId : null;

  const filter: Record<string, unknown> = {};
  if (userIdRaw) {
    const oid = toObjectId(userIdRaw);
    if (oid) filter.userId = oid;
  }
  if (testId) filter.testId = testId;

  const rows = await attempts()
    .find(filter)
    .sort({ finishedAt: -1 })
    .limit(200)
    .toArray();

  const userIds = [
    ...new Set(
      rows
        .map((r) => r.userId)
        .filter((id): id is ObjectId => id instanceof ObjectId)
        .map((id) => id.toHexString()),
    ),
  ].map((id) => new ObjectId(id));
  const testIds = [...new Set(rows.map((r) => r.testId))];
  const [userDocs, testDocs] = await Promise.all([
    userIds.length ? users().find({ _id: { $in: userIds } }).toArray() : [],
    testIds.length ? tests().find({ _id: { $in: testIds } }).toArray() : [],
  ]);
  const userMap = new Map(userDocs.map((u) => [u._id.toHexString(), u]));
  const testMap = new Map(testDocs.map((t) => [t._id, t]));

  res.json({
    attempts: rows.map((row) => {
      const u = row.userId ? userMap.get(row.userId.toHexString()) : undefined;
      const t = testMap.get(row.testId);
      return {
        id: row._id.toHexString(),
        userId: row.userId?.toHexString() ?? "",
        testId: row.testId,
        score: row.score,
        maxScore: row.maxScore,
        startedAt: row.startedAt.toISOString(),
        finishedAt: row.finishedAt.toISOString(),
        userName: u?.name ?? "Гость",
        userEmail: u?.email ?? "—",
        testTitle: t?.titleKz || t?.title || row.testId,
        subject: t?.subject ?? "",
      };
    }),
  });
});

adminRouter.get("/tests", async (_req, res) => {
  const rows = await tests().find().sort({ updatedAt: -1 }).toArray();
  res.json({
    tests: rows.map((row) => ({
      id: row._id,
      title: row.title,
      titleKz: row.titleKz,
      section: row.section,
      examType: row.examType,
      subject: row.subject,
      durationMinutes: row.durationMinutes,
      questionCount: row.questionCount,
      isFree: row.isFree !== false,
      priceTenge: row.priceTenge,
      description: row.description,
      coverImage: row.coverImage ?? "",
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    })),
  });
});

adminRouter.get("/tests/:id", async (req, res) => {
  const row = await tests().findOne({ _id: req.params.id });
  if (!row) {
    res.status(404).json({ error: "Тест не найден" });
    return;
  }

  res.json({
    test: {
      id: row._id,
      title: row.title,
      titleKz: row.titleKz,
      section: row.section,
      examType: row.examType,
      subject: row.subject,
      durationMinutes: row.durationMinutes,
      questionCount: row.questionCount,
      isFree: row.isFree !== false,
      priceTenge: row.priceTenge,
      description: row.description,
      coverImage: row.coverImage ?? "",
      questions: row.questions as Question[],
    },
  });
});

adminRouter.post("/tests", async (req: AuthedRequest, res) => {
  try {
    const payload = validateTestPayload(req.body);
    payload.id = await resolveTestId(payload.id);
    payload.coverImage = await persistCoverImage(payload.coverImage);
    payload.questions = await persistQuestionImages(payload.questions);
    await upsertTest(payload);
    res.status(201).json({ ok: true, id: payload.id });
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : "Ошибка" });
  }
});

adminRouter.put("/tests/:id", async (req: AuthedRequest, res) => {
  try {
    const payload = validateTestPayload({ ...req.body, id: req.params.id });
    const exists = await tests().findOne({ _id: payload.id });
    if (!exists) {
      res.status(404).json({ error: "Тест не найден" });
      return;
    }
    payload.coverImage = await persistCoverImage(payload.coverImage);
    payload.questions = await persistQuestionImages(payload.questions);
    await upsertTest(payload);
    res.json({ ok: true, id: payload.id });
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : "Ошибка" });
  }
});

adminRouter.delete("/tests/:id", async (req, res) => {
  const result = await tests().deleteOne({ _id: req.params.id });
  if (result.deletedCount === 0) {
    res.status(404).json({ error: "Тест не найден" });
    return;
  }
  await attempts().deleteMany({ testId: req.params.id });
  res.json({ ok: true });
});

adminRouter.post("/tests/:id/keys", async (req, res) => {
  const row = await tests().findOne({ _id: req.params.id });
  if (!row) {
    res.status(404).json({ error: "Тест не найден" });
    return;
  }
  const body = (req.body ?? {}) as { text?: string; keys?: unknown };
  const source =
    typeof body.text === "string" && body.text.trim()
      ? body.text
      : body.keys != null
        ? JSON.stringify(body.keys)
        : "";
  const parsed = parseAnswerKeyText(source);
  if (parsed.length === 0) {
    res.status(400).json({ error: "Не удалось разобрать ключи" });
    return;
  }
  const applied = applyAnswerKeys(row.questions as Question[], parsed);
  await tests().updateOne(
    { _id: row._id },
    {
      $set: {
        questions: applied.questions,
        updatedAt: new Date(),
      },
    },
  );
  res.json({
    ok: true,
    id: row._id,
    applied: applied.applied,
    skipped: applied.skipped,
    keyed: applied.applied.length,
    total: applied.questions.length,
  });
});

adminRouter.post("/keys", async (req, res) => {
  const body = (req.body ?? {}) as {
    text?: string;
    items?: Array<{ testId?: string; text?: string; keys?: unknown }>;
  };

  const items: Array<{ testId: string; source: string }> = [];
  if (Array.isArray(body.items)) {
    for (const item of body.items) {
      if (!item?.testId) continue;
      const source =
        typeof item.text === "string" && item.text.trim()
          ? item.text
          : item.keys != null
            ? JSON.stringify(item.keys)
            : "";
      if (source.trim()) items.push({ testId: item.testId, source });
    }
  } else if (typeof body.text === "string" && body.text.trim()) {
    try {
      const parsed = JSON.parse(body.text) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        for (const [testId, value] of Object.entries(
          parsed as Record<string, unknown>,
        )) {
          const source =
            typeof value === "string" ? value : JSON.stringify(value);
          items.push({ testId, source });
        }
      }
    } catch {
      res.status(400).json({
        error:
          "Нужен JSON вида { \"id-теста\": \"1-A 2-B\", ... } или массив items",
      });
      return;
    }
  }

  if (items.length === 0) {
    res.status(400).json({ error: "Нет ключей для импорта" });
    return;
  }

  const results = [];
  for (const item of items) {
    const row = await tests().findOne({ _id: item.testId });
    if (!row) {
      results.push({
        testId: item.testId,
        ok: false,
        error: "Тест не найден",
      });
      continue;
    }
    const parsed = parseAnswerKeyText(item.source);
    if (parsed.length === 0) {
      results.push({
        testId: item.testId,
        title: row.titleKz || row.title,
        ok: false,
        error: "Не удалось разобрать ключи",
      });
      continue;
    }
    const applied = applyAnswerKeys(row.questions as Question[], parsed);
    await tests().updateOne(
      { _id: row._id },
      { $set: { questions: applied.questions, updatedAt: new Date() } },
    );
    results.push({
      testId: item.testId,
      title: row.titleKz || row.title,
      ok: true,
      applied: applied.applied.length,
      skipped: applied.skipped,
      total: applied.questions.length,
    });
  }

  res.json({
    ok: results.every((r) => r.ok),
    imported: results.filter((r) => r.ok).length,
    results,
  });
});

adminRouter.post("/tests/:id/duplicate", async (req, res) => {
  const row = await tests().findOne({ _id: req.params.id });
  if (!row) {
    res.status(404).json({ error: "Тест не найден" });
    return;
  }
  const newId = newTestId();
  const now = new Date();
  const questions = JSON.parse(JSON.stringify(row.questions)) as Question[];
  await tests().insertOne({
    _id: newId,
    title: /көшірме/i.test(row.titleKz)
      ? row.titleKz
      : `${row.titleKz} (көшірме)`,
    titleKz: /көшірме/i.test(row.titleKz)
      ? row.titleKz
      : `${row.titleKz} (көшірме)`,
    section: row.section,
    examType: "ENT",
    subject: row.subject,
    durationMinutes: row.durationMinutes,
    questionCount: questions.length,
    isFree: true,
    priceTenge: null,
    description: row.description ?? "",
    coverImage: row.coverImage ?? "",
    questions,
    createdAt: now,
    updatedAt: now,
  });
  res.status(201).json({ ok: true, id: newId });
});

adminRouter.post("/files", (req, res, next) => {
  imageUpload.single("file")(req, res, (err: unknown) => {
    if (err) {
      res.status(400).json({
        error: err instanceof Error ? err.message : "Ошибка загрузки",
      });
      return;
    }
    next();
  });
}, async (req, res) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: "Файл не загружен (field: file)" });
      return;
    }
    const kind = req.body?.kind === "cover" ? "cover" : "question";
    const stored = await storeImage({
      buffer: req.file.buffer,
      filename: req.file.originalname || "image",
      contentType: req.file.mimetype,
      metadata: { kind },
    });
    res.status(201).json(stored);
  } catch (e) {
    res.status(400).json({
      error: e instanceof Error ? e.message : "Ошибка загрузки",
    });
  }
});

adminRouter.post("/tests/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: "Файл не загружен (field: file)" });
      return;
    }
    const text = req.file.buffer.toString("utf8");
    const json = JSON.parse(text) as unknown;
    const payload = validateTestPayload(json);
    payload.id = await resolveTestId(payload.id);
    payload.coverImage = await persistCoverImage(payload.coverImage);
    payload.questions = await persistQuestionImages(payload.questions);
    await upsertTest(payload);
    res.status(201).json({
      ok: true,
      id: payload.id,
      questionCount: payload.questions.length,
    });
  } catch (e) {
    res.status(400).json({
      error: e instanceof Error ? e.message : "Некорректный JSON",
    });
  }
});

adminRouter.post("/tests/parse-pdf", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: "Файл не загружен (field: file)" });
      return;
    }
    if (!/\.pdf$/i.test(req.file.originalname) && req.file.mimetype !== "application/pdf") {
      res.status(400).json({ error: "Нужен PDF-файл" });
      return;
    }

    const parsed = await parsePdfBuffer(req.file.buffer);
    if (parsed.questions.length === 0) {
      res.status(400).json({
        error:
          "Не удалось распознать вопросы. Проверьте, что PDF текстовый (не скан).",
      });
      return;
    }

    const draft = {
      id: newTestId(),
      title: `ҰБТ — ${req.file.originalname.replace(/\.pdf$/i, "")}`,
      titleKz: `ҰБТ — ${req.file.originalname.replace(/\.pdf$/i, "")}`,
      section: "География",
      examType: "ENT",
      subject: "География",
      durationMinutes: 50,
      isFree: true,
      priceTenge: null as number | null,
      description: `Импорт из PDF «${req.file.originalname}». Ключи ответов отмечаются вручную в админке.`,
      questions: toTestQuestions(parsed.questions),
    };

    res.json({
      ok: true,
      filename: req.file.originalname,
      parse: parsed,
      draft,
    });
  } catch (e) {
    console.error(e);
    res.status(400).json({
      error: e instanceof Error ? e.message : "Ошибка разбора PDF",
    });
  }
});
