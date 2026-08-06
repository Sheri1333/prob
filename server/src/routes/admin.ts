import { Router } from "express";
import multer from "multer";
import { db } from "../db.js";
import { adminRequired, type AuthedRequest } from "../auth.js";
import { validateTestPayload, type Question } from "../scoring.js";
import {
  parsePdfBuffer,
  slugFromFilename,
  toTestQuestions,
  materializeQuestionImages,
} from "../pdfParser.js";

export const adminRouter = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15_000_000 },
});

adminRouter.use(adminRequired);

function upsertTest(payload: ReturnType<typeof validateTestPayload>) {
  const questionsJson = JSON.stringify(payload.questions);
  const questionCount = payload.questions.length;

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
    payload.id,
    payload.title,
    payload.titleKz,
    payload.section,
    payload.examType,
    payload.subject,
    payload.durationMinutes,
    questionCount,
    payload.isFree ? 1 : 0,
    payload.priceTenge ?? null,
    payload.description ?? "",
    questionsJson,
  );
}

adminRouter.get("/stats", (_req, res) => {
  const users = (
    db.prepare("SELECT COUNT(*) AS c FROM users WHERE role = 'user'").get() as {
      c: number;
    }
  ).c;
  const admins = (
    db.prepare("SELECT COUNT(*) AS c FROM users WHERE role = 'admin'").get() as {
      c: number;
    }
  ).c;
  const tests = (
    db.prepare("SELECT COUNT(*) AS c FROM tests").get() as { c: number }
  ).c;
  const attempts = (
    db.prepare("SELECT COUNT(*) AS c FROM attempts").get() as { c: number }
  ).c;
  const avgScore = (
    db
      .prepare(
        "SELECT ROUND(AVG(100.0 * score / max_score), 1) AS avg FROM attempts WHERE max_score > 0",
      )
      .get() as { avg: number | null }
  ).avg;

  const recentUsers = db
    .prepare(
      `SELECT id, email, name, role, created_at
       FROM users ORDER BY created_at DESC LIMIT 5`,
    )
    .all();

  const topAttempts = db
    .prepare(
      `SELECT a.id, a.score, a.max_score, a.finished_at,
              u.name AS user_name, u.email AS user_email,
              t.title AS test_title
       FROM attempts a
       JOIN users u ON u.id = a.user_id
       JOIN tests t ON t.id = a.test_id
       ORDER BY (1.0 * a.score / a.max_score) DESC, a.finished_at DESC
       LIMIT 10`,
    )
    .all();

  res.json({
    stats: {
      users,
      admins,
      tests,
      attempts,
      avgScorePercent: avgScore ?? 0,
    },
    recentUsers,
    topAttempts,
  });
});

adminRouter.get("/users", (_req, res) => {
  const rows = db
    .prepare(
      `SELECT u.id, u.email, u.name, u.role, u.created_at,
              COUNT(a.id) AS attempts_count,
              ROUND(AVG(CASE WHEN a.max_score > 0 THEN 100.0 * a.score / a.max_score END), 1) AS avg_percent
       FROM users u
       LEFT JOIN attempts a ON a.user_id = u.id
       GROUP BY u.id
       ORDER BY u.created_at DESC`,
    )
    .all();

  res.json({
    users: rows.map((r) => {
      const row = r as {
        id: number;
        email: string;
        name: string;
        role: string;
        created_at: string;
        attempts_count: number;
        avg_percent: number | null;
      };
      return {
        id: row.id,
        email: row.email,
        name: row.name,
        role: row.role,
        createdAt: row.created_at,
        attemptsCount: row.attempts_count,
        avgPercent: row.avg_percent,
      };
    }),
  });
});

