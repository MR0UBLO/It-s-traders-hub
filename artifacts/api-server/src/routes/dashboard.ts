import { Router } from "express";
import { db, walletsTable, demoWalletsTable, tradesTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../middlewares/auth.js";
import { logger } from "../lib/logger.js";

const router = Router();

// GET /api/dashboard/summary?account=real|demo
router.get("/summary", requireAuth, async (req: AuthRequest, res) => {
  try {
    const account = (req.query.account as string) || "real";
    const isDemo = account === "demo";
    const walletTable = isDemo ? demoWalletsTable : walletsTable;

    let [wallet] = await db
      .select()
      .from(walletTable)
      .where(eq(walletTable.userId, req.userId!))
      .limit(1);

    // Automatically create/reset demo wallet
    if (isDemo) {
      if (!wallet) {
        const [newWallet] = await db
          .insert(demoWalletsTable)
          .values({
            userId: req.userId!,
            balance: "10000",
            totalDeposited: "0",
            totalProfit: "0",
          })
          .returning();

        wallet = newWallet;
      } else if (Number(wallet.balance) === 0) {
        await db
          .update(demoWalletsTable)
          .set({
            balance: "10000",
          })
          .where(eq(demoWalletsTable.userId, req.userId!));

        [wallet] = await db
          .select()
          .from(demoWalletsTable)
          .where(eq(demoWalletsTable.userId, req.userId!))
          .limit(1);
      }
    }

    const trades = await db
      .select()
      .from(tradesTable)
      .where(
        and(
          eq(tradesTable.userId, req.userId!),
          eq(tradesTable.accountType, account)
        )
      );

    const openTrades = trades.filter((t) => t.status === "open").length;
    const closedTrades = trades.filter((t) => t.status === "closed");
    const totalTrades = closedTrades.length;
    const winningTrades = closedTrades.filter(
      (t) => Number(t.profitLoss) > 0
    ).length;
    const winRate =
      totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;

    res.json({
      balance: Number(wallet?.balance ?? 0),
      totalProfit: Number(wallet?.totalProfit ?? 0),
      totalDeposited: Number(wallet?.totalDeposited ?? 0),
      openTrades,
      totalTrades,
      winRate: Math.round(winRate * 10) / 10,
      accountType: account,
    });
  } catch (err) {
    logger.error({ err }, "Dashboard summary error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;