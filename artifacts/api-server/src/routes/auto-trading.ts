import { timingSafeEqual } from "node:crypto";
import { Router } from "express";
import { requireAuth, type AuthRequest } from "../middlewares/auth.js";
import { getAutoTradingData, getAutoTradingStatus, startAutoTrading, stopAutoTrading, closeAutoTradingPositions, type AutoTradingConfig } from "../lib/auto-trading.js";
import { SYMBOLS } from "../lib/market.js";

const router = Router();
const validStrategies = new Set(["trend","scalp","swing","breakout","grid","smc"]);

function validSharedPassword(supplied: unknown): boolean {
  const expected = process.env.AUTO_TRADING_EA_PASSWORD;
  if (!expected || typeof supplied !== "string") return false;
  const suppliedBuffer = Buffer.from(supplied);
  const expectedBuffer = Buffer.from(expected);
  return suppliedBuffer.length === expectedBuffer.length && timingSafeEqual(suppliedBuffer, expectedBuffer);
}

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

    if (!process.env.AUTO_TRADING_EA_PASSWORD) {
      return res.status(503).json({ error: "The shared EA password has not been configured by the administrator." });
    }
    if (!validSharedPassword(body.eaPassword)) {
      return res.status(403).json({ error: "Incorrect EA password." });
    }

    const eaId = typeof body.eaId === "string" ? body.eaId : "";
    const match = /^EA-(\d{3})$/.exec(eaId);
    if (!match || Number(match[1]) < 1 || Number(match[1]) > 120) {
      return res.status(400).json({ error: "Select a valid EA from the list." });
    }
    const minimumInvestment = 10 + (Number(match[1]) % 10) * 10;
    const investmentAmount = Number(body.investmentAmount);
    if (!Number.isFinite(investmentAmount) || investmentAmount < minimumInvestment) {
      return res.status(400).json({ error: "This EA requires a minimum investment of $" + minimumInvestment.toFixed(2) + "." });
    }

    const config: Partial<AutoTradingConfig> = { eaId, investmentAmount };
    if (validStrategies.has(body.strategy)) config.strategy = body.strategy;
    for (const key of ["riskPct","lotSize","dailyTargetPct","dailyLossPct","maxTrades","stopLossPips","takeProfitPips","tradeDuration"] as const) {
      if (body[key] !== undefined) {
        const value = Number(body[key]);
        if (!Number.isFinite(value) || value <= 0) return res.status(400).json({ error: "Invalid " + key });
        if (key === "tradeDuration" && (!Number.isInteger(value) || value > 4)) return res.status(400).json({ error: "EA trade duration must be 1 to 4 seconds." });
        config[key] = value;
      }
    }
    if (body.trailingStop !== undefined) config.trailingStop = Boolean(body.trailingStop);
    if (body.breakEven !== undefined) config.breakEven = Boolean(body.breakEven);
    if (body.aiSpeed === "fast" || body.aiSpeed === "slow") config.aiSpeed = body.aiSpeed;
    if (body.asset !== undefined) {
      const asset = String(body.asset).toUpperCase();
      const validAssets = [...SYMBOLS, "ALL"];
      if (!validAssets.includes(asset)) return res.status(400).json({ error: "Invalid asset" });
      config.asset = asset;
    }

    const data = await getAutoTradingData(req.userId!, accountType);
    if (!data.wallet || Number(data.wallet.balance) < investmentAmount) {
      return res.status(400).json({ error: "Insufficient " + accountType + " wallet balance for this investment." });
    }

    startAutoTrading(req.userId!, accountType, config);
    const status = getAutoTradingStatus(req.userId!);
    res.json({ ...status, accountType, wallet: data.wallet, message: "Auto trading started on the " + accountType + " wallet." });
  } catch {
    res.status(500).json({ error: "Unable to start auto trading" });
  }
});

router.post("/stop", requireAuth, async (req: AuthRequest, res) => {
  stopAutoTrading(req.userId!);
  const accountType = req.body?.accountType === "demo" ? "demo" : "real";
  await closeAutoTradingPositions(req.userId!, accountType);
  const data = await getAutoTradingData(req.userId!, accountType);
  res.json({ enabled: false, accountType, wallet: data.wallet, openTrades: data.openTrades, closedTrades: data.closedTrades, message: "Auto trading stopped and open AI positions were closed." });
});

export default router;
