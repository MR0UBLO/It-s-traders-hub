import { Router } from "express";
import { db, signalsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth.js";
import { generateSignalForSymbol } from "../lib/ai-engine.js";
import { logger } from "../lib/logger.js";
import { SYMBOLS } from "../lib/market.js";

const router = Router();

// GET /api/signals?limit=20
router.get("/", requireAuth, async (req, res) => {
  try {
    const limit = Math.min(100, Math.max(1, parseInt((req.query.limit as string) ?? "20") || 20));
    const rows = await db
      .select()
      .from(signalsTable)
      .orderBy(desc(signalsTable.createdAt))
      .limit(limit);
    res.json(rows);
  } catch (err) {
    logger.error({ err }, "Get signals error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/signals/live — generate fresh signals on demand (not stored)
router.get("/live", requireAuth, (req, res) => {
  try {
    const signals = SYMBOLS.map((sym) => generateSignalForSymbol(sym));
    res.json(signals);
  } catch (err) {
    logger.error({ err }, "Get live signals error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/signals/:symbol — latest stored signal for a symbol
router.get("/:symbol", requireAuth, async (req, res) => {
  try {
    const symbol = (req.params.symbol as string)?.toUpperCase();
    if (!SYMBOLS.includes(symbol as any)) {
      res.status(400).json({ error: "Invalid symbol" });
      return;
    }
    const [row] = await db
      .select()
      .from(signalsTable)
      .where(eq(signalsTable.symbol, symbol))
      .orderBy(desc(signalsTable.createdAt))
      .limit(1);

    if (!row) {
      // Generate on demand if no stored signals yet
      const fresh = generateSignalForSymbol(symbol as any);
      res.json({ ...fresh, id: null, createdAt: new Date().toISOString() });
      return;
    }
    res.json(row);
  } catch (err) {
    logger.error({ err }, "Get signal by symbol error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
