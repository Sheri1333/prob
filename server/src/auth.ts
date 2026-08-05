import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { db } from "./db.js";

const JWT_SECRET = process.env.JWT_SECRET || "prob-dev-secret-change-me";

export interface AuthUser {
  id: number;
  email: string;
  name: string;
  role: "user" | "admin";
}

export interface AuthedRequest extends Request {
  user?: AuthUser;
}

export function signToken(user: AuthUser): string {
  return jwt.sign(
    { id: user.id, email: user.email, name: user.name, role: user.role },
    JWT_SECRET,
    { expiresIn: "7d" },
  );
}

export function authRequired(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
): void {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Требуется авторизация" });
    return;
  }
  try {
    const payload = jwt.verify(header.slice(7), JWT_SECRET) as AuthUser;
    const row = db
      .prepare("SELECT id, email, name, role FROM users WHERE id = ?")
      .get(payload.id) as AuthUser | undefined;
    if (!row) {
      res.status(401).json({ error: "Пользователь не найден" });
      return;
    }
    req.user = row;
    next();
  } catch {
    res.status(401).json({ error: "Недействительный токен" });
  }
}

export function adminRequired(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
): void {
  authRequired(req, res, () => {
    if (req.user?.role !== "admin") {
      res.status(403).json({ error: "Только для администратора" });
      return;
    }
    next();
  });
}

export function optionalAuth(
  req: AuthedRequest,
  _res: Response,
  next: NextFunction,
): void {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    next();
    return;
  }
  try {
    const payload = jwt.verify(header.slice(7), JWT_SECRET) as AuthUser;
    const row = db
      .prepare("SELECT id, email, name, role FROM users WHERE id = ?")
      .get(payload.id) as AuthUser | undefined;
    if (row) req.user = row;
  } catch {
    /* ignore */
  }
  next();
}
