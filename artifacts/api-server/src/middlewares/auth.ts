import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || process.env.SESSION_SECRET || "big-profits-secret-key";

export interface AuthRequest extends Request {
  userId?: number;
  isAdmin?: boolean;
}

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const token = authHeader.slice(7);
  try {
    const payload = jwt.verify(token, JWT_SECRET) as { userId: number; isAdmin: boolean };
    req.userId = payload.userId;
    req.isAdmin = payload.isAdmin;
    next();
  } catch {
    res.status(401).json({ error: "Invalid token" });
    return;
  }
}

export function requireAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.isAdmin) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  next();
}

export function signToken(userId: number, isAdmin: boolean): string {
  return jwt.sign({ userId, isAdmin }, JWT_SECRET, { expiresIn: "7d" });
}
