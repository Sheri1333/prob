import { randomBytes } from "node:crypto";
import { Router, type Request, type Response } from "express";
import { ObjectId } from "mongodb";
import QRCode from "qrcode";
import { authRequired, adminRequired, type AuthedRequest } from "../auth.js";
import {
  payments,
  toObjectId,
  users,
  type PaymentDoc,
  type PaymentPlan,
  type PaymentVia,
} from "../db.js";
import { publicAppUrl } from "../brevo.js";
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
 * Kaspi QR "Оплата услуги" sends no callback. The student opens a redirect we
 * issued (link or personal QR); that visit becomes a pending attempt and a
 * Telegram message. An admin confirms it in Telegram or in the admin page.
 */
export const paymentsRouter = Router();

const MAX_PENDING = 3;
const KASPI_PAY_URL =
  "https://kaspi.kz/pay/CoursesUniversal?region_id=18&subservice_id=26536";

let missingAdminLogged = false;

const attemptLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 30,
  message: "Слишком много попыток оплаты. Попробуйте позже",
  key: (req) => (req as AuthedRequest).user?.id ?? req.ip ?? "unknown",
});

const goLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 60,
  message: "Слишком много переходов. Подождите и откройте ссылку снова",
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
    linkUrl: doc.token ? goUrl(doc.token, "link") : "",
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

function goUrl(token: string, via: PaymentVia): string {
  return `${publicAppUrl()}/api/payments/go/${token}?via=${via}`;
}

function payerNameOf(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const name = value.trim().replace(/\s+/g, " ");
  if (name.length < 2 || name.length > 80) return null;
  return name;
}

function viaLabel(vias: PaymentVia[]): string {
  const link = vias.includes("link");
  const qr = vias.includes("qr");
  if (link && qr) return "ссылка и QR";
  if (qr) return "QR";
  if (link) return "ссылка";
  return "ещё не открывал Kaspi";
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
    `Переход: ${viaLabel(doc.vias ?? [])}`,
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
    const after = await payments().findOne({ _id: id });
    if (after && viaLabel(after.vias ?? []) !== viaLabel(fresh.vias ?? [])) {
      await editPaymentCard(
        messages,
        attemptText(await userLabel(after), after),
        after._id.toHexString(),
      );
    }
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

function isPrefetch(req: Request): boolean {
  const purpose = [req.get("Purpose"), req.get("Sec-Purpose"), req.get("X-Purpose"), req.get("X-Moz")]
    .join(" ")
    .toLowerCase();
  return purpose.includes("prefetch") || purpose.includes("preview");
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

paymentsRouter.post("/attempt", authRequired, attemptLimiter, async (req: AuthedRequest, res) => {
  const body = (req.body ?? {}) as { plan?: unknown };
  if (!isPlan(body.plan)) {
    res.status(400).json({ error: "Выберите тариф" });
    return;
  }
  const userId = new ObjectId(req.user!.id);
  const existing = await payments().findOne(
    { userId, plan: body.plan, status: { $in: ["prepared", "pending"] } },
    { sort: { createdAt: -1 } },
  );
  if (existing) {
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
  const doc: PaymentDoc = {
    _id: new ObjectId(),
    userId,
    plan: body.plan,
    sessions: PLAN_SESSIONS[body.plan],
    amountTenge: body.plan === "single" ? pricing.singlePriceTenge : pricing.bundlePriceTenge,
    payerName: req.user!.name,
    status: "prepared",
    token: randomBytes(16).toString("hex"),
    createdAt: new Date(),
  };
  await payments().insertOne(doc);
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

paymentsRouter.patch("/attempt/:token", authRequired, async (req: AuthedRequest, res) => {
  const token = readToken(req.params.token);
  const payerName = payerNameOf((req.body ?? {}).payerName);
  if (!token || !payerName) {
    res.status(400).json({ error: "Укажите имя, которое вы введёте в Kaspi" });
    return;
  }
  const updated = await payments().findOneAndUpdate(
    {
      token,
      userId: new ObjectId(req.user!.id),
      status: { $in: ["prepared", "pending"] },
    },
    { $set: { payerName } },
    { returnDocument: "after" },
  );
  if (!updated) {
    res.status(409).json({ error: "Эту оплату уже нельзя изменить" });
    return;
  }
  if (updated.telegramMessages?.length) {
    await refreshTelegram(updated);
  }
  res.json(publicAttempt(updated));
});

paymentsRouter.get("/qr/:token", async (req, res) => {
  const token = readToken(req.params.token);
  if (!token) {
    res.status(404).end();
    return;
  }
  const doc = await payments().findOne({ token }, { projection: { token: 1 } });
  if (!doc?.token) {
    res.status(404).end();
    return;
  }
  const png = await QRCode.toBuffer(goUrl(doc.token, "qr"), {
    type: "png",
    width: 560,
    margin: 1,
    errorCorrectionLevel: "M",
  });
  res.setHeader("Cache-Control", "private, max-age=3600");
  res.type("png").send(png);
});

paymentsRouter.get("/go/:token", goLimiter, async (req, res) => {
  const token = readToken(req.params.token);
  if (!token) {
    res.status(404).type("text").send("Ссылка не найдена");
    return;
  }
  if (req.method === "HEAD" || isPrefetch(req)) {
    res.setHeader("Cache-Control", "no-store");
    res.redirect(302, KASPI_PAY_URL);
    return;
  }
  const via: PaymentVia = req.query.via === "qr" ? "qr" : "link";
  const doc = await payments().findOne({ token });
  if (!doc) {
    res.status(404).type("text").send("Ссылка не найдена");
    return;
  }
  if (doc.status === "confirmed" || doc.status === "rejected") {
    res.setHeader("Cache-Control", "no-store");
    res.redirect(302, `${publicAppUrl()}/cabinet/payments`);
    return;
  }

  const name = payerNameOf(req.query.name);
  const now = new Date();
  const claimed = await payments().findOneAndUpdate(
    { _id: doc._id, status: "prepared" },
    {
      $set: {
        status: "pending",
        vias: [via],
        openedAt: now,
        ...(name ? { payerName: name } : {}),
      },
    },
    { returnDocument: "after" },
  );
  const updated =
    claimed ??
    (await payments().findOneAndUpdate(
      { _id: doc._id, status: "pending" },
      {
        $addToSet: { vias: via },
        ...(name ? { $set: { payerName: name } } : {}),
      },
      { returnDocument: "after" },
    ));

  if (updated) {
    const known = new Set(doc.vias ?? []);
    if (doc.status === "prepared" || !updated.telegramMessages?.length) {
      await ensureNotified(updated._id);
    } else if (!known.has(via) || (name && name !== doc.payerName)) {
      const fresh = await payments().findOne({ _id: updated._id });
      if (fresh) await refreshTelegram(fresh);
    }
  }

  res.setHeader("Cache-Control", "no-store");
  res.redirect(302, KASPI_PAY_URL);
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
    "Готово. Когда ученик откроет Kaspi по ссылке или QR, сюда придёт попытка оплаты.",
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
