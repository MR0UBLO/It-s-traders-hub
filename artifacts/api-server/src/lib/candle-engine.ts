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

export function seedCandles(symbol: string, basePrice: number): void {
  if (store[symbol]) return;
  store[symbol] = {};

  for (const tf of TIMEFRAMES) {
    const tfMs = TIMEFRAME_MS[tf];
    const history: Candle[] = [];
    let price = basePrice;
    const now = Date.now();

    for (let i = MAX_CANDLES - 1; i >= 1; i--) {
      const open = price;
      const changeRatio = (Math.random() * 2 - 1) * 0.008;
      const close = Math.max(open * (1 + changeRatio), basePrice * 0.5);
      const high = Math.max(open, close) * (1 + Math.random() * 0.003);
      const low = Math.min(open, close) * (1 - Math.random() * 0.003);
      history.push({
        time: Math.floor((now - i * tfMs) / tfMs) * tfMs,
        open,
        high,
        low,
        close,
        volume: volumeRand(),
      });
      price = close;
    }

    const currentTime = nowAligned(tfMs);
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