adminRouter.get("/attempts", (req, res) => {
  const userId = req.query.userId ? Number(req.query.userId) : null;
  const testId = typeof req.query.testId === "string" ? req.query.testId : null;

  let sql = `
    SELECT a.id, a.user_id, a.test_id, a.score, a.max_score,
           a.started_at, a.finished_at, a.answers_json,
           u.name AS user_name, u.email AS user_email,
           t.title AS test_title, t.subject
    FROM attempts a
    JOIN users u ON u.id = a.user_id
    JOIN tests t ON t.id = a.test_id
    WHERE 1=1`;
  const params: (string | number)[] = [];

  if (userId) {
    sql += " AND a.user_id = ?";
    params.push(userId);
  }
  if (testId) {
    sql += " AND a.test_id = ?";
    params.push(testId);
  }
  sql += " ORDER BY a.finished_at DESC LIMIT 200";

  const rows = db.prepare(sql).all(...params);

  res.json({
    attempts: rows.map((r) => {
      const row = r as {
        id: number;
        user_id: number;
        test_id: string;
        score: number;
        max_score: number;
        started_at: string;
        finished_at: string;
        user_name: string;
        user_email: string;
        test_title: string;
        subject: string;
      };
      return {
        id: row.id,
        userId: row.user_id,
        testId: row.test_id,
        score: row.score,
        maxScore: row.max_score,
        startedAt: row.started_at,
        finishedAt: row.finished_at,
        userName: row.user_name,
        userEmail: row.user_email,
        testTitle: row.test_title,
        subject: row.subject,
      };
    }),
  });
});

adminRouter.get("/tests", (_req, res) => {
  const rows = db
    .prepare(
      `SELECT id, title, title_kz, section, exam_type, subject,
              duration_minutes, question_count, is_free, price_tenge,
              description, created_at, updated_at
       FROM tests ORDER BY updated_at DESC`,
    )
    .all();

  res.json({
    tests: rows.map((r) => {
      const row = r as {
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
        created_at: string;
        updated_at: string;
      };
      return {
        id: row.id,
        title: row.title,
        titleKz: row.title_kz,
        section: row.section,
        examType: row.exam_type,
        subject: row.subject,
        durationMinutes: row.duration_minutes,
        questionCount: row.question_count,
        isFree: Boolean(row.is_free),
        priceTenge: row.price_tenge,
        description: row.description,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      };
    }),
  });
});

adminRouter.get("/tests/:id", (req, res) => {
  const row = db
    .prepare("SELECT * FROM tests WHERE id = ?")
    .get(req.params.id) as
    | {
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
    | undefined;

  if (!row) {
    res.status(404).json({ error: "Тест не найден" });
    return;
  }

  res.json({
    test: {
      id: row.id,
      title: row.title,
      titleKz: row.title_kz,
      section: row.section,
      examType: row.exam_type,
      subject: row.subject,
      durationMinutes: row.duration_minutes,
      questionCount: row.question_count,
      isFree: Boolean(row.is_free),
      priceTenge: row.price_tenge,
      description: row.description,
      questions: JSON.parse(row.questions_json) as Question[],
    },
  });
});

adminRouter.post("/tests", (req: AuthedRequest, res) => {
  try {
    const payload = validateTestPayload(req.body);
    payload.questions = materializeQuestionImages(payload.id, payload.questions);
    upsertTest(payload);
    res.status(201).json({ ok: true, id: payload.id });
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : "Ошибка" });
  }
});

adminRouter.put("/tests/:id", (req: AuthedRequest, res) => {
  try {
    const payload = validateTestPayload({ ...req.body, id: req.params.id });
    const exists = db.prepare("SELECT id FROM tests WHERE id = ?").get(payload.id);
    if (!exists) {
      res.status(404).json({ error: "Тест не найден" });
      return;
    }
    payload.questions = materializeQuestionImages(payload.id, payload.questions);
    upsertTest(payload);
    res.json({ ok: true, id: payload.id });
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : "Ошибка" });
  }
});

adminRouter.delete("/tests/:id", (req, res) => {
  const result = db.prepare("DELETE FROM tests WHERE id = ?").run(req.params.id);
  if (result.changes === 0) {
    res.status(404).json({ error: "Тест не найден" });
    return;
  }
  res.json({ ok: true });
});

adminRouter.post("/tests/upload", upload.single("file"), (req, res) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: "Файл не загружен (field: file)" });
      return;
    }
    const text = req.file.buffer.toString("utf8");
    const json = JSON.parse(text) as unknown;
    const payload = validateTestPayload(json);
    upsertTest(payload);
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

/** Parse PDF → preview only (does not save). */
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

    const slug = slugFromFilename(req.file.originalname);
    const draft = {
      id: `ent-${slug}`,
      title: `ЕНТ — ${req.file.originalname.replace(/\.pdf$/i, "")}`,
      titleKz: `ҰБТ — ${req.file.originalname.replace(/\.pdf$/i, "")}`,
      section: "География",
      examType: "ENT",
      subject: "География",
      durationMinutes: 50,
      isFree: true,
      priceTenge: null as number | null,
      description: `Импорт из PDF «${req.file.originalname}». Правильные ответы ещё не заполнены.`,
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
