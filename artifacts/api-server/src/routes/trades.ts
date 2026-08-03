import { Router } from "express";
import { db, tradesTable, walletsTable, demoWalletsTable, followersTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../middlewares/auth.js";
import { getCurrentPrice, SYMBOLS } from "../lib/market.js";
import { logger } from "../lib/logger.js";
import { sql } from "drizzle-orm";

const router = Router();

function generateTicket(): string {
  return `TKT-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
}

function formatTrade(trade: Record<string, unknown>, userName?: string) {
  return {
    id: trade.id,
    userId: trade.userId,
    accountType: trade.accountType ?? "real",
    ticketNumber: trade.ticketNumber ?? null,
    symbol: trade.symbol,
    direction: trade.direction,
    amount: Number(trade.amount),
    lotSize: trade.lotSize != null ? Number(trade.lotSize) : null,
    marginUsed: trade.marginUsed != null ? Number(trade.marginUsed) : null,
    entryPrice: Number(trade.entryPrice),
    closePrice: trade.closePrice != null ? Number(trade.closePrice) : null,
    stopLoss: trade.stopLoss != null ? Number(trade.stopLoss) : null,
    takeProfit: trade.takeProfit != null ? Number(trade.takeProfit) : null,
    profitLoss: trade.profitLoss != null ? Number(trade.profitLoss) : null,
    profitLossPercent: trade.profitLossPercent != null ? Number(trade.profitLossPercent) : null,
    status: trade.status,
    isCopied: trade.isCopied,
    copiedFromUserId: trade.copiedFromUserId ?? null,
    createdAt: (trade.createdAt as Date).toISOString(),
    closedAt: trade.closedAt ? (trade.closedAt as Date).toISOString() : null,
    userName: userName ?? null,
  };
}

// GET /api/trades?account=real|demo
router.get("/", requireAuth, async (req: AuthRequest, res) => {
  try {
    const account = (req.query.account as string) || "real";
    const trades = await db
      .select()
      .from(tradesTable)
      .where(and(eq(tradesTable.userId, req.userId!), eq(tradesTable.accountType, account)))
      .orderBy(desc(tradesTable.createdAt))
      .limit(200);
    res.json(trades.map((t) => formatTrade(t as unknown as Record<string, unknown>)));
  } catch (err) {
    logger.error({ err }, "Get trades error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/trades/open?account=real|demo
router.get("/open", requireAuth, async (req: AuthRequest, res) => {
  try {
    const account = (req.query.account as string) || "real";
    const trades = await db
      .select()
      .from(tradesTable)
      .where(and(eq(tradesTable.userId, req.userId!), eq(tradesTable.accountType, account), eq(tradesTable.status, "open")))
      .orderBy(desc(tradesTable.createdAt));

    const formattedTrades = trades.map((t) => {
      const formatted = formatTrade(t as unknown as Record<string, unknown>);
      try {
        const price = getCurrentPrice(t.symbol);
        const entryPrice = Number(t.entryPrice);
        const amount = Number(t.amount);
        let floatPL: number;
        const multiplier = 50;

if (t.direction === "buy") {
  floatPL = amount * multiplier * ((price.bid - entryPrice) / entryPrice);
} else {
  floatPL = amount * multiplier * ((entryPrice - price.ask) / entryPrice);
}
        formatted.profitLoss = parseFloat(floatPL.toFixed(4));
        formatted.profitLossPercent = parseFloat(((floatPL / amount) * 100).toFixed(4));
      } catch {
        // keep null if price not available
      }
      return formatted;
    });

    res.json(formattedTrades);
  } catch (err) {
    logger.error({ err }, "Get open trades error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/trades
router.post("/", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { symbol, direction, amount, lotSize, stopLoss, takeProfit, accountType: rawAccountType } = req.body;
    const accountType: "real" | "demo" = rawAccountType === "demo" ? "demo" : "real";

    if (!symbol || !direction || !amount) {
      res.status(400).json({ error: "symbol, direction, and amount are required" });
      return;
    }
    if (!SYMBOLS.includes(symbol)) {
      res.status(400).json({ error: "Invalid symbol" });
      return;
    }
    if (!["buy", "sell"].includes(direction)) {
      res.status(400).json({ error: "direction must be 'buy' or 'sell'" });
      return;
    }
    const amt = Number(amount);
    if (isNaN(amt) || amt <= 0) {
      res.status(400).json({ error: "Invalid amount" });
      return;
    }
    if (amt < 1) {
  res.status(400).json({ error: "Minimum trade amount is $1 USD" });
  return;
}

    const slNum = stopLoss != null ? Number(stopLoss) : null;
    const tpNum = takeProfit != null ? Number(takeProfit) : null;
    const lotSizeNum = lotSize != null ? Number(lotSize) : null;

    if (slNum !== null && isNaN(slNum)) {
      res.status(400).json({ error: "Invalid stop loss value" });
      return;
    }
    if (tpNum !== null && isNaN(tpNum)) {
      res.status(400).json({ error: "Invalid take profit value" });
      return;
    }

    // Check wallet balance for the correct account type
    const walletTable = accountType === "demo" ? demoWalletsTable : walletsTable;
    const [wallet] = await db.select().from(walletTable).where(eq(walletTable.userId, req.userId!)).limit(1);

    if (!wallet || Number(wallet.balance) < amt) {
      if (accountType === "real") {
        res.status(400).json({ error: "Insufficient available balance. Please deposit additional funds before opening this position." });
      } else {
        res.status(400).json({ error: "Insufficient demo balance. Please reset your demo account to restore $10,000." });
      }
      return;
    }

    const price = getCurrentPrice(symbol);
    const entryPrice = direction === "buy" ? price.ask : price.bid;
    const marginUsed = parseFloat((amt * 0.01).toFixed(4)); // 1% margin requirement

    // Validate SL/TP
    if (slNum !== null) {
      if (direction === "buy" && slNum >= entryPrice) {
        res.status(400).json({ error: "Stop loss must be below entry price for a Buy trade" });
        return;
      }
      if (direction === "sell" && slNum <= entryPrice) {
        res.status(400).json({ error: "Stop loss must be above entry price for a Sell trade" });
        return;
      }
    }
    if (tpNum !== null) {
      if (direction === "buy" && tpNum <= entryPrice) {
        res.status(400).json({ error: "Take profit must be above entry price for a Buy trade" });
        return;
      }
      if (direction === "sell" && tpNum >= entryPrice) {
        res.status(400).json({ error: "Take profit must be below entry price for a Sell trade" });
        return;
      }
    }

    // Deduct from the correct wallet
    await db.update(walletTable).set({ balance: sql`${walletTable.balance} - ${amt}` }).where(eq(walletTable.userId, req.userId!));

    const [trade] = await db.insert(tradesTable).values({
      userId: req.userId!,
      accountType,
      ticketNumber: generateTicket(),
      symbol,
      direction,
      amount: String(amt),
      lotSize: lotSizeNum != null ? String(lotSizeNum) : null,
      marginUsed: String(marginUsed),
      entryPrice: String(entryPrice),
      stopLoss: slNum != null ? String(slNum) : null,
      takeProfit: tpNum != null ? String(tpNum) : null,
      status: "open",
      isCopied: false,
    }).returning();

    // Auto-copy to followers (only for real account trades)
    if (accountType === "real") {
      const followers = await db.select().from(followersTable).where(eq(followersTable.traderId, req.userId!));
      for (const follower of followers) {
        const [followerWallet] = await db.select().from(walletsTable).where(eq(walletsTable.userId, follower.followerId)).limit(1);
        if (followerWallet && Number(followerWallet.balance) >= amt) {
          await db.update(walletsTable).set({ balance: sql`${walletsTable.balance} - ${amt}` }).where(eq(walletsTable.userId, follower.followerId));
          await db.insert(tradesTable).values({
            userId: follower.followerId,
            accountType: "real",
            ticketNumber: generateTicket(),
            symbol,
            direction,
            amount: String(amt),
            lotSize: lotSizeNum != null ? String(lotSizeNum) : null,
            marginUsed: String(marginUsed),
            entryPrice: String(entryPrice),
            stopLoss: slNum != null ? String(slNum) : null,
            takeProfit: tpNum != null ? String(tpNum) : null,
            status: "open",
            isCopied: true,
            copiedFromUserId: req.userId!,
          });
        }
      }
    }

    res.status(201).json(formatTrade(trade as unknown as Record<string, unknown>));
  } catch (err) {
    logger.error({ err }, "Create trade error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /api/trades/:id — close position at market price
router.delete("/:id", requireAuth, async (req: AuthRequest, res) => {
  try {
    const tradeId = Number(req.params.id);
    if (isNaN(tradeId)) {
      res.status(400).json({ error: "Invalid trade ID" });
      return;
    }

    const [trade] = await db
      .select()
      .from(tradesTable)
      .where(and(eq(tradesTable.id, tradeId), eq(tradesTable.userId, req.userId!)))
      .limit(1);

    if (!trade) {
      res.status(404).json({ error: "Trade not found" });
      return;
    }
    if (trade.status !== "open") {
      res.status(400).json({ error: "Trade is already closed" });
      return;
    }

    const price = getCurrentPrice(trade.symbol);
    const closePrice = trade.direction === "buy" ? price.bid : price.ask;
    const entryPrice = Number(trade.entryPrice);
    const amt = Number(trade.amount);

    const multiplier = 50;



let pl: number;
if (trade.direction === "buy") {
  pl = amt * multiplier * ((closePrice - entryPrice) / entryPrice);
} else {
  pl = amt * multiplier * ((entryPrice - closePrice) / entryPrice);
}
    const plPercent = (pl / amt) * 100;
    const payout = Math.max(0, amt + pl);

    // Update trade record
    const [updated] = await db.update(tradesTable).set({
      status: "closed",
      closePrice: String(closePrice),
      profitLoss: String(parseFloat(pl.toFixed(4))),
      profitLossPercent: String(parseFloat(plPercent.toFixed(4))),
      closedAt: new Date(),
    }).where(eq(tradesTable.id, tradeId)).returning();

    // Credit the correct wallet
    const walletTable = trade.accountType === "demo" ? demoWalletsTable : walletsTable;
    await db.update(walletTable).set({
      balance: sql`${walletTable.balance} + ${payout}`,
      totalProfit: sql`${walletTable.totalProfit} + ${pl}`,
    }).where(eq(walletTable.userId, req.userId!));

    res.json(formatTrade(updated as unknown as Record<string, unknown>));
  } catch (err) {
    logger.error({ err }, "Close trade error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
