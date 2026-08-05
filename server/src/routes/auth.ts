import { Router } from "express";
import bcrypt from "bcryptjs";
import { db } from "../db.js";
import { adminRequired, authRequired, signToken, type AuthedRequest } from "../auth.js";

export const authRouter = Router();

authRouter.post("/register", (req, res) => {
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

  const existing = db
    .prepare("SELECT id FROM users WHERE email = ?")
    .get(email.trim().toLowerCase());
  if (existing) {
    res.status(409).json({ error: "Email уже зарегистрирован" });
    return;
  }

  const hash = bcrypt.hashSync(password, 10);
  const result = db
    .prepare(
      "INSERT INTO users (email, password_hash, name, role) VALUES (?, ?, ?, 'user')",
    )
    .run(email.trim().toLowerCase(), hash, name.trim());

  const user = {
    id: Number(result.lastInsertRowid),
    email: email.trim().toLowerCase(),
    name: name.trim(),
    role: "user" as const,
  };

  res.status(201).json({ token: signToken(user), user });
});

authRouter.post("/login", (req, res) => {
  const { email, password } = req.body as { email?: string; password?: string };
  if (!email || !password) {
    res.status(400).json({ error: "email и password обязательны" });
    return;
  }

  const row = db
    .prepare(
      "SELECT id, email, name, role, password_hash FROM users WHERE email = ?",
    )
    .get(email.trim().toLowerCase()) as
    | {
        id: number;
        email: string;
        name: string;
        role: "user" | "admin";
        password_hash: string;
      }
    | undefined;

  if (!row || !bcrypt.compareSync(password, row.password_hash)) {
    res.status(401).json({ error: "Неверный email или пароль" });
    return;
  }

  const user = {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
  };
  res.json({ token: signToken(user), user });
});

authRouter.get("/me", authRequired, (req: AuthedRequest, res) => {
  res.json({ user: req.user });
});

authRouter.get("/admin/check", adminRequired, (req: AuthedRequest, res) => {
  res.json({ ok: true, user: req.user });
});
