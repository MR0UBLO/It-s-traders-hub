export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export const TIMEFRAMES = ["S5", "S15", "S30", "M1", "M3", "M5", "M15", "M30", "M45", "H1", "H2", "H4", "D1", "W1", "MN"] as const;
export type Timeframe = (typeof TIMEFRAMES)[number];

const TIMEFRAME_MS: Record<Timeframe, number> = {
  S5:  5_000,
  S15: 15_000,
  S30: 30_000,
  M1:  60_000,
  M3:  3 * 60_000,
  M5:  5 * 60_000,
  M15: 15 * 60_000,
  M30: 30 * 60_000,
  M45: 45 * 60_000,
  H1:  60 * 60_000,
  H2:  2 * 60 * 60_000,
  H4:  4 * 60 * 60_000,
  D1:  24 * 60 * 60_000,
  W1:  7 * 24 * 60 * 60_000,
  MN:  30 * 24 * 60 * 60_000,
};

const MAX_CANDLES = 300;

interface CandleState {
  current: Candle;
  history: Candle[];
}

const store: Record<string, Record<string, CandleState>> = {};

function nowAligned(tfMs: number): number {
  return Math.floor(Date.now() / tfMs) * tfMs;
}

function volumeRand(): number {
  return Math.floor(100 + Math.random() * 4900);
}

function normalRandom(): number {
  const u1 = Math.max(Math.random(), Number.EPSILON);
  const u2 = Math.random();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

export function seedCandles(symbol: string, basePrice: number): void {
  if (store[symbol]) return;
  store[symbol] = {};

  for (const tf of TIMEFRAMES) {
    const tfMs = TIMEFRAME_MS[tf];
    const history: Candle[] = [];
    const currentTime = nowAligned(tfMs);
    const candleVolatility = Math.min(0.004, 0.00022 * Math.sqrt(tfMs / 5_000));

    // Generate a stochastic price path (Brownian bridge) around the live
    // reference. It has natural irregular swings but is anchored at both ends,
    // so seeded history cannot drift away from the current simulated quote.
    const increments = Array.from({ length: MAX_CANDLES - 1 }, () => normalRandom() * candleVolatility);
    const cumulative: number[] = [0];
    for (const increment of increments) {
      cumulative.push(cumulative[cumulative.length - 1] + increment);
    }
    const endpoint = cumulative[cumulative.length - 1];
    const closes = cumulative.map((value, index) =>
      basePrice * Math.exp(value - (index / (MAX_CANDLES - 1)) * endpoint),
    );
    closes[closes.length - 1] = basePrice;

    for (let i = 0; i < MAX_CANDLES - 1; i++) {
      const open = closes[i];
      const close = closes[i + 1];
      const wickRange = candleVolatility * (0.12 + Math.random() * 0.38);
      const high = Math.max(open, close) * (1 + wickRange * Math.random());
      const low = Math.min(open, close) * (1 - wickRange * Math.random());
      history.push({
        time: currentTime - (MAX_CANDLES - 1 - i) * tfMs,
        open,
        high,
        low,
        close,
        volume: volumeRand(),
      });
    }

    const price = basePrice;
    store[symbol][tf] = {
      current: {
        time: currentTime,
        open: price,
        high: price,
        low: price,
        close: price,
        volume: 0,
      },
      history,
    };
  }
}

export function rebaseCandles(symbol: string, basePrice: number): void {
  delete store[symbol];
  seedCandles(symbol, basePrice);
}

export function tickCandles(symbol: string, price: number): void {
  if (!store[symbol]) return;

  for (const tf of TIMEFRAMES) {
    const tfMs = TIMEFRAME_MS[tf];
    const state = store[symbol][tf];
    if (!state) continue;

    const alignedNow = nowAligned(tfMs);

    if (alignedNow > state.current.time) {
      state.history.push({ ...state.current });
      if (state.history.length > MAX_CANDLES) state.history.shift();

      state.current = {
        time: alignedNow,
        open: price,
        high: price,
        low: price,
        close: price,
        volume: 0,
      };
    } else {
      state.current.close = price;
      state.current.high = Math.max(state.current.high, price);
      state.current.low = Math.min(state.current.low, price);
      state.current.volume += Math.floor(Math.random() * 50 + 1);
    }
  }
}

export function getCandles(symbol: string, timeframe: Timeframe): Candle[] {
  const state = store[symbol]?.[timeframe];
  if (!state) return [];
  return [...state.history, state.current];
}

export function getCurrentCandle(symbol: string, timeframe: Timeframe): Candle | null {
  return store[symbol]?.[timeframe]?.current ?? null;
}
