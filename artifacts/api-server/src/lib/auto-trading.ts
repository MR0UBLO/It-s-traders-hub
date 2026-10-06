import { db, tradesTable, walletsTable, demoWalletsTable } from "@workspace/db";
import { eq, and, desc, sql } from "drizzle-orm";
import { getCurrentPrice, SYMBOLS } from "./market.js";
import { generateSignalForSymbol } from "./ai-engine.js";
import { logger } from "./logger.js";

type AccountType = "real" | "demo";
type Strategy = "trend" | "scalp" | "swing" | "breakout" | "grid" | "smc";

export type AutoTradingConfig = {
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
  tradeDuration: 3600,
  asset: "EURUSD",
  aiSpeed: "fast",
};

const pipSize = (symbol: string) =>
  symbol === "EURUSD" || symbol === "GBPUSD" ? 0.0001 :
  symbol === "USDJPY" ? 0.01 : 1;

const ticket = () => `AT-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

function pickSignal(runtime: Runtime): { symbol: string; direction: "buy" | "sell"; confidence: number; reason: string } | null {
  const candidates = runtime.config.asset === "ALL"
    ? SYMBOLS.filter((s) => ["EURUSD","GBPUSD","USDJPY","XAUUSD","BTCUSD","ETHUSD"].includes(s))
    : [runtime.config.asset];

  let best: { symbol: string; direction: "buy" | "sell"; confidence: number; reason: string } | null = null;

  for (const symbol of candidates) {
    if (!SYMBOLS.includes(symbol as typeof SYMBOLS[number])) continue;

    // Use the same shared candle/price history as the TradingView-style chart.
    // The AI engine combines EMA/SMA-style trend confirmation with RSI,
    // momentum and volatility before choosing a direction.
    const signal = generateSignalForSymbol(symbol as typeof SYMBOLS[number]);

    if (signal.signal === "HOLD") {
      continue;
    }

    const candidate = {
      symbol,
      direction: signal.signal === "BUY" ? "buy" as const : "sell" as const,
      confidence: signal.confidence,
      reason: signal.reason,
    };

    if (!best || candidate.confidence > best.confidence) best = candidate;
  }

  return best;
}

async function openAutoTrade(userId: number, runtime: Runtime) {
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
  const amount = Math.max(1, Math.min(Number.isFinite(requested) && requested > 0 ? requested : balance * (runtime.config.riskPct / 100), balance));
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

  runtime.lastActionAt = Date.now();
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
    const profitLoss = win ? amount * (payoutPercent / 100) : -amount;
    const payout = win ? amount + profitLoss : 0;

    const updated = await db.update(tradesTable).set({
      status: "closed",
      result: win ? "WIN" : "LOSS",
      closePrice: String(closePrice),
      profitLoss: String(Number(profitLoss.toFixed(4))),
      profitLossPercent: String(Number(((profitLoss / amount) * 100).toFixed(4))),
      closedAt: new Date(),
    }).where(and(eq(tradesTable.id, trade.id), eq(tradesTable.status, "open"))).returning();

    if (updated.length) {
      await db.update(walletTable).set({
        balance: sql`${walletTable.balance} + ${payout}`,
        totalProfit: sql`${walletTable.totalProfit} + ${profitLoss}`,
      }).where(eq(walletTable.userId, userId));

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
    const [wallet] = await db.select().from(walletTable).where(eq(walletTable.userId, userId)).limit(1);
    if (!wallet) return;

    await settleOpenTrades(userId, runtime);

    const open = await db.select().from(tradesTable).where(and(
      eq(tradesTable.userId, userId),
      eq(tradesTable.accountType, runtime.accountType),
      eq(tradesTable.status, "open")
    ));

    if (open.length < runtime.config.maxTrades) {
      await openAutoTrade(userId, runtime);
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const closed = await db.select().from(tradesTable).where(and(
      eq(tradesTable.userId, userId),
      eq(tradesTable.accountType, runtime.accountType),
      eq(tradesTable.status, "closed")
    ));
    const todayPL = closed
      .filter((t) => t.closedAt && new Date(t.closedAt) >= today)
      .reduce((sum, t) => sum + Number(t.profitLoss ?? 0), 0);
    const startingBalance = Number(wallet.balance) + Math.max(0, -todayPL);
    if (startingBalance > 0 && (
      todayPL >= startingBalance * runtime.config.dailyTargetPct / 100 ||
      todayPL <= -startingBalance * runtime.config.dailyLossPct / 100
    )) {
      stopAutoTrading(userId);
    }
  } catch (err) {
    logger.error({ err, userId }, "Auto trading tick failed");
  }
}

export function startAutoTrading(userId: number, accountType: AccountType, config: Partial<AutoTradingConfig> = {}) {
  stopAutoTrading(userId);
  const merged = { ...DEFAULTS, ...config };
  const now = Date.now();
  const runtime: Runtime = {
    accountType,
    config: merged,
    enabled: true,
    timer: null,
    startedAt: now,
    lastActionAt: null,
    lastAction: "Starting AI analysis",
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
    const profitLoss = win ? amount * (payoutPercent / 100) : -amount;
    const payout = win ? amount + profitLoss : 0;

    const updated = await db.update(tradesTable).set({
      status: "closed",
      result: win ? "WIN" : "LOSS",
      closePrice: String(closePrice),
      profitLoss: String(Number(profitLoss.toFixed(4))),
      profitLossPercent: String(Number(((profitLoss / amount) * 100).toFixed(4))),
      closedAt: new Date(),
    }).where(and(eq(tradesTable.id, trade.id), eq(tradesTable.status, "open"))).returning();

    if (updated.length) {
      await db.update(walletTable).set({
        balance: sql`${walletTable.balance} + ${payout}`,
        totalProfit: sql`${walletTable.totalProfit} + ${profitLoss}`,
      }).where(eq(walletTable.userId, userId));
    }
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
  return {
    wallet: wallet ? { balance: Number(wallet.balance), totalProfit: Number(wallet.totalProfit), totalDeposited: Number(wallet.totalDeposited) } : null,
    openTrades: trades.filter((t) => t.status === "open"),
    closedTrades: trades.filter((t) => t.status === "closed"),
  };
}