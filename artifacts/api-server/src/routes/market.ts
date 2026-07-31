import { Router } from "express";
import { getCurrentPrice, getPriceHistory, SYMBOLS } from "../lib/market.js";

const router = Router();

// GET /api/market/prices
router.get("/prices", (_req, res) => {
  const prices = SYMBOLS.map((symbol) => getCurrentPrice(symbol));
  res.json(prices);
});

// GET /api/market/prices/:symbol/history
router.get("/prices/:symbol/history", (req, res) => {
  const { symbol } = req.params;
  if (!SYMBOLS.includes(symbol as any)) {
    res.status(400).json({ error: "Unknown symbol" });
    return;
  }
  const history = getPriceHistory(symbol);
  res.json(history);
});

export default router;
