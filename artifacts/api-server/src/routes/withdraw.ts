import { Router } from "express";
import { db, walletsTable } from "@workspace/db";
import { and, eq, gte, sql } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../middlewares/auth.js";
import { logger } from "../lib/logger.js";

const router = Router();

const MIN_WITHDRAWAL_USD = 10;

// POST /api/withdraw
// Deducts the requested amount immediately from the authenticated user's REAL wallet.
// Demo wallets are never touched.
router.post("/", requireAuth, async (req: AuthRequest, res) => {
  try {
    const amount = Number(req.body?.amount);

    if (!Number.isFinite(amount) || amount < MIN_WITHDRAWAL_USD) {
      res.status(400).json({
        error: "Minimum withdrawal is $10 USD",
      });
      return;
    }

    const roundedAmount = Math.round(amount * 100) / 100;

    // Atomic balance check + deduction. If the real wallet does not have
    // enough funds, no row is updated and no money is deducted.
    const [wallet] = await db
      .update(walletsTable)
      .set({
        balance: sql`${walletsTable.balance} - ${roundedAmount}`,
      })
      .where(
        and(
          eq(walletsTable.userId, req.userId!),
          gte(walletsTable.balance, roundedAmount)
        )
      )
      .returning();

    if (!wallet) {
      res.status(400).json({
        error: "Insufficient real-account balance",
      });
      return;
    }

    res.json({
      success: true,
      amount: roundedAmount,
      balance: Number(wallet.balance),
      accountType: "real",
    });
  } catch (err) {
    logger.error({ err }, "Withdrawal error");
    res.status(500).json({ error: "Unable to process withdrawal" });
  }
});

export default router;
