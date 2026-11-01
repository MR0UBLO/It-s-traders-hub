import { seedCandles, tickCandles, rebaseCandles } from "./candle-engine.js";

// ─── Symbol configuration ───────────────────────────────────────────────────

export const FOREX_PAIRS = [
  "USDCHF",
  "AUDUSD",
  "USDCAD",
  "NZDUSD",
  "EURGBP",
  "EURJPY",
  "EURCHF",
  "EURCAD",
  "EURNZD",
  "EURAUD",
  "GBPJPY",
  "GBPCHF",
  "GBPCAD",
  "GBPAUD",
  "GBPNZD",
  "AUDJPY",
  "AUDCAD",
  "AUDCHF",
  "AUDNZD",
  "CADJPY",
  "CADCHF",
  "CHFJPY",
  "NZDJPY",
  "NZDCAD",
  "NZDCHF",
  "USDSGD",
  "USDHKD",
  "USDZAR",
  "USDMXN",
  "USDTRY",
  "USDSEK",
  "USDNOK",
  "USDDKK",
  "USDPLN",
  "USDHUF",
  "USDCZK",
  "USDILS",
  "USDTHB",
  "USDCNH",
  "USDINR",
  "USDKRW",
  "EURSEK",
  "EURNOK",
  "EURDKK",
  "EURPLN",
  "EURHUF",
  "EURCZK",
  "GBPSEK",
  "GBPNOK",
  "AUDSGD",
] as const;

export const SYMBOLS = ["XAUUSD", "EURUSD", "BTCUSD", "GBPUSD", "USDJPY", "ETHUSD", ...FOREX_PAIRS] as const;
export type Symbol = (typeof SYMBOLS)[number];
const FOREX_SYMBOL_SET = new Set<string>(["EURUSD", "GBPUSD", "USDJPY", ...FOREX_PAIRS]);

const BASE_PRICES: Record<Symbol, number> = {
  // Fallback reference levels; live quotes re-anchor every instrument at startup.
  XAUUSD: 4140.52, EURUSD: 1.1257, BTCUSD: 84820.17,
  GBPUSD: 1.3246, USDJPY: 157.87, ETHUSD: 2694.0,
  USDCHF: 0.80, AUDUSD: 0.65, USDCAD: 1.39, NZDUSD: 0.57,
  EURGBP: 0.85, EURJPY: 173.8, EURCHF: 0.94, EURCAD: 1.56,
  EURNZD: 1.98, EURAUD: 1.72, GBPJPY: 198.5, GBPCHF: 1.07,
  GBPCAD: 1.82, GBPAUD: 2.01, GBPNZD: 2.31, AUDJPY: 102.7,
  AUDCAD: 0.90, AUDCHF: 0.52, AUDNZD: 1.13, CADJPY: 113.5,
  CADCHF: 0.58, CHFJPY: 181.5, NZDJPY: 90.1, NZDCAD: 0.79,
  NZDCHF: 0.46, USDSGD: 1.29, USDHKD: 7.80, USDZAR: 17.5,
  USDMXN: 18.3, USDTRY: 42.0, USDSEK: 9.45, USDNOK: 10.1,
  USDDKK: 6.45, USDPLN: 3.65, USDHUF: 335, USDCZK: 21.3,
  USDILS: 3.25, USDTHB: 32.5, USDCNH: 7.12, USDINR: 88.5,
  USDKRW: 1430, EURSEK: 10.9, EURNOK: 11.7, EURDKK: 7.46,
  EURPLN: 4.25, EURHUF: 390, EURCZK: 24.8, GBPSEK: 12.7,
  GBPNOK: 13.6, AUDSGD: 0.84,
};

// Current-market reference symbols. Prices are fetched server-side so the
// existing simulator starts from the latest available market level and then
// continues generating its normal simulated ticks between refreshes.
const LIVE_REFERENCE_TICKERS: Partial<Record<Symbol, string>> = {
  XAUUSD: "GC=F",
  BTCUSD: "BTC-USD",
  ETHUSD: "ETH-USD",
};

