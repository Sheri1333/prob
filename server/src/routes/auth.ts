import { Router } from "express";
import bcrypt from "bcryptjs";
import { users, publicUser } from "../db.js";
import { adminRequired, authRequired, signToken, type AuthedRequest } from "../auth.js";

export const authRouter = Router();

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
  const result = await users().insertOne({
    email: normalized,
    passwordHash: bcrypt.hashSync(password, 10),
    name: name.trim(),
    role: "user",
    createdAt: now,
  });

  const user = {
    id: result.insertedId.toHexString(),
    email: normalized,
    name: name.trim(),
    role: "user" as const,
  };

  res.status(201).json({ token: signToken(user), user });
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

  const user = publicUser(row);
  res.json({ token: signToken(user), user });
});

authRouter.get("/me", authRequired, (req: AuthedRequest, res) => {
  res.json({ user: req.user });
});

authRouter.get("/admin/check", adminRequired, (req: AuthedRequest, res) => {
  res.json({ ok: true, user: req.user });
});
