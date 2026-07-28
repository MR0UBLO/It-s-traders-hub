import { Router } from "express";
import { db, usersTable, walletsTable, tradesTable, depositsTable } from "@workspace/db";
import { eq, desc, count } from "drizzle-orm";
import { requireAuth, requireAdmin, type AuthRequest } from "../middlewares/auth.js";
import { logger } from "../lib/logger.js";
import { sql } from "drizzle-orm";

const router = Router();
router.use(requireAuth, requireAdmin);

// GET /api/admin/users
router.get("/users", async (_req, res) => {
  try {
    const users = await db.select().from(usersTable).orderBy(desc(usersTable.createdAt));
    const wallets = await db.select().from(walletsTable);
    const trades = await db.select().from(tradesTable);

    const walletMap = new Map(wallets.map((w) => [w.userId, w]));

    const result = users.map((u) => {
      const wallet = walletMap.get(u.id);
      const userTrades = trades.filter((t) => t.userId === u.id && t.status === "closed");
      return {
        id: u.id,
        email: u.email,
        name: u.name,
        balance: wallet ? Number(wallet.balance) : 0,
        totalDeposited: wallet ? Number(wallet.totalDeposited) : 0,
        totalProfit: wallet ? Number(wallet.totalProfit) : 0,
        totalTrades: userTrades.length,
        createdAt: u.createdAt.toISOString(),
        isAdmin: u.isAdmin,
      };
    });

    res.json(result);
  } catch (err) {
    logger.error({ err }, "Admin get users error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// PATCH /api/admin/users/:id/balance
router.patch("/users/:id/balance", async (req: AuthRequest, res) => {
  try {
    const userId = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id);
    const { balance } = req.body;
    if (balance === undefined || isNaN(Number(balance))) {
      res.status(400).json({ error: "balance is required" });
      return;
    }

    const [wallet] = await db.select().from(walletsTable).where(eq(walletsTable.userId, userId)).limit(1);
    if (!wallet) {
      res.status(404).json({ error: "Wallet not found" });
      return;
    }

    await db.update(walletsTable).set({ balance: String(Number(balance)) }).where(eq(walletsTable.userId, userId));
    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, "Admin adjust balance error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/admin/deposits
router.get("/deposits", async (_req, res) => {
  try {
    const deposits = await db.select().from(depositsTable).orderBy(desc(depositsTable.createdAt)).limit(200);
    const users = await db.select().from(usersTable);
    const userMap = new Map(users.map((u) => [u.id, u]));

    res.json(deposits.map((d) => ({
      id: d.id,
      userId: d.userId,
      amount: Number(d.amount),
      status: d.status,
      phone: d.phone,
      mpesaReceiptNumber: d.mpesaReceiptNumber ?? null,
      checkoutRequestId: d.checkoutRequestId ?? null,
      createdAt: d.createdAt.toISOString(),
      userName: userMap.get(d.userId)?.name ?? null,
    })));
  } catch (err) {
    logger.error({ err }, "Admin get deposits error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/admin/trades
router.get("/trades", async (_req, res) => {
  try {
    const trades = await db.select().from(tradesTable).orderBy(desc(tradesTable.createdAt)).limit(500);
    const users = await db.select().from(usersTable);
    const userMap = new Map(users.map((u) => [u.id, u]));

    res.json(trades.map((t) => ({
      id: t.id,
      userId: t.userId,
      symbol: t.symbol,
      direction: t.direction,
      amount: Number(t.amount),
      entryPrice: Number(t.entryPrice),
      closePrice: t.closePrice != null ? Number(t.closePrice) : null,
      profitLoss: t.profitLoss != null ? Number(t.profitLoss) : null,
      profitLossPercent: t.profitLossPercent != null ? Number(t.profitLossPercent) : null,
      status: t.status,
      isCopied: t.isCopied,
      copiedFromUserId: t.copiedFromUserId ?? null,
      createdAt: t.createdAt.toISOString(),
      closedAt: t.closedAt ? t.closedAt.toISOString() : null,
      userName: userMap.get(t.userId)?.name ?? null,
    })));
  } catch (err) {
    logger.error({ err }, "Admin get trades error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/admin/stats
router.get("/stats", async (_req, res) => {
  try {
    const [userCount] = await db.select({ count: count() }).from(usersTable);
    const wallets = await db.select().from(walletsTable);
    const totalDeposits = wallets.reduce((sum, w) => sum + Number(w.totalDeposited), 0);

    const trades = await db.select().from(tradesTable);
    const closedTrades = trades.filter((t) => t.status === "closed");
    const totalVolume = closedTrades.reduce((sum, t) => sum + Number(t.amount), 0);

    const openTraderIds = new Set(trades.filter((t) => t.status === "open").map((t) => t.userId));

    res.json({
      totalUsers: userCount.count,
      totalDeposits,
      totalTrades: trades.length,
      totalVolume,
      activeTraders: openTraderIds.size,
    });
  } catch (err) {
    logger.error({ err }, "Admin stats error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
