import { seedCandles, tickCandles } from "./candle-engine.js";

// ─── Symbol configuration ───────────────────────────────────────────────────

export const SYMBOLS = ["XAUUSD", "EURUSD", "BTCUSD", "GBPUSD", "USDJPY", "ETHUSD"] as const;
export type Symbol = (typeof SYMBOLS)[number];

const BASE_PRICES: Record<Symbol, number> = {
  XAUUSD: 2847.5,
  EURUSD: 1.0842,
  BTCUSD: 97420.0,
  GBPUSD: 1.2734,
  USDJPY: 149.82,
  ETHUSD: 3842.0,
};

const SPREADS: Record<Symbol, number> = {
  XAUUSD: 0.5,
  EURUSD: 0.0002,
  BTCUSD: 50.0,
  GBPUSD: 0.0003,
  USDJPY: 0.02,
  ETHUSD: 2.0,
};

const BASE_VOLATILITY: Record<Symbol, number> = {
  XAUUSD: 0.0006,
  EURUSD: 0.0003,
  BTCUSD: 0.0012,
  GBPUSD: 0.0004,
  USDJPY: 0.0003,
  ETHUSD: 0.0015,
};

// ─── Trend state ─────────────────────────────────────────────────────────────

interface TrendState {
  direction: 1 | -1;
  strength: number;       // 0.0 – 1.0
  ticksRemaining: number;
  volMultiplier: number;  // 1.0 normal; spikes to 2-4× briefly
  spikeCountdown: number; // ticks until next possible spike
}

// ─── Price state ─────────────────────────────────────────────────────────────

interface PriceState {
  bid: number;
  ask: number;
  open24h: number;
  history: number[];      // last 200 ticks for AI analysis
}

const trendStates: Record<string, TrendState> = {};
const priceStates: Record<string, PriceState> = {};

// ─── Market sessions ─────────────────────────────────────────────────────────

type Session = "Asia" | "London" | "NewYork" | "Overlap";

function currentSession(): Session {
  const hour = new Date().getUTCHours();
  if (hour >= 8 && hour < 13) return "London";
  if (hour >= 13 && hour < 16) return "Overlap";
  if (hour >= 16 && hour < 21) return "NewYork";
  return "Asia";
}

function sessionVolatilityBoost(symbol: Symbol): number {
  const session = currentSession();
  const isForex = ["EURUSD", "GBPUSD", "USDJPY"].includes(symbol);
  const isCrypto = ["BTCUSD", "ETHUSD"].includes(symbol);
  if (isForex && session === "London") return 1.5;
  if (isForex && session === "Overlap") return 1.8;
  if (isCrypto) return 1.1; // crypto active 24h
  return 1.0;
}

// ─── Initialization ───────────────────────────────────────────────────────────

function initSymbol(symbol: Symbol) {
  const base = BASE_PRICES[symbol];

  trendStates[symbol] = {
    direction: Math.random() > 0.5 ? 1 : -1,
    strength: 0.2 + Math.random() * 0.6,
    ticksRemaining: 50 + Math.floor(Math.random() * 150),
    volMultiplier: 1.0,
    spikeCountdown: 20 + Math.floor(Math.random() * 80),
  };

  // Pre-generate 200 historical ticks
  const history: number[] = [];
  let price = base;
  for (let i = 0; i < 200; i++) {
    const change = price * BASE_VOLATILITY[symbol] * (Math.random() * 2 - 1);
    price = Math.max(price + change, base * 0.7);
    history.push(price);
  }

  priceStates[symbol] = {
    bid: price,
    ask: price + SPREADS[symbol],
    open24h: base,
    history,
  };

  seedCandles(symbol, price);
}

function ensureInit(symbol: Symbol) {
  if (!priceStates[symbol]) initSymbol(symbol);
}

// ─── Tick update ─────────────────────────────────────────────────────────────

