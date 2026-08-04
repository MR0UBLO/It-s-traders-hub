import { db, tradesTable, walletsTable, demoWalletsTable } from "@workspace/db";
import { eq, and, lte, sql } from "drizzle-orm";
import { getCurrentPrice } from "./market.js";
import { logger } from "./logger.js";

const PAYOUT = 0.95;

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

        const profit = win ? amount * PAYOUT : -amount;

        const payout = win
          ? amount + amount * PAYOUT
          : 0;

        await db
          .update(tradesTable)
          .set({
            status: "closed",
            result: win ? "win" : "loss",
            closePrice: String(closePrice),
            profitLoss: String(profit),
            closedAt: new Date(),
          })
          .where(eq(tradesTable.id, trade.id));

        const walletTable =
          trade.accountType === "demo"
            ? demoWalletsTable
            : walletsTable;

        if (payout > 0) {
          await db
            .update(walletTable)
            .set({
              balance: sql`${walletTable.balance} + ${payout}`,
              totalProfit: sql`${walletTable.totalProfit} + ${profit}`,
            })
            .where(eq(walletTable.userId, trade.userId));
        }

        logger.info(
          `Trade ${trade.id} expired (${win ? "WIN" : "LOSS"})`
        );
      }
    } catch (err) {
      logger.error(err);
    }
  }, 1000);
}