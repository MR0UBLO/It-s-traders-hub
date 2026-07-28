import { Router } from "express";
import { db, notificationsTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../middlewares/auth.js";
import { logger } from "../lib/logger.js";

const router = Router();

// GET /api/notifications
router.get("/", requireAuth, async (req: AuthRequest, res) => {
  try {
    const rows = await db
      .select()
      .from(notificationsTable)
      .where(eq(notificationsTable.userId, req.userId!))
      .orderBy(desc(notificationsTable.createdAt))
      .limit(50);
    res.json(rows);
  } catch (err) {
    logger.error({ err }, "Get notifications error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/notifications/unread-count
router.get("/unread-count", requireAuth, async (req: AuthRequest, res) => {
  try {
    const rows = await db
      .select()
      .from(notificationsTable)
      .where(and(eq(notificationsTable.userId, req.userId!), eq(notificationsTable.read, false)));
    res.json({ count: rows.length });
  } catch (err) {
    logger.error({ err }, "Get unread count error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// PATCH /api/notifications/:id/read
router.patch("/:id/read", requireAuth, async (req: AuthRequest, res) => {
  try {
    const id = parseInt(req.params.id as string);
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid notification id" });
      return;
    }
    await db
      .update(notificationsTable)
      .set({ read: true })
      .where(and(eq(notificationsTable.id, id), eq(notificationsTable.userId, req.userId!)));
    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, "Mark notification read error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/notifications/read-all
router.post("/read-all", requireAuth, async (req: AuthRequest, res) => {
  try {
    await db
      .update(notificationsTable)
      .set({ read: true })
      .where(eq(notificationsTable.userId, req.userId!));
    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, "Mark all notifications read error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
