import { db, tradesTable, walletsTable, demoWalletsTable } from "@workspace/db";
import { eq, and, desc, sql } from "drizzle-orm";
import { getCurrentPrice, SYMBOLS } from "./market.js";
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
  lastPrices: Record<string, number>;
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

function pickSignal(runtime: Runtime): { symbol: string; direction: "buy" | "sell" } | null {
  const candidates = runtime.config.asset === "ALL" ? SYMBOLS.filter((s) => ["EURUSD","GBPUSD","USDJPY","XAUUSD","BTCUSD","ETHUSD","NASDAQ"].includes(s)) : [runtime.config.asset];
  let best: { symbol: string; direction: "buy" | "sell"; move: number } | null = null;

  for (const symbol of candidates) {
    const price = getCurrentPrice(symbol);
    const mid = (price.bid + price.ask) / 2;
    const previous = runtime.lastPrices[symbol];
    runtime.lastPrices[symbol] = mid;
    if (!previous || previous <= 0) continue;
    const move = (mid - previous) / previous;
    if (Math.abs(move) < (runtime.config.strategy === "scalp" ? 0.000005 : 0.00001)) continue;
    const direction = move > 0 ? "buy" : "sell";
    if (!best || Math.abs(move) > Math.abs(best.move)) best = { symbol, direction, move };
  }

  return best ? { symbol: best.symbol, direction: best.direction } : null;
}

async function openAutoTrade(userId: number, runtime: Runtime) {
  const walletTable = runtime.accountType === "demo" ? demoWalletsTable : walletsTable;
  const [wallet] = await db.select().from(walletTable).where(eq(walletTable.userId, userId)).limit(1);
  if (!wallet) return;

  const balance = Number(wallet.balance);
  if (balance < 1) return;
  if (Number(runtime.config.investmentAmount) > balance) return;

  const open = await db.select().from(tradesTable).where(and(
    eq(tradesTable.userId, userId),
    eq(tradesTable.accountType, runtime.accountType),
    eq(tradesTable.status, "open")
  ));
  if (open.length >= runtime.config.maxTrades) return;

  const signal = pickSignal(runtime);
  if (!signal) return;

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

  await db.update(walletTable)
    .set({ balance: sql`${walletTable.balance} - ${amount}` })
    .where(and(eq(walletTable.userId, userId), sql`${walletTable.balance} >= ${amount}`));

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

  logger.info({ userId, accountType: runtime.accountType, tradeId: created.id, symbol: created.symbol, direction: created.direction }, "Auto trade opened");
}

async function tick(userId: number) {
  const runtime = runtimes.get(userId);
  if (!runtime?.enabled) return;

  try {
    const walletTable = runtime.accountType === "demo" ? demoWalletsTable : walletsTable;
    const [wallet] = await db.select().from(walletTable).where(eq(walletTable.userId, userId)).limit(1);
    if (!wallet) return;

    const open = await db.select().from(tradesTable).where(and(
      eq(tradesTable.userId, userId),
      eq(tradesTable.accountType, runtime.accountType),
      eq(tradesTable.status, "open")
    ));

    if (open.length < runtime.config.maxTrades) {
      await openAutoTrade(userId, runtime);
    }

    // Daily protection is enforced from today's realized P/L.
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
  const runtime: Runtime = {
    accountType,
    config: merged,
    enabled: true,
    timer: null,
    lastPrices: {},
  };
  // Re-evaluate the selected market every five seconds using the same price engine as the trade chart.\n  runtime.timer = setInterval(() => void tick(userId), 5000);
  runtimes.set(userId, runtime);
  // First scan is immediate; a trade opens only after the engine has enough price movement to produce a signal.\n  void tick(userId);
  return merged;
}

export function stopAutoTrading(userId: number) {
  const runtime = runtimes.get(userId);
  if (runtime?.timer) clearInterval(runtime.timer);
  if (runtime) runtime.enabled = false;
  runtimes.delete(userId);
}

export function getAutoTradingStatus(userId: number) {
  const runtime = runtimes.get(userId);
  return runtime ? {
    enabled: runtime.enabled,
    accountType: runtime.accountType,
    config: runtime.config,
  } : {
    enabled: false,
    accountType: "real" as AccountType,
    config: DEFAULTS,
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