const LIVE_REFERENCE_REFRESH_MS = 60_000;

const SPREADS: Record<Symbol, number> = Object.fromEntries(
  SYMBOLS.map((symbol) => {
    if (symbol === "XAUUSD") return [symbol, 0.5];
    if (symbol === "BTCUSD") return [symbol, 50.0];
    if (symbol === "ETHUSD") return [symbol, 2.0];
    if (symbol.endsWith("JPY")) return [symbol, 0.02];
    if (["USDZAR", "USDMXN", "USDTRY", "USDHUF", "USDINR", "USDKRW", "USDTHB", "USDILS"].includes(symbol)) return [symbol, 0.02];
    return [symbol, 0.0002];
  }),
) as Record<Symbol, number>;

const BASE_VOLATILITY: Record<Symbol, number> = Object.fromEntries(
  SYMBOLS.map((symbol) => [
    symbol,
    symbol === "BTCUSD" || symbol === "ETHUSD" ? 0.0015
      : symbol === "XAUUSD" ? 0.0006
      : ["USDZAR", "USDMXN", "USDTRY", "USDHUF", "USDINR", "USDKRW", "USDTHB", "USDILS"].includes(symbol) ? 0.0008
      : 0.00035,
  ]),
) as Record<Symbol, number>;

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
  lastTickAt: number;     // wall-clock time of the last simulated movement
}

const trendStates: Record<string, TrendState> = {};
const priceStates: Record<string, PriceState> = {};
const referenceInitialized = new Set<Symbol>();

// All consumers (Markets, Trade, TradingView and trades) read the same
// server-side simulated price. Movement is time-based rather than request-based,
// so polling one page cannot make its price drift away from another page.
const SIMULATION_TICK_MS = 1_000;
const MAX_CATCH_UP_TICKS = 5;

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
  const isForex = FOREX_SYMBOL_SET.has(symbol);
  const isCrypto = ["BTCUSD", "ETHUSD"].includes(symbol);
  if (isForex && session === "London") return 1.5;
  if (isForex && session === "Overlap") return 1.8;
  if (isCrypto) return 1.1; // crypto active 24h
  return 1.0;
}

// ─── Current market reference ────────────────────────────────────────────────

