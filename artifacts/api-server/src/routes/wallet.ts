import { Router } from "express";
import { db, walletsTable, demoWalletsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../middlewares/auth.js";
import { logger } from "../lib/logger.js";

const router = Router();

// GET /api/wallet?account=real|demo
router.get("/", requireAuth, async (req: AuthRequest, res) => {
  try {
    const account = (req.query.account as string) || "real";
    const isDemo = account === "demo";
    const table = isDemo ? demoWalletsTable : walletsTable;

    let [wallet] = await db
      .select()
      .from(table)
      .where(eq(table.userId, req.userId!))
      .limit(1);

    // Automatically initialize/reset demo wallet to $10,000
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

    if (!wallet) {
      res.status(404).json({ error: "Wallet not found" });
      return;
    }

    res.json({
      id: wallet.id,
      userId: wallet.userId,
      balance: Number(wallet.balance),
      totalDeposited: Number(wallet.totalDeposited),
      totalProfit: Number(wallet.totalProfit),
      accountType: isDemo ? "demo" : "real",
    });
  } catch (err) {
    logger.error({ err }, "Get wallet error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;