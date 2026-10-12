import { db, tradesTable, walletsTable, demoWalletsTable } from "@workspace/db";
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
  asset: string;
  aiSpeed?: "fast" | "slow";
};

type Runtime = {
  accountType: AccountType;
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
  tradeDuration: 4,
  asset: "EURUSD",
  aiSpeed: "fast",
};

const pipSize = (symbol: string) =>
  symbol === "EURUSD" || symbol === "GBPUSD" ? 0.0001 :
  symbol === "USDJPY" ? 0.01 : 1;

const ticket = () => `AT-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

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
  return best;
}

async function openAutoTrade(userId: number, runtime: Runtime) {
  // Quality over frequency: prevent the EA from stacking entries every second on one setup.
  if (runtime.lastEntryAt != null && Date.now() - runtime.lastEntryAt < 5_000) {
    return;
  }
  const walletTable = runtime.accountType === "demo" ? demoWalletsTable : walletsTable;
  const [wallet] = await db.select().from(walletTable).where(eq(walletTable.userId, userId)).limit(1);
  if (!wallet) {
    runtime.lastAction = "Wallet unavailable";
    runtime.lastActionAt = Date.now();
    return;
  }

  const balance = Number(wallet.balance);
  if (balance < 1) {
    runtime.lastAction = "Insufficient wallet balance";
    runtime.lastActionAt = Date.now();
    return;
  }

  if (Number(runtime.config.investmentAmount) > balance) {
    runtime.lastAction = "Selected stake is above wallet balance";
    runtime.lastActionAt = Date.now();
    return;
  }

  const open = await db.select().from(tradesTable).where(and(
    eq(tradesTable.userId, userId),
    eq(tradesTable.accountType, runtime.accountType),
    eq(tradesTable.status, "open")
  ));
  if (open.length >= runtime.config.maxTrades) {
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

  const requested = Number(runtime.config.investmentAmount);
  const riskPct = Math.max(0.1, Math.min(Number(runtime.config.riskPct) || 2, 5));
  const riskBudget = balance * riskPct / 100;
  const requestedStake = Number.isFinite(requested) && requested > 0 ? requested : riskBudget;
  const amount = Number(Math.max(0.01, Math.min(requestedStake, riskBudget, balance)).toFixed(2));
  const price = getCurrentPrice(signal.symbol);
  const entry = signal.direction === "buy" ? price.ask : price.bid;
  const size = pipSize(signal.symbol);
  const sl = signal.direction === "buy"
    ? entry - runtime.config.stopLossPips * size
    : entry + runtime.config.stopLossPips * size;
  const tp = signal.direction === "buy"
    ? entry + runtime.config.takeProfitPips * size
    : entry - runtime.config.takeProfitPips * size;

  const changed = await db.update(walletTable)
    .set({ balance: sql`${walletTable.balance} - ${amount}` })
    .where(and(eq(walletTable.userId, userId), sql`${walletTable.balance} >= ${amount}`))
    .returning();
  if (!changed.length) {
    runtime.lastAction = "Stake could not be reserved from wallet";
    runtime.lastActionAt = Date.now();
    return;
  }

  const [created] = await db.insert(tradesTable).values({
    userId,
    accountType: runtime.accountType,
    ticketNumber: ticket(),
    symbol: signal.symbol,
    direction: signal.direction,
    amount: String(Number(amount.toFixed(4))),
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

  runtime.lastEntryAt = Date.now();
  runtime.lastActionAt = runtime.lastEntryAt;
  runtime.lastAction = `Opened ${created.direction.toUpperCase()} ${created.symbol} • stake $${created.amount} • ${created.duration}s`;
  runtime.tradesOpened += 1;
  logger.info({ userId, accountType: runtime.accountType, tradeId: created.id, symbol: created.symbol, direction: created.direction, confidence: signal.confidence }, "Auto trade opened");
}

async function settleOpenTrades(userId: number, runtime: Runtime) {
  const walletTable = runtime.accountType === "demo" ? demoWalletsTable : walletsTable;
  const openTrades = await db.select().from(tradesTable).where(and(
    eq(tradesTable.userId, userId),
    eq(tradesTable.accountType, runtime.accountType),
    eq(tradesTable.status, "open")
  ));

  for (const trade of openTrades) {
    const now = Date.now();
    const expiry = new Date(trade.expiryTime).getTime();
    const price = getCurrentPrice(trade.symbol);
    const closePrice = trade.direction === "buy" ? price.bid : price.ask;

    const stopHit = trade.stopLoss != null && (
      trade.direction === "buy"
        ? closePrice <= Number(trade.stopLoss)
        : closePrice >= Number(trade.stopLoss)
    );
    const targetHit = trade.takeProfit != null && (
      trade.direction === "buy"
        ? closePrice >= Number(trade.takeProfit)
        : closePrice <= Number(trade.takeProfit)
    );

    if (!stopHit && !targetHit && now < expiry) continue;

    const amount = Number(trade.amount);
    const payoutPercent = Number(trade.payoutPercent ?? 95);
    const win = targetHit || (
      !stopHit &&
      (trade.direction === "buy" ? closePrice > Number(trade.entryPrice) : closePrice < Number(trade.entryPrice))
    );
    const { profit: profitLoss, returnAmount: payout } = calculateBinarySettlement(amount, payoutPercent, win);

    // Close and credit the matching real/demo wallet atomically. A conditional
    // status update ensures concurrent ticks cannot settle the same trade twice.
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

      await tx.update(walletTable).set({
        balance: sql`${walletTable.balance} + ${payout}`,
        totalProfit: sql`${walletTable.totalProfit} + ${profitLoss}`,
      }).where(eq(walletTable.userId, userId));
      return true;
    });

    if (settled) {
      if (win) runtime.wins += 1;
      else runtime.losses += 1;
      runtime.lastActionAt = Date.now();
      runtime.lastAction = `Closed ${trade.symbol}: ${win ? "WIN" : "LOSS"} (${profitLoss.toFixed(2)})`;
      logger.info({
        userId,
        accountType: runtime.accountType,
        tradeId: trade.id,
        symbol: trade.symbol,
        result: win ? "WIN" : "LOSS",
        profitLoss,
      }, "Auto trade settled");
    }
  }
}

async function tick(userId: number) {
  const runtime = runtimes.get(userId);
  if (!runtime?.enabled) return;

  try {
    const walletTable = runtime.accountType === "demo" ? demoWalletsTable : walletsTable;
    await settleOpenTrades(userId, runtime);

    const open = await db.select().from(tradesTable).where(and(
      eq(tradesTable.userId, userId),
      eq(tradesTable.accountType, runtime.accountType),
      eq(tradesTable.status, "open")
    ));

    const [wallet] = await db.select().from(walletTable).where(eq(walletTable.userId, userId)).limit(1);
    if (!wallet) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const closed = await db.select().from(tradesTable).where(and(
      eq(tradesTable.userId, userId),
      eq(tradesTable.accountType, runtime.accountType),
      eq(tradesTable.status, "closed")
    ));
    const todayPL = closed
      .filter((trade) => trade.closedAt && new Date(trade.closedAt) >= today)
      .reduce((sum, trade) => sum + Number(trade.profitLoss ?? 0), 0);
    // Balance excludes stakes reserved for open trades; add them back to estimate
    // the day's starting equity before comparing realized P/L to daily limits.
    const reservedStake = open.reduce((sum, trade) => sum + Number(trade.amount), 0);
    const startingBalance = Number(wallet.balance) + reservedStake - todayPL;
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
      if (open.length === 0) stopAutoTrading(userId);
      return;
    }

    if (open.length < runtime.config.maxTrades) {
      await openAutoTrade(userId, runtime);
    }
  } catch (err) {
    logger.error({ err, userId }, "Auto trading tick failed");
  }
}

export function startAutoTrading(userId: number, accountType: AccountType, config: Partial<AutoTradingConfig> = {}) {
  stopAutoTrading(userId);
  const requestedDuration = Number(config.tradeDuration ?? DEFAULTS.tradeDuration);
  const merged = { ...DEFAULTS, ...config, tradeDuration: Math.max(1, Math.min(4, Math.floor(Number.isFinite(requestedDuration) ? requestedDuration : 4))) };
  const now = Date.now();
  const runtime: Runtime = {
    accountType,
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
  // A fast cycle scans every second, so a qualifying chart signal is acted on
  // well inside the requested five-second analysis window.
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
  const walletTable = accountType === "demo" ? demoWalletsTable : walletsTable;
  const openTrades = await db.select().from(tradesTable).where(and(
    eq(tradesTable.userId, userId),
    eq(tradesTable.accountType, accountType),
    eq(tradesTable.status, "open")
  ));

  for (const trade of openTrades) {
    const price = getCurrentPrice(trade.symbol);
    const closePrice = trade.direction === "buy" ? price.bid : price.ask;
    const amount = Number(trade.amount);
    const payoutPercent = Number(trade.payoutPercent ?? 95);
    const win = trade.direction === "buy"
      ? closePrice > Number(trade.entryPrice)
      : closePrice < Number(trade.entryPrice);
    const { profit: profitLoss, returnAmount: payout } = calculateBinarySettlement(amount, payoutPercent, win);

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

      await tx.update(walletTable).set({
        balance: sql`${walletTable.balance} + ${payout}`,
        totalProfit: sql`${walletTable.totalProfit} + ${profitLoss}`,
      }).where(eq(walletTable.userId, userId));
    });
  }
}

export function getAutoTradingStatus(userId: number) {
  const runtime = runtimes.get(userId);
  return runtime ? {
    enabled: runtime.enabled,
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