function tickSymbol(symbol: Symbol): void {
  ensureInit(symbol);

  const trend = trendStates[symbol];
  const state = priceStates[symbol];
  const vol = BASE_VOLATILITY[symbol] * sessionVolatilityBoost(symbol);

  // Trend cycle management
  trend.ticksRemaining--;
  if (trend.ticksRemaining <= 0) {
    trend.direction = (Math.random() > 0.45 ? -trend.direction : trend.direction) as 1 | -1;
    trend.strength = 0.1 + Math.random() * 0.8;
    trend.ticksRemaining = 50 + Math.floor(Math.random() * 200);
  }

  // Volatility spike
  trend.spikeCountdown--;
  if (trend.spikeCountdown <= 0) {
    trend.volMultiplier = 2.0 + Math.random() * 2.0; // spike!
    trend.spikeCountdown = 30 + Math.floor(Math.random() * 100);
    // Spike decays over ~10 ticks (handled below)
  } else if (trend.volMultiplier > 1.0) {
    trend.volMultiplier = Math.max(1.0, trend.volMultiplier * 0.85); // decay
  }

  // Price change = trend component + noise
  const trendBias = vol * trend.direction * trend.strength * 0.4;
  const noise = vol * (Math.random() * 2 - 1);
  const totalChange = state.bid * (trendBias + noise) * trend.volMultiplier;

  const minPrice = BASE_PRICES[symbol] * 0.6;
  const newBid = Math.max(state.bid + totalChange, minPrice);

  state.bid = newBid;
  state.ask = newBid + SPREADS[symbol];
  state.history.push(newBid);
  if (state.history.length > 200) state.history.shift();

  tickCandles(symbol, newBid);
}

// ─── Public API ───────────────────────────────────────────────────────────────

export interface MarketPrice {
  symbol: Symbol;
  bid: number;
  ask: number;
  spread: number;
  change24h: number;
  changePercent24h: number;
}

export function getCurrentPrice(symbol: string): MarketPrice {
  const sym = symbol as Symbol;
  ensureInit(sym);
  tickSymbol(sym);
  const state = priceStates[sym];
  const change24h = state.bid - state.open24h;
  return {
    symbol: sym,
    bid: state.bid,
    ask: state.ask,
    spread: SPREADS[sym],
    change24h,
    changePercent24h: (change24h / state.open24h) * 100,
  };
}

export function updateAllPrices(): MarketPrice[] {
  for (const sym of SYMBOLS) tickSymbol(sym);
  return SYMBOLS.map((sym) => {
    const state = priceStates[sym];
    const change24h = state.bid - state.open24h;
    return {
      symbol: sym,
      bid: state.bid,
      ask: state.ask,
      spread: SPREADS[sym],
      change24h,
      changePercent24h: (change24h / state.open24h) * 100,
    };
  });
}

export function getPriceHistory(symbol: string): Array<{
  timestamp: string; price: number; open: number; high: number; low: number; close: number;
}> {
  const sym = symbol as Symbol;
  ensureInit(sym);
  const history = priceStates[sym]?.history ?? [];
  const now = Date.now();
  return history.map((price, i) => ({
    timestamp: new Date(now - (history.length - i - 1) * 5000).toISOString(),
    price,
    open: price,
    high: price * (1 + Math.random() * 0.0005),
    low: price * (1 - Math.random() * 0.0005),
    close: price,
  }));
}

export function getPriceTicks(symbol: string): number[] {
  const sym = symbol as Symbol;
  ensureInit(sym);
  return priceStates[sym]?.history ?? [];
}

// ─── Simulate trade P/L ──────────────────────────────────────────────────────

export function simulateProfitLoss(): number {
  const isWin = Math.random() < 0.55;
  return isWin ? 1 + Math.random() * 11 : -(1 + Math.random() * 4);
}

// Bootstrap all symbols on module load
for (const sym of SYMBOLS) ensureInit(sym);