async function fetchYahooReference(ticker: string): Promise<{ price: number; previousClose: number } | null> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?range=5d&interval=1d&includePrePost=false`;
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) return null;
    const payload = await response.json() as {
      chart?: { result?: Array<{ meta?: { regularMarketPrice?: number; chartPreviousClose?: number } }> };
    };
    const meta = payload.chart?.result?.[0]?.meta;
    const price = Number(meta?.regularMarketPrice);
    const previousClose = Number(meta?.chartPreviousClose);
    if (!Number.isFinite(price) || price <= 0) return null;
    return { price, previousClose: Number.isFinite(previousClose) && previousClose > 0 ? previousClose : price };
  } catch {
    return null;
  }
}

async function fetchLiveReferencePrice(
  symbol: Symbol,
  currencyCache: Map<string, Promise<{ price: number; previousClose: number } | null>>,
): Promise<{ price: number; previousClose: number } | null> {
  const ticker = LIVE_REFERENCE_TICKERS[symbol] ?? (FOREX_SYMBOL_SET.has(symbol) ? `${symbol}=X` : null);
  if (ticker) {
    const direct = await fetchYahooReference(ticker);
    if (direct) return direct;
  }

  if (!FOREX_SYMBOL_SET.has(symbol)) return null;
  const getUsdValue = (currency: string): Promise<{ price: number; previousClose: number } | null> => {
    if (currency === "USD") return Promise.resolve({ price: 1, previousClose: 1 });
    const cached = currencyCache.get(currency);
    if (cached) return cached;
    const request = (async () => {
      const direct = await fetchYahooReference(`${currency}USD=X`);
      if (direct) return direct;
      const inverse = await fetchYahooReference(`USD${currency}=X`);
      return inverse && inverse.price > 0
        ? { price: 1 / inverse.price, previousClose: 1 / inverse.previousClose }
        : null;
    })();
    currencyCache.set(currency, request);
    return request;
  };
  const [base, quote] = await Promise.all([
    getUsdValue(symbol.slice(0, 3)),
    getUsdValue(symbol.slice(3, 6)),
  ]);
  if (!base || !quote || quote.price <= 0 || quote.previousClose <= 0) return null;
  return {
    price: base.price / quote.price,
    previousClose: base.previousClose / quote.previousClose,
  };
}

async function refreshLiveMarketReferences(): Promise<void> {
  const currencyCache = new Map<string, Promise<{ price: number; previousClose: number } | null>>();
  const results = await Promise.all(
    SYMBOLS.map(async (symbol) => [symbol, await fetchLiveReferencePrice(symbol, currencyCache)] as const),
  );
  for (const [symbol, reference] of results) {
    if (!reference) continue;
    BASE_PRICES[symbol] = reference.price;
    const state = priceStates[symbol];
    if (!state) continue;
    if (!referenceInitialized.has(symbol)) {
      rebaseCandles(symbol, reference.price);
      referenceInitialized.add(symbol);
    }
    state.bid = reference.price;
    state.ask = reference.price + SPREADS[symbol];
    state.open24h = reference.previousClose;
    state.history.push(reference.price);
    if (state.history.length > 200) state.history.shift();
  }
}

function startLiveReferenceRefresh(): void {
  void refreshLiveMarketReferences();
  setInterval(() => {
    void refreshLiveMarketReferences();
  }, LIVE_REFERENCE_REFRESH_MS);
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

  // The simulated market always starts exactly at the configured/live
  // reference price. Historical values are only chart context; the first
  // live tick begins from base, not from a random historical endpoint.
  priceStates[symbol] = {
    bid: base,
    ask: base + SPREADS[symbol],
    open24h: base,
    history: [...history, base].slice(-200),
    lastTickAt: Date.now(),
  };

  seedCandles(symbol, base);
}

function ensureInit(symbol: Symbol) {
  if (!priceStates[symbol]) initSymbol(symbol);
}

// ─── Tick update ─────────────────────────────────────────────────────────────

function tickSymbol(symbol: Symbol): void {
  ensureInit(symbol);

  const trend = trendStates[symbol];
  const state = priceStates[symbol];

  const now = Date.now();
  const elapsedTicks = Math.min(
    MAX_CATCH_UP_TICKS,
    Math.floor((now - state.lastTickAt) / SIMULATION_TICK_MS),
  );

  // Do not advance the market merely because another component requested it.
  // Markets and Trade therefore see the same simulated value between ticks.
  if (elapsedTicks <= 0) return;

  state.lastTickAt += elapsedTicks * SIMULATION_TICK_MS;

  for (let i = 0; i < elapsedTicks; i++) {
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
}

// ─── Simulator state exposed to the AI ────────────────────────────────────────

export interface SimulationContext {
  direction: 1 | -1;
  strength: number;
  ticksRemaining: number;
  volatilityMultiplier: number;
  ticksUntilPossibleSpike: number;
  spikeActive: boolean;
}

/**
 * Read the same hidden trend/volatility state that drives simulated price ticks.
 * This is context, not knowledge of the next random noise value or a promise
 * that the next price movement will follow the trend.
 */
export function getSimulationContext(symbol: string): SimulationContext | null {
  if (!SYMBOLS.includes(symbol as Symbol)) return null;
  const sym = symbol as Symbol;
  ensureInit(sym);
  tickSymbol(sym);
  const trend = trendStates[sym];
  if (!trend) return null;
  return {
    direction: trend.direction,
    strength: trend.strength,
    ticksRemaining: trend.ticksRemaining,
    volatilityMultiplier: trend.volMultiplier,
    ticksUntilPossibleSpike: trend.spikeCountdown,
    spikeActive: trend.volMultiplier >= 1.8,
  };
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

// Bootstrap all symbols on module load, then keep the simulation
// re-anchored to the latest available market reference.
for (const sym of SYMBOLS) ensureInit(sym);
startLiveReferenceRefresh();
