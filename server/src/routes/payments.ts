import { randomBytes } from "node:crypto";
import { Router, type Response } from "express";
import { ObjectId } from "mongodb";
import { authRequired, adminRequired, type AuthedRequest } from "../auth.js";
import {
  payments,
  toObjectId,
  users,
  type PaymentDoc,
  type PaymentPlan,
} from "../db.js";
import { rateLimit } from "../rateLimit.js";
import { getPricing, PLAN_SESSIONS } from "../settings.js";
import {
  answerTelegramCallback,
  bindCode,
  editPaymentCard,
  rememberTelegramAdmin,
  sendPaymentCard,
  sendTelegramText,
  telegramAdminIds,
  type TelegramUpdate,
} from "../telegram.js";

/**
 * Kaspi "Оплата услуги" has no callback. The student pays with the static QR /
 * Kaspi link, presses "Оплатить", and we ask an admin in Telegram to confirm.
 */
export const paymentsRouter = Router();

const MAX_PENDING = 3;

let missingAdminLogged = false;

const attemptLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  message: "Слишком много попыток оплаты. Попробуйте позже",
  key: (req) => (req as AuthedRequest).user?.id ?? req.ip ?? "unknown",
});

function publicPayment(doc: PaymentDoc) {
  return {
    id: doc._id.toHexString(),
    plan: doc.plan,
    sessions: doc.sessions,
    amountTenge: doc.amountTenge,
    payerName: doc.payerName,
    status: doc.status,
    vias: doc.vias ?? [],
    createdAt: doc.createdAt.toISOString(),
    decidedAt: doc.decidedAt?.toISOString() ?? null,
  };
}

function publicAttempt(doc: PaymentDoc) {
  return {
    ...publicPayment(doc),
    token: doc.token ?? "",
  };
}

function isPlan(value: unknown): value is PaymentPlan {
  return value === "single" || value === "bundle";
}

function readToken(value: unknown): string | null {
  const token = Array.isArray(value) ? value[0] : value;
  if (typeof token !== "string" || !/^[a-f0-9]{32}$/.test(token)) return null;
  return token;
}

function payerNameOf(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const name = value.trim().replace(/\s+/g, " ");
  if (name.length < 2 || name.length > 80) return null;
  return name;
}

function attemptText(
  user: { name: string; email: string },
  doc: PaymentDoc,
  statusLine?: string,
): string {
  const when = (doc.openedAt ?? doc.createdAt).toLocaleString("ru-RU", {
    timeZone: "Asia/Almaty",
  });
  const lines = [
    "Попытка оплаты",
    "",
    `Пользователь: ${user.name}`,
    `Почта: ${user.email}`,
    `Тариф: ${doc.plan === "single" ? "Полный ЕНТ" : "3 полных ЕНТ"} (${doc.sessions})`,
    `Сумма: ${doc.amountTenge.toLocaleString("ru-RU")} ₸`,
    `Имя в Kaspi: ${doc.payerName}`,
    `Время: ${when}`,
    "",
    statusLine ?? "Проверьте перевод в Kaspi и нажмите кнопку.",
  ];
  return lines.join("\n");
}

async function userLabel(doc: PaymentDoc): Promise<{ name: string; email: string }> {
  const user = await users().findOne(
    { _id: doc.userId },
    { projection: { name: 1, email: 1 } },
  );
  return {
    name: user?.name || doc.payerName,
    email: user?.email || "аккаунт не найден",
  };
}

/** Sends the card once. A parallel click waits on notifiedAt and does not send a second one. */
async function ensureNotified(id: ObjectId): Promise<void> {
  const claimed = await payments().findOneAndUpdate(
    {
      _id: id,
      status: "pending",
      notifiedAt: { $exists: false },
      $or: [{ telegramMessages: { $exists: false } }, { telegramMessages: { $size: 0 } }],
    },
    { $set: { notifiedAt: new Date() } },
    { returnDocument: "after" },
  );
  if (!claimed) return;
  if ((await telegramAdminIds()).length === 0) {
    await payments().updateOne({ _id: id }, { $unset: { notifiedAt: "" } });
    if (!missingAdminLogged) {
      missingAdminLogged = true;
      console.error("Telegram: попытка оплаты сохранена, администратор ещё не написал боту /start");
    }
    return;
  }
  try {
    const fresh = (await payments().findOne({ _id: id })) ?? claimed;
    const text = attemptText(await userLabel(fresh), fresh);
    const messages = await sendPaymentCard(text, fresh._id.toHexString());
    if (messages.length === 0) {
      await payments().updateOne({ _id: id }, { $unset: { notifiedAt: "" } });
      return;
    }
    await payments().updateOne({ _id: id }, { $set: { telegramMessages: messages } });
  } catch (err) {
    console.error("Telegram notify:", err instanceof Error ? err.message : err);
    await payments().updateOne({ _id: id }, { $unset: { notifiedAt: "" } });
  }
}

