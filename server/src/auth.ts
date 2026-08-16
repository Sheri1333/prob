import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { publicUser, toObjectId, users, type UserRole } from "./db.js";

const JWT_SECRET = process.env.JWT_SECRET || "prob-dev-secret-change-me";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
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

export async function authRequired(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Требуется авторизация" });
    return;
  }
  try {
    const payload = jwt.verify(header.slice(7), JWT_SECRET) as AuthUser;
    const oid = toObjectId(String(payload.id));
    if (!oid) {
      res.status(401).json({ error: "Недействительный токен" });
      return;
    }
    const row = await users().findOne({ _id: oid });
    if (!row) {
      res.status(401).json({ error: "Пользователь не найден" });
      return;
    }
    req.user = publicUser(row);
    next();
  } catch {
    res.status(401).json({ error: "Недействительный токен" });
  }
}

export async function adminRequired(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  await authRequired(req, res, () => {
    if (req.user?.role !== "admin") {
      res.status(403).json({ error: "Только для администратора" });
      return;
    }
    next();
  });
}

export async function optionalAuth(
  req: AuthedRequest,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    next();
    return;
  }
  try {
    const payload = jwt.verify(header.slice(7), JWT_SECRET) as AuthUser;
    const oid = toObjectId(String(payload.id));
    if (!oid) {
      next();
      return;
    }
    const row = await users().findOne({ _id: oid });
    if (row) req.user = publicUser(row);
  } catch {
    /* ignore */
  }
  next();
}
