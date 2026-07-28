import { Router } from "express";
import { db, depositsTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../middlewares/auth.js";
import { logger } from "../lib/logger.js";

const router = Router();

// GET /api/deposits?account=real|demo
router.get("/", requireAuth, async (req: AuthRequest, res) => {
  try {
    const account = (req.query.account as string) || "real";
    const deposits = await db
      .select()
      .from(depositsTable)
      .where(and(eq(depositsTable.userId, req.userId!), eq(depositsTable.accountType, account)))
      .orderBy(desc(depositsTable.createdAt))
      .limit(50);

    res.json(deposits.map((d) => ({
      id: d.id,
      userId: d.userId,
      accountType: d.accountType,
      amount: Number(d.amount),
      status: d.status,
      phone: d.phone,
      mpesaReceiptNumber: d.mpesaReceiptNumber ?? null,
      checkoutRequestId: d.checkoutRequestId ?? null,
      createdAt: d.createdAt.toISOString(),
      userName: null,
    })));
  } catch (err) {
    logger.error({ err }, "Get deposits error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
