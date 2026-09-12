import { Router } from "express";
import bcrypt from "bcryptjs";
import { createHash, randomBytes } from "node:crypto";
import { users, publicUser, type UserDoc } from "../db.js";
import { adminRequired, authRequired, optionalAuth, signToken, type AuthedRequest } from "../auth.js";
import { isBrevoConfigured } from "../brevo.js";
import {
  queueMail,
  sendResetEmail,
  sendVerifyEmail,
  sendWelcomeEmail,
  syncUserToBrevo,
} from "../mail.js";

export const authRouter = Router();

const VERIFY_MS = 48 * 60 * 60 * 1000;
const RESET_MS = 60 * 60 * 1000;

function newToken(): string {
  return randomBytes(32).toString("hex");
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function respondUser(res: { status: (code: number) => { json: (body: unknown) => void }; json: (body: unknown) => void }, user: ReturnType<typeof publicUser>, status = 200) {
  const payload = { token: signToken(user), user };
  if (status === 201) res.status(201).json(payload);
  else res.json(payload);
}

authRouter.post("/register", async (req, res) => {
  const { email, password, name } = req.body as {
    email?: string;
    password?: string;
    name?: string;
  };

  if (!email?.trim() || !password || !name?.trim()) {
    res.status(400).json({ error: "email, password и name обязательны" });
    return;
  }
  if (password.length < 6) {
    res.status(400).json({ error: "Пароль минимум 6 символов" });
    return;
  }

  const normalized = email.trim().toLowerCase();
  const existing = await users().findOne({ email: normalized });
  if (existing) {
    res.status(409).json({ error: "Email уже зарегистрирован" });
    return;
  }

  const now = new Date();
  const verifyToken = newToken();
  const result = await users().insertOne({
    email: normalized,
    passwordHash: bcrypt.hashSync(password, 10),
    name: name.trim(),
    role: "user",
    createdAt: now,
    emailVerified: false,
    verifyTokenHash: hashToken(verifyToken),
    verifyExpiresAt: new Date(now.getTime() + VERIFY_MS),
  } as UserDoc);

  const user = publicUser({
    _id: result.insertedId,
    email: normalized,
    passwordHash: "",
    name: name.trim(),
    role: "user",
    createdAt: now,
    emailVerified: false,
  });

  if (isBrevoConfigured()) {
    queueMail(syncUserToBrevo(normalized, name.trim()));
    queueMail(
      sendWelcomeEmail({
        email: normalized,
        name: name.trim(),
        verifyToken,
      }),
    );
  }

  respondUser(res, user, 201);
});

authRouter.post("/login", async (req, res) => {
  const { email, password } = req.body as { email?: string; password?: string };
  if (!email || !password) {
    res.status(400).json({ error: "email и password обязательны" });
    return;
  }

  const row = await users().findOne({ email: email.trim().toLowerCase() });
  if (!row || !bcrypt.compareSync(password, row.passwordHash)) {
    res.status(401).json({ error: "Неверный email или пароль" });
    return;
  }

  respondUser(res, publicUser(row));
});

authRouter.get("/me", authRequired, (req: AuthedRequest, res) => {
  res.json({ user: req.user });
});

authRouter.post("/verify-email", optionalAuth, async (req: AuthedRequest, res) => {
  const token =
    typeof req.body?.token === "string"
      ? req.body.token
      : typeof req.query.token === "string"
        ? req.query.token
        : "";
  if (!token) {
    res.status(400).json({ error: "token обязателен" });
    return;
  }
  const row = await users().findOne({
    verifyTokenHash: hashToken(token),
    verifyExpiresAt: { $gt: new Date() },
  });
  if (!row) {
    res.status(400).json({ error: "Ссылка недействительна или устарела" });
    return;
  }
  await users().updateOne(
    { _id: row._id },
    {
      $set: { emailVerified: true },
      $unset: { verifyTokenHash: "", verifyExpiresAt: "" },
    },
  );
  const user = publicUser({ ...row, emailVerified: true });
  res.json({ ok: true, token: signToken(user), user });
});

authRouter.post("/resend-verify", authRequired, async (req: AuthedRequest, res) => {
  const row = await users().findOne({ email: req.user!.email });
  if (!row) {
    res.status(404).json({ error: "Пользователь не найден" });
    return;
  }
  if (row.emailVerified) {
    res.json({ ok: true, alreadyVerified: true });
    return;
  }
  if (!isBrevoConfigured()) {
    res.status(503).json({ error: "Почта ещё не настроена" });
    return;
  }
  const verifyToken = newToken();
  await users().updateOne(
    { _id: row._id },
    {
      $set: {
        verifyTokenHash: hashToken(verifyToken),
        verifyExpiresAt: new Date(Date.now() + VERIFY_MS),
      },
    },
  );
  queueMail(
    sendVerifyEmail({
      email: row.email,
      name: row.name,
      verifyToken,
    }),
  );
  res.json({ ok: true });
});

authRouter.post("/forgot-password", async (req, res) => {
  const email =
    typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
  if (!email) {
    res.status(400).json({ error: "email обязателен" });
    return;
  }
  const row = await users().findOne({ email });
  if (row && isBrevoConfigured()) {
    const resetToken = newToken();
    await users().updateOne(
      { _id: row._id },
      {
        $set: {
          resetTokenHash: hashToken(resetToken),
          resetExpiresAt: new Date(Date.now() + RESET_MS),
        },
      },
    );
    queueMail(
      sendResetEmail({
        email: row.email,
        name: row.name,
        resetToken,
      }),
    );
  }
  res.json({
    ok: true,
    message: "Если такой email есть, мы отправили ссылку для сброса пароля",
  });
});

authRouter.post("/reset-password", async (req, res) => {
  const token = typeof req.body?.token === "string" ? req.body.token : "";
  const password = typeof req.body?.password === "string" ? req.body.password : "";
  if (!token || !password) {
    res.status(400).json({ error: "token и password обязательны" });
    return;
  }
  if (password.length < 6) {
    res.status(400).json({ error: "Пароль минимум 6 символов" });
    return;
  }
  const row = await users().findOne({
    resetTokenHash: hashToken(token),
    resetExpiresAt: { $gt: new Date() },
  });
  if (!row) {
    res.status(400).json({ error: "Ссылка недействительна или устарела" });
    return;
  }
  await users().updateOne(
    { _id: row._id },
    {
      $set: { passwordHash: bcrypt.hashSync(password, 10) },
      $unset: { resetTokenHash: "", resetExpiresAt: "" },
    },
  );
  res.json({ ok: true });
});

authRouter.get("/admin/check", adminRequired, (req: AuthedRequest, res) => {
  res.json({ ok: true, user: req.user });
});
