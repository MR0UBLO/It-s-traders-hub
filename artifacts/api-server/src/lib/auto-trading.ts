import { db, tradesTable, walletsTable, demoWalletsTable, eaBudgetsTable } from "@workspace/db";
import { eq, and, desc, sql } from "drizzle-orm";
import { getCurrentPrice, getPriceTicks, getSimulationContext, SYMBOLS } from "./market.js";
import { generateSignalForSymbol } from "./ai-engine.js";
import { logger } from "./logger.js";
import { calculateBinarySettlement } from "./binary-settlement.js";

type AccountType = "real" | "demo";
type Strategy = "trend" | "scalp" | "swing" | "breakout" | "grid" | "smc";

export type AutoTradingConfig = {
  eaId?: string;
  strategy: Strategy;
  riskPct: number;
  lotSize: number;
  dailyTargetPct: number;
  dailyLossPct: number;
  maxTrades: number;
  stopLossPips: number;
  takeProfitPips: number;
  trailingStop: boolean;
  breakEven: boolean;
  investmentAmount: number;
  tradeDuration: number;
  sessionDurationSeconds: number;
  asset: string;
  aiSpeed?: "fast" | "slow";
};

type Runtime = {
  accountType: AccountType;
  budgetId: number;
  config: AutoTradingConfig;
  enabled: boolean;
  timer: ReturnType<typeof setInterval> | null;
  startedAt: number;
  lastActionAt: number | null;
  lastAction: string;
  lastEntryAt: number | null;
  tradesOpened: number;
  wins: number;
  losses: number;
};

const runtimes = new Map<number, Runtime>();

const DEFAULTS: AutoTradingConfig = {
  strategy: "trend",
  riskPct: 2,
  lotSize: 0.1,
  dailyTargetPct: 5,
  dailyLossPct: 3,
  maxTrades: 5,
  stopLossPips: 30,
  takeProfitPips: 60,
  trailingStop: false,
  breakEven: false,
  investmentAmount: 10,
  tradeDuration: 5,
  sessionDurationSeconds: 300,
  asset: "EURUSD",
  aiSpeed: "fast",
};

const pipSize = (symbol: string) =>
  symbol === "EURUSD" || symbol === "GBPUSD" ? 0.0001 :
  symbol === "USDJPY" ? 0.01 : 1;

