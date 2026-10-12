import { db, tradesTable, walletsTable, demoWalletsTable, eaBudgetsTable } from "@workspace/db";
import { eq, and, lte, sql } from "drizzle-orm";
import { getCurrentPrice } from "./market.js";
import { logger } from "./logger.js";
import { calculateBinarySettlement } from "./binary-settlement.js";

export function startTradeEngine() {
  setInterval(async () => {
    try {
      const now = new Date();

      const trades = await db
        .select()
        .from(tradesTable)
        .where(
          and(
            eq(tradesTable.status, "open"),
            lte(tradesTable.expiryTime, now)
          )
        );

      for (const trade of trades) {
        const price = getCurrentPrice(trade.symbol);

        const closePrice =
          trade.direction === "buy"
            ? price.bid
            : price.ask;

        const entry = Number(trade.entryPrice);

        const win =
          trade.direction === "buy"
            ? closePrice > entry
            : closePrice < entry;

        const amount = Number(trade.amount);
        const { profit, returnAmount: payout } = calculateBinarySettlement(
          amount,
          Number(trade.payoutPercent ?? 95),
          win,
        );

        const walletTable =
          trade.accountType === "demo"
            ? demoWalletsTable
            : walletsTable;

        // The background jobs module also checks expired trades. Only the
        // worker that successfully changes open -> closed may credit the wallet.
        // Keep both operations in one transaction to prevent duplicate payouts.
        const settled = await db.transaction(async (tx) => {
          const [closedTrade] = await tx
            .update(tradesTable)
            .set({
              status: "closed",
              result: win ? "WIN" : "LOSS",
              closePrice: String(closePrice),
              profitLoss: String(profit),
              profitLossPercent: String(Number(((profit / amount) * 100).toFixed(4))),
              closedAt: new Date(),
            })
            .where(and(eq(tradesTable.id, trade.id), eq(tradesTable.status, "open")))
            .returning();

          if (!closedTrade) return false;

          if (trade.ticketNumber?.startsWith("AT-")) {
            const budgetId = Number(trade.ticketNumber.split("-")[1]);
            const [budget] = await tx.update(eaBudgetsTable).set({
              balance: sql`${eaBudgetsTable.balance} + ${payout}`,
            }).where(and(
              eq(eaBudgetsTable.id, budgetId),
              eq(eaBudgetsTable.status, "active")
            )).returning();
            if (!budget) {
              await tx.update(walletTable).set({
                balance: sql`${walletTable.balance} + ${payout}`,
                totalProfit: sql`${walletTable.totalProfit} + ${profit}`,
              }).where(eq(walletTable.userId, trade.userId));
            } else {
              await tx.update(walletTable).set({
                totalProfit: sql`${walletTable.totalProfit} + ${profit}`,
              }).where(eq(walletTable.userId, trade.userId));
            }
          } else {
            await tx
              .update(walletTable)
              .set({
                balance: sql`${walletTable.balance} + ${payout}`,
                totalProfit: sql`${walletTable.totalProfit} + ${profit}`,
              })
              .where(eq(walletTable.userId, trade.userId));
          }

          return true;
        });

        if (settled) {
          logger.info(
            `Trade ${trade.id} expired (${win ? "WIN" : "LOSS"})`
          );
        }
      }
    } catch (err) {
      logger.error(err);
    }
  }, 1000);
}