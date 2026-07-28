import { Router } from "express";
import { getCandles, TIMEFRAMES, type Timeframe } from "../lib/candle-engine.js";
import { SYMBOLS } from "../lib/market.js";
import { logger } from "../lib/logger.js";

const router = Router();

// GET /api/market/candles/:symbol/:timeframe?limit=200
router.get("/:symbol/:timeframe", (req, res) => {
  try {
    const symbol = (req.params.symbol as string)?.toUpperCase();
    const timeframe = (req.params.timeframe as string)?.toUpperCase() as Timeframe;
    const limit = Math.min(300, Math.max(1, parseInt((req.query.limit as string) ?? "200") || 200));

    if (!SYMBOLS.includes(symbol as any)) {
      res.status(400).json({ error: `Invalid symbol. Valid: ${SYMBOLS.join(", ")}` });
      return;
    }
    if (!TIMEFRAMES.includes(timeframe)) {
      res.status(400).json({ error: `Invalid timeframe. Valid: ${TIMEFRAMES.join(", ")}` });
      return;
    }

    const candles = getCandles(symbol, timeframe).slice(-limit);
    res.json(candles);
  } catch (err) {
    logger.error({ err }, "Get candles error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
