import { Router } from "express";
import { ObjectId } from "mongodb";
import { authRequired, adminRequired, type AuthedRequest } from "../auth.js";
import { payments, toObjectId, users, type PaymentDoc, type PaymentPlan } from "../db.js";
import { rateLimit } from "../rateLimit.js";
import { getPricing, PLAN_SESSIONS } from "../settings.js";

/**
 * Kaspi QR "Оплата услуги" sends no callback, so a payment is a request the
 * student files after paying; an admin matches it in Kaspi Pay and confirms.
 */
export const paymentsRouter = Router();

const MAX_PENDING = 3;

const requestLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: "Слишком много заявок на оплату. Попробуйте позже",
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
    createdAt: doc.createdAt.toISOString(),
    decidedAt: doc.decidedAt?.toISOString() ?? null,
  };
}

function isPlan(value: unknown): value is PaymentPlan {
  return value === "single" || value === "bundle";
}

paymentsRouter.get("/me", authRequired, async (req: AuthedRequest, res) => {
  const userId = new ObjectId(req.user!.id);
  const [row, list] = await Promise.all([
    users().findOne({ _id: userId }, { projection: { examCredits: 1 } }),
    payments().find({ userId }).sort({ createdAt: -1 }).limit(20).toArray(),
  ]);
  res.json({
    credits: row?.examCredits ?? 0,
    unlimited: req.user!.role === "admin",
    requests: list.map(publicPayment),
  });
});

paymentsRouter.post("/", authRequired, requestLimiter, async (req: AuthedRequest, res) => {
  const body = (req.body ?? {}) as { plan?: unknown; payerName?: unknown };
  if (!isPlan(body.plan)) {
    res.status(400).json({ error: "Выберите тариф" });
    return;
  }
  const payerName = typeof body.payerName === "string" ? body.payerName.trim() : "";
  if (payerName.length < 2 || payerName.length > 80) {
    res.status(400).json({ error: "Укажите имя, которое вы ввели в Kaspi" });
    return;
  }

  const userId = new ObjectId(req.user!.id);
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
    payerName,
    status: "pending",
    createdAt: new Date(),
  };
  await payments().insertOne(doc);
  res.status(201).json(publicPayment(doc));
});

/* ---------- Admin: /api/admin/payments is mounted from here ---------- */

export const adminPaymentsRouter = Router();
adminPaymentsRouter.use(adminRequired);

adminPaymentsRouter.get("/", async (req, res) => {
  const status = req.query.status === "all" ? null : "pending";
  const list = await payments()
    .find(status ? { status } : {})
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
  res: import("express").Response,
  status: "confirmed" | "rejected",
) {
  const id = toObjectId(String(req.params.id));
  if (!id) {
    res.status(404).json({ error: "Оплата не найдена" });
    return;
  }
  // Only a pending request can be decided, so a double click credits once.
  const updated = await payments().findOneAndUpdate(
    { _id: id, status: "pending" },
    { $set: { status, decidedAt: new Date(), decidedBy: new ObjectId(req.user!.id) } },
    { returnDocument: "after" },
  );
  if (!updated) {
    res.status(409).json({ error: "Эта оплата уже обработана" });
    return;
  }
  if (status === "confirmed") {
    await users().updateOne({ _id: updated.userId }, { $inc: { examCredits: updated.sessions } });
  }
  res.json(publicPayment(updated));
}

adminPaymentsRouter.post("/:id/confirm", (req: AuthedRequest, res) => decide(req, res, "confirmed"));
adminPaymentsRouter.post("/:id/reject", (req: AuthedRequest, res) => decide(req, res, "rejected"));
