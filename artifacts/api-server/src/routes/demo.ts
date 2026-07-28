import { Router } from "express";
import { db, demoWalletsTable, tradesTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../middlewares/auth.js";
import { logger } from "../lib/logger.js";
import { sql } from "drizzle-orm";

const DEMO_INITIAL_BALANCE = 10000;

const router = Router();

// POST /api/demo/reset — reset demo account to $10,000
router.post("/reset", requireAuth, async (req: AuthRequest, res) => {
  try {
    // Close all open demo trades at 0 P/L (return the margin)
    const openDemoTrades = await db
      .select()
      .from(tradesTable)
      .where(and(eq(tradesTable.userId, req.userId!), eq(tradesTable.accountType, "demo"), eq(tradesTable.status, "open")));

    if (openDemoTrades.length > 0) {
      for (const trade of openDemoTrades) {
        await db.update(tradesTable).set({
          status: "closed",
          profitLoss: "0",
          profitLossPercent: "0",
          closedAt: new Date(),
        }).where(eq(tradesTable.id, trade.id));
      }
    }

    // Reset demo wallet to $10,000
    const existing = await db
      .select()
      .from(demoWalletsTable)
      .where(eq(demoWalletsTable.userId, req.userId!))
      .limit(1);

    let wallet;
    if (existing.length === 0) {
      const [w] = await db.insert(demoWalletsTable).values({ userId: req.userId! }).returning();
      wallet = w;
    } else {
      const [w] = await db.update(demoWalletsTable).set({
        balance: String(DEMO_INITIAL_BALANCE),
        totalProfit: "0",
        totalDeposited: "0",
      }).where(eq(demoWalletsTable.userId, req.userId!)).returning();
      wallet = w;
    }

    res.json({
      id: wallet.id,
      userId: wallet.userId,
      balance: Number(wallet.balance),
      totalDeposited: Number(wallet.totalDeposited),
      totalProfit: Number(wallet.totalProfit),
      accountType: "demo",
    });
  } catch (err) {
    logger.error({ err }, "Demo reset error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
