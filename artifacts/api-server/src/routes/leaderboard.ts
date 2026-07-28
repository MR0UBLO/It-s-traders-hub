import { Router } from "express";
import { db, usersTable, walletsTable, tradesTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { logger } from "../lib/logger.js";

const router = Router();

// GET /api/leaderboard
router.get("/", async (_req, res) => {
  try {
    const users = await db.select().from(usersTable);
    const wallets = await db.select().from(walletsTable);
    const trades = await db.select().from(tradesTable).where(eq(tradesTable.status, "closed"));

    const walletMap = new Map(wallets.map((w) => [w.userId, w]));

    const entries = users.map((user) => {
      const wallet = walletMap.get(user.id);
      const userTrades = trades.filter((t) => t.userId === user.id);
      const wins = userTrades.filter((t) => Number(t.profitLoss) > 0).length;
      const winRate = userTrades.length > 0 ? (wins / userTrades.length) * 100 : 0;

      return {
        userId: user.id,
        name: user.name,
        totalProfit: wallet ? Number(wallet.totalProfit) : 0,
        winRate: Math.round(winRate * 10) / 10,
        totalTrades: userTrades.length,
      };
    });

    // Sort by totalProfit descending
    entries.sort((a, b) => b.totalProfit - a.totalProfit);

    const ranked = entries.map((e, i) => ({ rank: i + 1, ...e }));
    res.json(ranked);
  } catch (err) {
    logger.error({ err }, "Leaderboard error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
