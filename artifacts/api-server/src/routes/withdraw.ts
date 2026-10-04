import { Router } from "express";
import { db, walletsTable, withdrawalsTable } from "@workspace/db";
import { and, eq, gte, sql, desc } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../middlewares/auth.js";
import { logger } from "../lib/logger.js";

const router = Router();
const MIN_WITHDRAWAL_USD = 10;

router.get("/history", requireAuth, async (req: AuthRequest, res) => {
  try {
    const rows = await db.select().from(withdrawalsTable)
      .where(and(eq(withdrawalsTable.userId, req.userId!), eq(withdrawalsTable.accountType, "real")))
      .orderBy(desc(withdrawalsTable.createdAt)).limit(100);
    res.json(rows.map(w => ({
      id: w.id, method: w.method, amount: Number(w.amount), currency: "USD",
      status: w.status, date: w.createdAt.toISOString(), txId: w.transactionId
    })));
  } catch (err) {
    logger.error({ err }, "Get withdrawal history error");
    res.status(500).json({ error: "Unable to load withdrawal history" });
  }
});

router.post("/", requireAuth, async (req: AuthRequest, res) => {
  try {
    const amount = Number(req.body?.amount);
    const method = String(req.body?.method || "");
    const destination = req.body?.destination ? String(req.body.destination) : null;
    if (!Number.isFinite(amount) || amount < MIN_WITHDRAWAL_USD) {
      res.status(400).json({ error: "Minimum withdrawal is $10 USD" }); return;
    }
    if (!method) {
      res.status(400).json({ error: "Withdrawal method is required" }); return;
    }
    const roundedAmount = Math.round(amount * 100) / 100;
    const transactionId = `WDR-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

    const result = await db.transaction(async tx => {
      const [wallet] = await tx.update(walletsTable).set({
        balance: sql`${walletsTable.balance} - ${roundedAmount}`,
      }).where(and(eq(walletsTable.userId, req.userId!), gte(walletsTable.balance, roundedAmount))).returning();
      if (!wallet) return null;
      const [withdrawal] = await tx.insert(withdrawalsTable).values({
        userId: req.userId!, accountType: "real", amount: String(roundedAmount),
        method, status: "pending", destination, transactionId,
      }).returning();
      return { wallet, withdrawal };
    });

    if (!result) {
      res.status(400).json({ error: "Insufficient real-account balance" }); return;
    }
    res.json({
      success: true, amount: roundedAmount, balance: Number(result.wallet.balance),
      accountType: "real", withdrawal: {
        id: result.withdrawal.id, method: result.withdrawal.method,
        amount: Number(result.withdrawal.amount), currency: "USD",
        status: result.withdrawal.status, date: result.withdrawal.createdAt.toISOString(),
        txId: result.withdrawal.transactionId
      }
    });
  } catch (err) {
    logger.error({ err }, "Withdrawal error");
    res.status(500).json({ error: "Unable to process withdrawal" });
  }
});

export default router;
