import { Router } from "express";
import { requireAuth, type AuthRequest } from "../middlewares/auth.js";
import { getAutoTradingData, getAutoTradingStatus, startAutoTrading, stopAutoTrading, type AutoTradingConfig } from "../lib/auto-trading.js";

const router = Router();
const validStrategies = new Set(["trend","scalp","swing","breakout","grid","smc"]);

router.get("/status", requireAuth, async (req: AuthRequest, res) => {
  const account = req.query.account === "demo" ? "demo" : "real";
  const status = getAutoTradingStatus(req.userId!);
  const data = await getAutoTradingData(req.userId!, account);
  res.json({ ...status, accountType: account, wallet: data.wallet, openTrades: data.openTrades, closedTrades: data.closedTrades });
});

router.post("/start", requireAuth, async (req: AuthRequest, res) => {
  try {
    const body = req.body ?? {};
    const accountType = body.accountType === "demo" ? "demo" : "real";
    const config: Partial<AutoTradingConfig> = {};
    if (validStrategies.has(body.strategy)) config.strategy = body.strategy;
    for (const key of ["riskPct","lotSize","dailyTargetPct","dailyLossPct","maxTrades","stopLossPips","takeProfitPips"] as const) {
      if (body[key] !== undefined) {
        const value = Number(body[key]);
        if (!Number.isFinite(value) || value <= 0) return res.status(400).json({ error: `Invalid ${key}` });
        config[key] = value;
      }
    }
    if (body.trailingStop !== undefined) config.trailingStop = Boolean(body.trailingStop);
    if (body.breakEven !== undefined) config.breakEven = Boolean(body.breakEven);

    const data = await getAutoTradingData(req.userId!, accountType);
    if (!data.wallet || Number(data.wallet.balance) <= 0) {
      return res.status(400).json({ error: `Cannot start auto trading: ${accountType} wallet has no available balance.` });
    }

    const merged = startAutoTrading(req.userId!, accountType, config);
    const status = getAutoTradingStatus(req.userId!);
    res.json({ ...status, accountType, wallet: data.wallet, message: `Auto trading started on the ${accountType} wallet.` });
  } catch (err) {
    res.status(500).json({ error: "Unable to start auto trading" });
  }
});

router.post("/stop", requireAuth, async (req: AuthRequest, res) => {
  stopAutoTrading(req.userId!);
  const accountType = req.body?.accountType === "demo" ? "demo" : "real";
  const data = await getAutoTradingData(req.userId!, accountType);
  res.json({ enabled: false, accountType, wallet: data.wallet, openTrades: data.openTrades, message: "Auto trading stopped. Existing open positions remain open." });
});

export default router;
