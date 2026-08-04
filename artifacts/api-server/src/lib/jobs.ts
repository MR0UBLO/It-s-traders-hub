import cron from "node-cron";
import { logger } from "./logger.js";
import { updateAllPrices } from "./market.js";
import { generateAllSignals } from "./ai-engine.js";
import { getCandles, TIMEFRAMES } from "./candle-engine.js";
import { socketIO } from "./socket.js";
import {
  db,
  signalsTable,
  tradesTable,
  walletsTable,
  demoWalletsTable,
} from "@workspace/db";
import { SYMBOLS, getCurrentPrice } from "./market.js";
import { eq, and, lte, sql } from "drizzle-orm";

let priceTickInterval: ReturnType<typeof setInterval> | null = null;

export function startBackgroundJobs(): void {
  logger.info("Starting background jobs");

  // ── 1. Price tick: every 3 seconds ──────────────────────────────────────────
  priceTickInterval = setInterval(() => {
    try {
      const prices = updateAllPrices();
      socketIO.emitPriceUpdate(prices);
    } catch (err) {
      logger.error({ err }, "Price tick error");
    }
  }, 3_000);

  // ── 2. Candle broadcast per timeframe ────────────────────────────────────────
  // M1 — every minute
  cron.schedule("* * * * *", () => broadcastCandles("M1"), { name: "candle-M1" });
  // M5 — every 5 minutes
  cron.schedule("*/5 * * * *", () => broadcastCandles("M5"), { name: "candle-M5" });
  // M15 — every 15 minutes
  cron.schedule("*/15 * * * *", () => broadcastCandles("M15"), { name: "candle-M15" });
  // H1 — top of every hour
  cron.schedule("0 * * * *", () => broadcastCandles("H1"), { name: "candle-H1" });
  // H4 — every 4 hours
  cron.schedule("0 */4 * * *", () => broadcastCandles("H4"), { name: "candle-H4" });
  // D1 — midnight
  cron.schedule("0 0 * * *", () => broadcastCandles("D1"), { name: "candle-D1" });

  // ── 3. AI signal generation: every 30 seconds ────────────────────────────────
  cron.schedule("*/30 * * * * *", () => void generateAndStoreSignals(), { name: "ai-signals" });

  logger.info("All background jobs scheduled");
}

export function stopBackgroundJobs(): void {
  if (priceTickInterval) {
    clearInterval(priceTickInterval);
    priceTickInterval = null;
  }
  cron.getTasks().forEach((task) => task.stop());
  logger.info("Background jobs stopped");
}

function broadcastCandles(timeframe: (typeof TIMEFRAMES)[number]): void {
  try {
    const payload = SYMBOLS.map((sym) => ({
      symbol: sym,
      candles: getCandles(sym, timeframe).slice(-50),
    }));
    socketIO.emitCandleUpdate({ timeframe, symbols: payload });
  } catch (err) {
    logger.error({ err, timeframe }, "Candle broadcast error");
  }
}

async function generateAndStoreSignals(): Promise<void> {
  try {
    const signals = generateAllSignals();
    for (const sig of signals) {
      const [stored] = await db
        .insert(signalsTable)
        .values({
          symbol: sig.symbol,
          direction: sig.signal,
          confidence: sig.confidence,
          risk: sig.risk,
          timeframe: sig.timeframe,
          reason: sig.reason,
          entry: String(sig.entry),
          target: String(sig.target),
          stopLoss: String(sig.stopLoss),
        })
        .returning();
      socketIO.emitSignalUpdate({ ...sig, id: stored.id, createdAt: stored.createdAt });
    }
  } catch (err) {
    logger.error({ err }, "Signal generation error");
  }
}