const ticket = (budgetId: number) => `AT-${budgetId}-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

function pickSignal(runtime: Runtime): { symbol: string; direction: "buy" | "sell"; confidence: number; reason: string } | null {
  const candidates = runtime.config.asset === "ALL" ? [...SYMBOLS] : [runtime.config.asset];
  let best: { symbol: string; direction: "buy" | "sell"; confidence: number; reason: string } | null = null;

  for (const rawSymbol of candidates) {
    if (!SYMBOLS.includes(rawSymbol as typeof SYMBOLS[number])) continue;
    const symbol = rawSymbol as typeof SYMBOLS[number];
    const signal = generateSignalForSymbol(symbol);
    const ticks = getPriceTicks(symbol);
    const simulation = getSimulationContext(symbol);
    if (ticks.length < 25) continue;

    const current = ticks[ticks.length - 1];
    const previous = ticks[ticks.length - 2];
    const recent = ticks.slice(-6);
    const changes = recent.slice(1).map((value, i) => value - recent[i]);
    const mean = ticks.slice(-30).reduce((sum, value) => sum + value, 0) / Math.min(30, ticks.length);
    const variance = ticks.slice(-30).reduce((sum, value) => sum + (value - mean) ** 2, 0) / Math.min(30, ticks.length);
    const deviation = Math.sqrt(variance);
    const baseDirection = signal.signal === "BUY" ? "buy" : signal.signal === "SELL" ? "sell" : null;
    const spike = !!simulation?.spikeActive;
    let direction: "buy" | "sell" | null = null;
    let confidence = signal.confidence;
    let strategyReason = "";

    switch (runtime.config.strategy) {
      case "trend": {
        if (baseDirection && simulation && simulation.direction === (baseDirection === "buy" ? 1 : -1)
          && simulation.strength >= 0.3 && simulation.ticksRemaining > 5 && !spike) {
          direction = baseDirection;
          strategyReason = "trend-following: simulator trend and indicators agree";
        }
        break;
      }
      case "swing": {
        if (baseDirection && simulation && simulation.direction === (baseDirection === "buy" ? 1 : -1)
          && simulation.strength >= 0.55 && simulation.ticksRemaining > 15 && !spike
          && signal.confidence >= 76) {
          direction = baseDirection;
          strategyReason = "swing: stronger, established trend confirmed";
        }
        break;
      }
      case "scalp": {
        if (!spike && baseDirection) {
          const alignedMoves = changes.filter((change) => baseDirection === "buy" ? change > 0 : change < 0).length;
          const netMove = current - recent[0];
          const netAligned = baseDirection === "buy" ? netMove > 0 : netMove < 0;
          if (alignedMoves >= 4 && netAligned && signal.confidence >= 72) {
            direction = baseDirection;
            confidence = Math.min(94, confidence + alignedMoves * 2);
            strategyReason = "scalp: short-term tick momentum confirms";
          }
        }
        break;
      }
      case "breakout": {
        const range = ticks.slice(-22, -2);
        const high = Math.max(...range);
        const low = Math.min(...range);
        if (!spike && baseDirection === "buy" && current > high && signal.confidence >= 70) {
          direction = "buy";
          strategyReason = "breakout: price moved above the recent tick range";
        } else if (!spike && baseDirection === "sell" && current < low && signal.confidence >= 70) {
          direction = "sell";
          strategyReason = "breakout: price moved below the recent tick range";
        }
        break;
      }
      case "grid": {
        if (!spike && deviation > 0 && Math.abs(current - mean) >= deviation * 0.8) {
          direction = current > mean ? "sell" : "buy";
          confidence = Math.min(90, Math.max(70, Math.round(68 + Math.abs(current - mean) / deviation * 4)));
          strategyReason = "grid: mean-reversion setup away from the short-term average";
        }
        break;
      }
      case "smc": {
        const priorRange = ticks.slice(-22, -2);
        if (!spike && priorRange.length >= 10) {
          const priorHigh = Math.max(...priorRange);
          const priorLow = Math.min(...priorRange);
          // Look for a sweep beyond the recent range followed by a reversal.
          if (previous > priorHigh && current < previous) {
            direction = "sell";
            strategyReason = "SMC: recent high sweep with downward rejection";
          } else if (previous < priorLow && current > previous) {
            direction = "buy";
            strategyReason = "SMC: recent low sweep with upward rejection";
          }
        }
        break;
      }
    }

    if (!direction || confidence < 70) continue;
    const candidate = {
      symbol,
      direction,
      confidence,
      reason: `${strategyReason}; ${signal.reason}`,
    };
    if (!best || candidate.confidence > best.confidence) best = candidate;
  }
  if (best) return best;

  // Do not bypass the selected strategy when its confirmation rules are not met.
  // A session may wait for a valid setup instead of placing an unconfirmed trade.
  return null;
}

async function openAutoTrade(userId: number, runtime: Runtime) {
  // Only the amount reserved into this EA's dedicated budget can be used.
  const entryIntervalMs = runtime.config.aiSpeed === "slow" ? 10_000 : 5_000;
  if (runtime.lastEntryAt != null && Date.now() - runtime.lastEntryAt < entryIntervalMs) return;
  const [budget] = await db.select().from(eaBudgetsTable).where(and(
    eq(eaBudgetsTable.id, runtime.budgetId),
    eq(eaBudgetsTable.userId, userId),
    eq(eaBudgetsTable.accountType, runtime.accountType),
    eq(eaBudgetsTable.status, "active")
  )).limit(1);
  if (!budget) {
    runtime.lastAction = "EA budget is unavailable";
    runtime.lastActionAt = Date.now();
    return;
  }
  if (Number(budget.tradesOpened) >= runtime.config.maxTrades) {
    runtime.lastAction = `Trade limit reached (${runtime.config.maxTrades})`;
    runtime.lastActionAt = Date.now();
    return;
  }

  const openTrades = await db.select().from(tradesTable).where(and(
    eq(tradesTable.userId, userId),
    eq(tradesTable.accountType, runtime.accountType),
    eq(tradesTable.status, "open")
  ));
  const thisEAsOpenTrades = openTrades.filter((trade) => trade.ticketNumber?.startsWith(`AT-${runtime.budgetId}-`));
  if (thisEAsOpenTrades.length >= runtime.config.maxTrades) {
    runtime.lastAction = `Maximum open trades reached (${runtime.config.maxTrades})`;
    runtime.lastActionAt = Date.now();
    return;
  }

  const signal = pickSignal(runtime);
  if (!signal) {
    runtime.lastAction = "Analyzing chart signals — waiting for confirmation";
    runtime.lastActionAt = Date.now();
    return;
  }

  // investmentAmount is the TOTAL allocated budget. Divide it across the
  // selected number of trades; never size from the user's full wallet balance.
  const amount = Math.floor((Number(budget.allocatedAmount) / runtime.config.maxTrades) * 100) / 100;
  if (!Number.isFinite(amount) || amount < 1) {
    runtime.lastAction = "Each planned trade must be at least $1";
    runtime.lastActionAt = Date.now();
    return;
  }
  const price = getCurrentPrice(signal.symbol);
  const entry = signal.direction === "buy" ? price.ask : price.bid;
  const size = pipSize(signal.symbol);
  const sl = signal.direction === "buy"
    ? entry - runtime.config.stopLossPips * size
    : entry + runtime.config.stopLossPips * size;
  const tp = signal.direction === "buy"
    ? entry + runtime.config.takeProfitPips * size
    : entry - runtime.config.takeProfitPips * size;

  let created: typeof tradesTable.$inferSelect | undefined;
  let updatedBudget: typeof eaBudgetsTable.$inferSelect | undefined;
  try {
    await db.transaction(async (tx) => {
      const [reserved] = await tx.update(eaBudgetsTable).set({
        balance: sql`${eaBudgetsTable.balance} - ${amount}`,
        tradesOpened: sql`${eaBudgetsTable.tradesOpened} + 1`,
      }).where(and(
        eq(eaBudgetsTable.id, runtime.budgetId),
        eq(eaBudgetsTable.status, "active"),
        sql`${eaBudgetsTable.balance} >= ${amount}`,
        sql`${eaBudgetsTable.tradesOpened} < ${runtime.config.maxTrades}`
      )).returning();
      if (!reserved) throw new Error("EA allocation has insufficient remaining funds or reached its trade limit");
      updatedBudget = reserved;
      const [trade] = await tx.insert(tradesTable).values({
        userId,
        accountType: runtime.accountType,
        ticketNumber: ticket(runtime.budgetId),
        symbol: signal.symbol,
        direction: signal.direction,
        amount: String(amount.toFixed(2)),
        duration: runtime.config.tradeDuration,
        expiryTime: new Date(Date.now() + runtime.config.tradeDuration * 1000),
        payoutPercent: "95",
        result: null,
        lotSize: String(runtime.config.lotSize),
        marginUsed: String(Number((amount * 0.01).toFixed(4))),
        entryPrice: String(entry),
        stopLoss: String(sl),
        takeProfit: String(tp),
        status: "open",
        isCopied: false,
      }).returning();
      created = trade;
    });
  } catch (error) {
    runtime.lastAction = error instanceof Error ? error.message : "Unable to reserve stake from the EA budget";
    runtime.lastActionAt = Date.now();
    return;
  }
  if (!created) return;
  runtime.lastEntryAt = Date.now();
  runtime.lastActionAt = runtime.lastEntryAt;
  runtime.tradesOpened = Number(updatedBudget?.tradesOpened ?? runtime.tradesOpened + 1);
  runtime.lastAction = `Opened ${created.direction.toUpperCase()} ${created.symbol} • stake $${created.amount} • ${created.duration}s`;
  logger.info({ userId, accountType: runtime.accountType, budgetId: runtime.budgetId, tradeId: created.id, symbol: created.symbol, direction: created.direction, confidence: signal.confidence }, "Auto trade opened");
}

async function settleOpenTrades(userId: number, runtime: Runtime) {
  const allOpenTrades = await db.select().from(tradesTable).where(and(
    eq(tradesTable.userId, userId),
    eq(tradesTable.accountType, runtime.accountType),
    eq(tradesTable.status, "open")
  ));
  const openTrades = allOpenTrades.filter((trade) => trade.ticketNumber?.startsWith(`AT-${runtime.budgetId}-`));

  for (const trade of openTrades) {
    const now = Date.now();
    const expiry = new Date(trade.expiryTime).getTime();
    const price = getCurrentPrice(trade.symbol);
    const closePrice = trade.direction === "buy" ? price.bid : price.ask;
    const stopHit = trade.stopLoss != null && (
      trade.direction === "buy" ? closePrice <= Number(trade.stopLoss) : closePrice >= Number(trade.stopLoss)
    );
    const targetHit = trade.takeProfit != null && (
      trade.direction === "buy" ? closePrice >= Number(trade.takeProfit) : closePrice <= Number(trade.takeProfit)
    );
    if (!stopHit && !targetHit && now < expiry) continue;

    const amount = Number(trade.amount);
    const payoutPercent = Number(trade.payoutPercent ?? 95);
    const win = targetHit || (!stopHit && (
      trade.direction === "buy" ? closePrice > Number(trade.entryPrice) : closePrice < Number(trade.entryPrice)
    ));
    const { profit: profitLoss, returnAmount: payout } = calculateBinarySettlement(amount, payoutPercent, win);
    const settled = await db.transaction(async (tx) => {
      const [closedTrade] = await tx.update(tradesTable).set({
        status: "closed",
        result: win ? "WIN" : "LOSS",
        closePrice: String(closePrice),
        profitLoss: String(profitLoss),
        profitLossPercent: String(Number(((profitLoss / amount) * 100).toFixed(4))),
        closedAt: new Date(),
      }).where(and(eq(tradesTable.id, trade.id), eq(tradesTable.status, "open"))).returning();
      if (!closedTrade) return false;
      const [budget] = await tx.update(eaBudgetsTable).set({
        balance: sql`${eaBudgetsTable.balance} + ${payout}`,
      }).where(and(eq(eaBudgetsTable.id, runtime.budgetId), eq(eaBudgetsTable.status, "active"))).returning();
      const walletTable = runtime.accountType === "demo" ? demoWalletsTable : walletsTable;
      await tx.update(walletTable).set({
        ...(budget ? {} : { balance: sql`${walletTable.balance} + ${payout}` }),
        totalProfit: sql`${walletTable.totalProfit} + ${profitLoss}`,
      }).where(eq(walletTable.userId, userId));
      return true;
    });

    if (settled) {
      if (win) runtime.wins += 1;
      else runtime.losses += 1;
      runtime.lastActionAt = Date.now();
      runtime.lastAction = `Closed ${trade.symbol}: ${win ? "WIN" : "LOSS"} (${profitLoss.toFixed(2)})`;
      logger.info({ userId, accountType: runtime.accountType, budgetId: runtime.budgetId, tradeId: trade.id, symbol: trade.symbol, result: win ? "WIN" : "LOSS", profitLoss }, "Auto trade settled");
    }
  }
}

async function tick(userId: number) {
  const runtime = runtimes.get(userId);
  if (!runtime?.enabled) return;

  try {
    await settleOpenTrades(userId, runtime);

    const allOpen = await db.select().from(tradesTable).where(and(
      eq(tradesTable.userId, userId),
      eq(tradesTable.accountType, runtime.accountType),
      eq(tradesTable.status, "open")
    ));
    const open = allOpen.filter((trade) => trade.ticketNumber?.startsWith(`AT-${runtime.budgetId}-`));
    const [budget] = await db.select().from(eaBudgetsTable).where(and(
      eq(eaBudgetsTable.id, runtime.budgetId), eq(eaBudgetsTable.status, "active")
    )).limit(1);
    if (!budget) {
      runtime.lastAction = "EA budget is unavailable";
      runtime.lastActionAt = Date.now();
      stopAutoTrading(userId);
      return;
    }
    runtime.tradesOpened = Number(budget.tradesOpened);

    if (Date.now() >= runtime.startedAt + runtime.config.sessionDurationSeconds * 1000) {
      runtime.lastAction = "Session duration reached — waiting for open trades to settle";
      runtime.lastActionAt = Date.now();
      if (open.length === 0) {
        stopAutoTrading(userId);
        await releaseAutoTradingBudget(userId, runtime.accountType);
      }
      return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const closed = await db.select().from(tradesTable).where(and(
      eq(tradesTable.userId, userId),
      eq(tradesTable.accountType, runtime.accountType),
      eq(tradesTable.status, "closed")
    ));
    const todayPL = closed
      .filter((trade) => trade.ticketNumber?.startsWith(`AT-${runtime.budgetId}-`) && trade.closedAt && new Date(trade.closedAt) >= today)
      .reduce((sum, trade) => sum + Number(trade.profitLoss ?? 0), 0);
    const startingBalance = Number(budget.allocatedAmount);
    const targetReached = startingBalance > 0 &&
      todayPL >= startingBalance * runtime.config.dailyTargetPct / 100;
    const lossLimitReached = startingBalance > 0 &&
      todayPL <= -startingBalance * runtime.config.dailyLossPct / 100;

    if (targetReached || lossLimitReached) {
      runtime.lastAction = targetReached
        ? "Daily target reached — managing open trades, no new entries"
        : "Daily loss limit reached — managing open trades, no new entries";
      runtime.lastActionAt = Date.now();
      // Keep the manager alive until existing positions settle; otherwise their
      // reserved stakes could remain stuck in open trades after the EA stops.
      if (open.length === 0) {
        stopAutoTrading(userId);
        await releaseAutoTradingBudget(userId, runtime.accountType);
      }
      return;
    }

    const nextStake = Math.floor((Number(budget.allocatedAmount) / runtime.config.maxTrades) * 100) / 100;
    if ((Number(budget.tradesOpened) >= runtime.config.maxTrades || Number(budget.balance) < nextStake) && open.length === 0) {
      stopAutoTrading(userId);
      await releaseAutoTradingBudget(userId, runtime.accountType);
      return;
    }
    if (open.length < runtime.config.maxTrades && Number(budget.tradesOpened) < runtime.config.maxTrades && Number(budget.balance) >= nextStake) {
      await openAutoTrade(userId, runtime);
    }
  } catch (err) {
    logger.error({ err, userId }, "Auto trading tick failed");
  }
}

export function startAutoTrading(userId: number, accountType: AccountType, config: Partial<AutoTradingConfig> = {}, budgetId = 0) {
  stopAutoTrading(userId);
  const requestedDuration = Number(config.tradeDuration ?? DEFAULTS.tradeDuration);
  const requestedSessionDuration = Number(config.sessionDurationSeconds ?? DEFAULTS.sessionDurationSeconds);
  const merged = {
    ...DEFAULTS,
    ...config,
    tradeDuration: Math.max(5, Math.min(60, Math.floor(Number.isFinite(requestedDuration) ? requestedDuration : 5))),
    sessionDurationSeconds: Math.max(60, Math.min(3600, Math.floor(Number.isFinite(requestedSessionDuration) ? requestedSessionDuration : DEFAULTS.sessionDurationSeconds))),
  };
  const now = Date.now();
  const runtime: Runtime = {
    accountType,
    budgetId,
    config: merged,
    enabled: true,
    timer: null,
    startedAt: now,
    lastActionAt: null,
    lastAction: "Starting AI analysis",
    lastEntryAt: null,
    tradesOpened: 0,
    wins: 0,
    losses: 0,
  };
  // Tick once per second to manage expiry and the session timer; fast entries are
  // gated to five seconds apart, while slow mode waits ten seconds between entries.
  const intervalMs = 1000;
  runtime.timer = setInterval(() => void tick(userId), intervalMs);
  runtimes.set(userId, runtime);
  void tick(userId);
  return merged;
}

export function stopAutoTrading(userId: number) {
  const runtime = runtimes.get(userId);
  if (runtime?.timer) clearInterval(runtime.timer);
  if (runtime) runtime.enabled = false;
  runtimes.delete(userId);
}

// Manual Stop means stop opening new AI trades and close any positions opened by this
// auto-trading session at the current market price so the rest of the app cannot
// continue displaying them as active after the user has stopped AI Trading.
export async function closeAutoTradingPositions(userId: number, accountType: AccountType) {
  const allOpenTrades = await db.select().from(tradesTable).where(and(
    eq(tradesTable.userId, userId),
    eq(tradesTable.accountType, accountType),
    eq(tradesTable.status, "open")
  ));
  // Never close or settle manual trades when the user stops an EA.
  const openTrades = allOpenTrades.filter((trade) => trade.ticketNumber?.startsWith("AT-"));

  for (const trade of openTrades) {
    const price = getCurrentPrice(trade.symbol);
    const closePrice = trade.direction === "buy" ? price.bid : price.ask;
    const amount = Number(trade.amount);
    const payoutPercent = Number(trade.payoutPercent ?? 95);
    const win = trade.direction === "buy"
      ? closePrice > Number(trade.entryPrice)
      : closePrice < Number(trade.entryPrice);
    const { profit: profitLoss, returnAmount: payout } = calculateBinarySettlement(amount, payoutPercent, win);
    const budgetId = Number(trade.ticketNumber?.split("-")[1]);

    await db.transaction(async (tx) => {
      const [closedTrade] = await tx.update(tradesTable).set({
        status: "closed",
        result: win ? "WIN" : "LOSS",
        closePrice: String(closePrice),
        profitLoss: String(profitLoss),
        profitLossPercent: String(Number(((profitLoss / amount) * 100).toFixed(4))),
        closedAt: new Date(),
      }).where(and(eq(tradesTable.id, trade.id), eq(tradesTable.status, "open"))).returning();
      if (!closedTrade) return;
      const [budget] = await tx.update(eaBudgetsTable).set({
        balance: sql`${eaBudgetsTable.balance} + ${payout}`,
      }).where(and(eq(eaBudgetsTable.id, budgetId), eq(eaBudgetsTable.status, "active"))).returning();
      const walletTable = accountType === "demo" ? demoWalletsTable : walletsTable;
      await tx.update(walletTable).set({
        ...(budget ? {} : { balance: sql`${walletTable.balance} + ${payout}` }),
        totalProfit: sql`${walletTable.totalProfit} + ${profitLoss}`,
      }).where(eq(walletTable.userId, userId));
    });
  }
}

export async function releaseAutoTradingBudget(userId: number, accountType: AccountType) {
  const walletTable = accountType === "demo" ? demoWalletsTable : walletsTable;
  const activeBudgets = await db.select().from(eaBudgetsTable).where(and(
    eq(eaBudgetsTable.userId, userId),
    eq(eaBudgetsTable.accountType, accountType),
    eq(eaBudgetsTable.status, "active")
  ));
  for (const budget of activeBudgets) {
    const allOpen = await db.select().from(tradesTable).where(and(
      eq(tradesTable.userId, userId),
      eq(tradesTable.accountType, accountType),
      eq(tradesTable.status, "open")
    ));
    if (allOpen.some((trade) => trade.ticketNumber?.startsWith(`AT-${budget.id}-`))) continue;
    await db.transaction(async (tx) => {
      const [closedBudget] = await tx.update(eaBudgetsTable).set({ status: "stopped" }).where(and(
        eq(eaBudgetsTable.id, budget.id),
        eq(eaBudgetsTable.status, "active")
      )).returning();
      if (!closedBudget) return;
      await tx.update(walletTable).set({
        balance: sql`${walletTable.balance} + ${closedBudget.balance}`,
      }).where(eq(walletTable.userId, userId));
    });
  }
}

export function getAutoTradingStatus(userId: number) {
  const runtime = runtimes.get(userId);
  return runtime ? {
    enabled: runtime.enabled,
    budgetId: runtime.budgetId,
    accountType: runtime.accountType,
    config: runtime.config,
    startedAt: runtime.startedAt,
    lastActionAt: runtime.lastActionAt,
    lastAction: runtime.lastAction,
    tradesOpened: runtime.tradesOpened,
    wins: runtime.wins,
    losses: runtime.losses,
  } : {
    enabled: false,
    accountType: "real" as AccountType,
    config: DEFAULTS,
    startedAt: null,
    lastActionAt: null,
    lastAction: "AI is idle",
    tradesOpened: 0,
    wins: 0,
    losses: 0,
  };
}

export async function getAutoTradingData(userId: number, accountType: AccountType) {
  const walletTable = accountType === "demo" ? demoWalletsTable : walletsTable;
  const [wallet] = await db.select().from(walletTable).where(eq(walletTable.userId, userId)).limit(1);
  const trades = await db.select().from(tradesTable).where(and(
    eq(tradesTable.userId, userId),
    eq(tradesTable.accountType, accountType)
  )).orderBy(desc(tradesTable.createdAt)).limit(100);
  const openTrades = trades.filter((t) => t.status === "open").map((trade) => {
    const market = getCurrentPrice(trade.symbol);
    const currentPrice = trade.direction === "buy" ? market.bid : market.ask;
    const entry = Number(trade.entryPrice);
    const amount = Number(trade.amount);
    const move = trade.direction === "buy" ? currentPrice - entry : entry - currentPrice;
    const priceScale = trade.symbol === "EURUSD" || trade.symbol === "GBPUSD" ? 10000 : trade.symbol === "USDJPY" ? 100 : 1;
    const floatingProfitLoss = Number.isFinite(entry) && entry !== 0
      ? Number((move * priceScale * amount).toFixed(4))
      : 0;
    return {
      ...trade,
      currentPrice,
      floatingProfitLoss,
      floatingProfitLossPercent: amount > 0 ? Number(((floatingProfitLoss / amount) * 100).toFixed(4)) : 0,
      remainingSeconds: Math.max(0, Math.ceil((new Date(trade.expiryTime).getTime() - Date.now()) / 1000)),
    };
  });
  return {
    wallet: wallet ? { balance: Number(wallet.balance), totalProfit: Number(wallet.totalProfit), totalDeposited: Number(wallet.totalDeposited) } : null,
    openTrades,
    closedTrades: trades.filter((t) => t.status === "closed"),
  };
}