async function refreshTelegram(doc: PaymentDoc, statusLine?: string): Promise<void> {
  if (!doc.telegramMessages?.length) return;
  await editPaymentCard(
    doc.telegramMessages,
    attemptText(await userLabel(doc), doc, statusLine),
    statusLine ? null : doc._id.toHexString(),
  );
}

async function notifyUnsentPending(): Promise<void> {
  const list = await payments()
    .find({
      status: "pending",
      $or: [{ telegramMessages: { $exists: false } }, { telegramMessages: { $size: 0 } }],
    })
    .sort({ createdAt: -1 })
    .limit(15)
    .toArray();
  for (const doc of list) {
    await payments().updateOne({ _id: doc._id }, { $unset: { notifiedAt: "" } });
    await ensureNotified(doc._id);
  }
}

export async function applyDecision(
  id: ObjectId,
  status: "confirmed" | "rejected",
  decidedVia: "admin" | "telegram",
  decidedBy: ObjectId | null,
): Promise<PaymentDoc | "missing" | "done"> {
  const updated = await payments().findOneAndUpdate(
    { _id: id, status: "pending" },
    {
      $set: {
        status,
        decidedAt: new Date(),
        decidedVia,
        ...(decidedBy ? { decidedBy } : {}),
      },
    },
    { returnDocument: "after" },
  );
  if (!updated) {
    const existing = await payments().findOne({ _id: id }, { projection: { _id: 1 } });
    return existing ? "done" : "missing";
  }
  if (status === "confirmed") {
    await users().updateOne({ _id: updated.userId }, { $inc: { examCredits: updated.sessions } });
  }
  const line =
    status === "confirmed"
      ? `Подтверждено. Начислено попыток ЕНТ: ${updated.sessions}`
      : "Отклонено. Перевод не засчитан.";
  await refreshTelegram(updated, line);
  return updated;
}

paymentsRouter.get("/me", authRequired, async (req: AuthedRequest, res) => {
  const userId = new ObjectId(req.user!.id);
  const [row, list] = await Promise.all([
    users().findOne({ _id: userId }, { projection: { examCredits: 1 } }),
    payments()
      .find({ userId, status: { $ne: "prepared" } })
      .sort({ createdAt: -1 })
      .limit(20)
      .toArray(),
  ]);
  res.json({
    credits: row?.examCredits ?? 0,
    unlimited: req.user!.role === "admin",
    requests: list.map(publicPayment),
  });
});

/** Creates a pending payment and notifies Telegram when the student presses pay. */
paymentsRouter.post("/attempt", authRequired, attemptLimiter, async (req: AuthedRequest, res) => {
  const body = (req.body ?? {}) as { plan?: unknown; payerName?: unknown };
  if (!isPlan(body.plan)) {
    res.status(400).json({ error: "Выберите тариф" });
    return;
  }
  const payerName = payerNameOf(body.payerName) ?? payerNameOf(req.user!.name);
  if (!payerName) {
    res.status(400).json({ error: "Укажите имя, которое вы введёте в Kaspi" });
    return;
  }

  const userId = new ObjectId(req.user!.id);
  const existing = await payments().findOne(
    { userId, plan: body.plan, status: "pending" },
    { sort: { createdAt: -1 } },
  );
  if (existing) {
    if (existing.payerName !== payerName) {
      const updated = await payments().findOneAndUpdate(
        { _id: existing._id, status: "pending" },
        { $set: { payerName } },
        { returnDocument: "after" },
      );
      if (updated?.telegramMessages?.length) await refreshTelegram(updated);
      res.json(publicAttempt(updated ?? existing));
      return;
    }
    res.json(publicAttempt(existing));
    return;
  }

  const pending = await payments().countDocuments({ userId, status: "pending" });
  if (pending >= MAX_PENDING) {
    res.status(429).json({
      error: "У вас уже есть неподтверждённые оплаты. Дождитесь проверки",
    });
    return;
  }

  const pricing = await getPricing();
  const now = new Date();
  const doc: PaymentDoc = {
    _id: new ObjectId(),
    userId,
    plan: body.plan,
    sessions: PLAN_SESSIONS[body.plan],
    amountTenge: body.plan === "single" ? pricing.singlePriceTenge : pricing.bundlePriceTenge,
    payerName,
    status: "pending",
    token: randomBytes(16).toString("hex"),
    vias: ["link"],
    openedAt: now,
    createdAt: now,
  };
  await payments().insertOne(doc);
  await ensureNotified(doc._id);
  res.status(201).json(publicAttempt(doc));
});

paymentsRouter.get("/attempt/:token", authRequired, async (req: AuthedRequest, res) => {
  const token = readToken(req.params.token);
  if (!token) {
    res.status(404).json({ error: "Оплата не найдена" });
    return;
  }
  const doc = await payments().findOne({
    token,
    userId: new ObjectId(req.user!.id),
  });
  if (!doc) {
    res.status(404).json({ error: "Оплата не найдена" });
    return;
  }
  res.json(publicAttempt(doc));
});

