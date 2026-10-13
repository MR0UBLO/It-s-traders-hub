import { timingSafeEqual } from "node:crypto";
import { Router } from "express";
import { db, eaBudgetsTable, walletsTable, demoWalletsTable } from "@workspace/db";
import { and, desc, eq, sql } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../middlewares/auth.js";
import { getAutoTradingData, getAutoTradingStatus, startAutoTrading, stopAutoTrading, closeAutoTradingPositions, releaseAutoTradingBudget, type AutoTradingConfig } from "../lib/auto-trading.js";
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
  let status = getAutoTradingStatus(req.userId!);

  // Recover an allocation left active by a server restart: close only EA trades,
  // then return its remaining reserved funds to the correct wallet.
  if (!status.enabled || status.accountType !== account) {
    const [staleBudget] = await db.select().from(eaBudgetsTable).where(and(
      eq(eaBudgetsTable.userId, req.userId!),
      eq(eaBudgetsTable.accountType, account),
      eq(eaBudgetsTable.status, "active")
    )).limit(1);
    if (staleBudget) {
      await closeAutoTradingPositions(req.userId!, account);
      await releaseAutoTradingBudget(req.userId!, account);
    }
    status = getAutoTradingStatus(req.userId!);
  }

  const data = await getAutoTradingData(req.userId!, account);
  const [latestBudget] = await db.select().from(eaBudgetsTable).where(and(
    eq(eaBudgetsTable.userId, req.userId!),
    eq(eaBudgetsTable.accountType, account)
  )).orderBy(desc(eaBudgetsTable.createdAt)).limit(1);
  const terminalConfig = !status.enabled && latestBudget ? {
    ...status.config,
    eaId: latestBudget.eaId,
    investmentAmount: Number(latestBudget.allocatedAmount),
    maxTrades: latestBudget.maxTrades,
  } : status.config;
  res.json({ ...status, budgetId: status.budgetId ?? latestBudget?.id, config: terminalConfig, accountType: status.enabled ? status.accountType : account, wallet: data.wallet, openTrades: data.openTrades, closedTrades: data.closedTrades });
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
    for (const key of ["riskPct","lotSize","dailyTargetPct","dailyLossPct","maxTrades","stopLossPips","takeProfitPips","tradeDuration","sessionDurationSeconds"] as const) {
      if (body[key] !== undefined) {
        const value = Number(body[key]);
        if (!Number.isFinite(value) || value <= 0) return res.status(400).json({ error: "Invalid " + key });
        if (key === "tradeDuration" && (!Number.isInteger(value) || value < 5 || value > 60)) return res.status(400).json({ error: "Each EA trade duration must be between 5 and 60 seconds." });
        if (key === "sessionDurationSeconds" && (!Number.isInteger(value) || value < 60 || value > 3600)) return res.status(400).json({ error: "EA session duration must be between 1 and 60 minutes." });
        if (key === "maxTrades" && (!Number.isInteger(value) || value > 100)) return res.status(400).json({ error: "Trade count must be a whole number between 1 and 100." });
        config[key] = value;
      }
    }
    if (body.trailingStop !== undefined) config.trailingStop = Boolean(body.trailingStop);
    if (body.breakEven !== undefined) config.breakEven = Boolean(body.breakEven);
    if (body.aiSpeed === "fast" || body.aiSpeed === "slow") config.aiSpeed = body.aiSpeed;
    if (body.asset !== undefined) {
      const asset = String(body.asset).toUpperCase();
      const validAssets: string[] = [...SYMBOLS, "ALL"];
      if (!validAssets.includes(asset)) return res.status(400).json({ error: "Invalid asset" });
      config.asset = asset;
    }

    const maxTrades = Number(config.maxTrades ?? 5);
    if (!Number.isInteger(maxTrades) || maxTrades < 1 || maxTrades > 100) {
      return res.status(400).json({ error: "Choose between 1 and 100 trades." });
    }
    if (investmentAmount / maxTrades < 1) {
      return res.status(400).json({ error: "Your selected budget must allocate at least $1 to each trade. Reduce the trade count or increase the budget." });
    }
    config.maxTrades = maxTrades;

    const walletTable = accountType === "demo" ? demoWalletsTable : walletsTable;
    const budget = await db.transaction(async (tx) => {
      const [existing] = await tx.select().from(eaBudgetsTable).where(and(
        eq(eaBudgetsTable.userId, req.userId!),
        eq(eaBudgetsTable.status, "active")
      )).limit(1);
      if (existing) return { error: "An EA budget is already active. Stop the previous EA first." } as const;

      const [reservedWallet] = await tx.update(walletTable).set({
        balance: sql`${walletTable.balance} - ${investmentAmount}`,
      }).where(and(
        eq(walletTable.userId, req.userId!),
        sql`${walletTable.balance} >= ${investmentAmount}`
      )).returning();
      if (!reservedWallet) return { error: "Insufficient " + accountType + " wallet balance for this investment." } as const;

      const [createdBudget] = await tx.insert(eaBudgetsTable).values({
        userId: req.userId!,
        accountType,
        eaId,
        allocatedAmount: String(investmentAmount),
        balance: String(investmentAmount),
        maxTrades,
        tradesOpened: 0,
        status: "active",
      }).returning();
      return { budget: createdBudget } as const;
    });

    if ("error" in budget) {
      return res.status(budget.error.startsWith("An EA budget") ? 409 : 400).json({ error: budget.error });
    }

    startAutoTrading(req.userId!, accountType, config, budget.budget.id);
    const status = getAutoTradingStatus(req.userId!);
    const data = await getAutoTradingData(req.userId!, accountType);
    res.json({ ...status, accountType, wallet: data.wallet, budget: { allocatedAmount: investmentAmount, maxTrades, perTradeStake: Number((investmentAmount / maxTrades).toFixed(2)) }, message: "EA started with an isolated budget. Only this allocation can be risked." });
  } catch {
    res.status(500).json({ error: "Unable to start auto trading" });
  }
});

router.post("/stop", requireAuth, async (req: AuthRequest, res) => {
  stopAutoTrading(req.userId!);
  const accountType = req.body?.accountType === "demo" ? "demo" : "real";
  await closeAutoTradingPositions(req.userId!, accountType);
  await releaseAutoTradingBudget(req.userId!, accountType);
  const data = await getAutoTradingData(req.userId!, accountType);
  res.json({ enabled: false, accountType, wallet: data.wallet, openTrades: data.openTrades, closedTrades: data.closedTrades, message: "Auto trading stopped and open AI positions were closed." });
});

export default router;