paymentsRouter.get("/pending/:plan", authRequired, async (req: AuthedRequest, res) => {
  if (!isPlan(req.params.plan)) {
    res.status(400).json({ error: "Выберите тариф" });
    return;
  }
  const doc = await payments().findOne(
    {
      userId: new ObjectId(req.user!.id),
      plan: req.params.plan,
      status: "pending",
    },
    { sort: { createdAt: -1 } },
  );
  res.json({ attempt: doc ? publicAttempt(doc) : null });
});

/* ---------- Admin: /api/admin/payments is mounted from here ---------- */

export const adminPaymentsRouter = Router();
adminPaymentsRouter.use(adminRequired);

adminPaymentsRouter.get("/", async (req, res) => {
  const status = req.query.status === "all" ? null : "pending";
  const list = await payments()
    .find(status ? { status } : { status: { $ne: "prepared" } })
    .sort({ createdAt: -1 })
    .limit(200)
    .toArray();
  const ownerIds = [...new Set(list.map((p) => p.userId.toHexString()))];
  const owners = await users()
    .find(
      { _id: { $in: ownerIds.map((id) => new ObjectId(id)) } },
      { projection: { name: 1, email: 1, examCredits: 1 } },
    )
    .toArray();
  const byId = new Map(owners.map((u) => [u._id.toHexString(), u]));
  res.json({
    payments: list.map((p) => {
      const owner = byId.get(p.userId.toHexString());
      return {
        ...publicPayment(p),
        user: owner
          ? {
              id: owner._id.toHexString(),
              name: owner.name,
              email: owner.email,
              credits: owner.examCredits ?? 0,
            }
          : null,
      };
    }),
  });
});

async function decide(
  req: AuthedRequest,
  res: Response,
  status: "confirmed" | "rejected",
) {
  const id = toObjectId(String(req.params.id));
  if (!id) {
    res.status(404).json({ error: "Оплата не найдена" });
    return;
  }
  const updated = await applyDecision(id, status, "admin", new ObjectId(req.user!.id));
  if (updated === "missing") {
    res.status(404).json({ error: "Оплата не найдена" });
    return;
  }
  if (updated === "done") {
    res.status(409).json({ error: "Эта оплата уже обработана" });
    return;
  }
  res.json(publicPayment(updated));
}

adminPaymentsRouter.post("/:id/confirm", (req: AuthedRequest, res) => decide(req, res, "confirmed"));
adminPaymentsRouter.post("/:id/reject", (req: AuthedRequest, res) => decide(req, res, "rejected"));

export async function handleTelegramUpdate(update: TelegramUpdate): Promise<void> {
  if (update.callback_query) {
    await onPaymentCallback(update.callback_query);
    return;
  }
  const message = update.message;
  if (!message?.text || message.chat.type !== "private") return;
  const text = message.text.trim();
  if (!text.startsWith("/start")) return;

  const code = bindCode();
  const given = text.slice("/start".length).trim();
  if (!code) {
    await sendTelegramText(message.chat.id, "Бот не принимает подключения: на сервере не задан код.");
    return;
  }
  if (await isTelegramAdmin(message.chat.id)) {
    await sendTelegramText(
      message.chat.id,
      "Уже подключено. Сюда будут приходить попытки оплаты с кнопками подтверждения.",
    );
    return;
  }
  if (given !== code) {
    await sendTelegramText(message.chat.id, "Код не подошёл. Подключение: /start и код с сервера.");
    return;
  }
  await rememberTelegramAdmin(message.chat.id);
  await sendTelegramText(
    message.chat.id,
    "Готово. Когда ученик нажмёт «Оплатить», сюда придёт попытка оплаты.",
  );
  await notifyUnsentPending();
}

async function onPaymentCallback(query: NonNullable<TelegramUpdate["callback_query"]>): Promise<void> {
  if (!(await isTelegramAdmin(query.from.id))) {
    await answerTelegramCallback(query.id, "Только для подключённого администратора");
    return;
  }
  const match = /^(ok|no):([a-f0-9]{24})$/.exec(query.data ?? "");
  if (!match) {
    await answerTelegramCallback(query.id, "Кнопка устарела");
    return;
  }
  const id = toObjectId(match[2]);
  if (!id) {
    await answerTelegramCallback(query.id, "Оплата не найдена");
    return;
  }
  const status = match[1] === "ok" ? "confirmed" : "rejected";
  const updated = await applyDecision(id, status, "telegram", null);
  if (updated === "missing") {
    await answerTelegramCallback(query.id, "Оплата не найдена");
    return;
  }
  if (updated === "done") {
    await answerTelegramCallback(query.id, "Уже обработано");
    return;
  }
  await answerTelegramCallback(query.id, status === "confirmed" ? "Подтверждено" : "Отклонено");
}

function isTelegramAdmin(chatId: number): Promise<boolean> {
  return telegramAdminIds().then((ids) => ids.includes(chatId));
}
