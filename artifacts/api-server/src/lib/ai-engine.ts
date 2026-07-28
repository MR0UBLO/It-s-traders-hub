import { getPriceTicks, SYMBOLS, type Symbol } from "./market.js";

export type SignalDirection = "BUY" | "SELL" | "HOLD";
export type RiskLevel = "LOW" | "MEDIUM" | "HIGH";
export type Timeframe = "M1" | "M5" | "M15" | "H1" | "H4" | "D1";

export interface AiSignal {
  symbol: Symbol;
  signal: SignalDirection;
  confidence: number;
  risk: RiskLevel;
  timeframe: Timeframe;
  reason: string;
  entry: number;
  target: number;
  stopLoss: number;
}

// ─── Technical indicators ─────────────────────────────────────────────────────

function sma(prices: number[], period: number): number {
  const slice = prices.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / slice.length;
}

function rsi(prices: number[], period = 14): number {
  if (prices.length < period + 1) return 50;
  const slice = prices.slice(-(period + 1));
  let gains = 0, losses = 0;
  for (let i = 1; i < slice.length; i++) {
    const diff = slice[i] - slice[i - 1];
    if (diff > 0) gains += diff;
    else losses += Math.abs(diff);
  }
  if (losses === 0) return 100;
  const rs = gains / losses;
  return 100 - 100 / (1 + rs);
}

function momentum(prices: number[], period = 10): number {
  if (prices.length < period) return 0;
  const prev = prices[prices.length - period];
  const curr = prices[prices.length - 1];
  return ((curr - prev) / prev) * 100;
}

function stdDev(prices: number[], period = 20): number {
  const slice = prices.slice(-period);
  const mean = slice.reduce((a, b) => a + b, 0) / slice.length;
  const variance = slice.reduce((a, b) => a + (b - mean) ** 2, 0) / slice.length;
  return Math.sqrt(variance);
}

function trendSlope(prices: number[], period = 20): number {
  const slice = prices.slice(-period);
  if (slice.length < 2) return 0;
  const n = slice.length;
  const sumX = (n * (n - 1)) / 2;
  const sumX2 = (n * (n - 1) * (2 * n - 1)) / 6;
  const sumY = slice.reduce((a, b) => a + b, 0);
  const sumXY = slice.reduce((acc, val, i) => acc + i * val, 0);
  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX ** 2);
  return slope / slice[0]; // normalise as fraction of price
}

// ─── Signal generation ────────────────────────────────────────────────────────

const TIMEFRAME_MAP: Timeframe[] = ["M5", "M15", "H1", "H4"];

function pickTimeframe(): Timeframe {
  return TIMEFRAME_MAP[Math.floor(Math.random() * TIMEFRAME_MAP.length)];
}

function computeSignal(symbol: Symbol): AiSignal {
  const ticks = getPriceTicks(symbol);
  const price = ticks[ticks.length - 1] ?? 1;

  const rsiVal = rsi(ticks);
  const mom = momentum(ticks, 10);
  const slope = trendSlope(ticks, 30);
  const vol = stdDev(ticks, 20) / price;
  const sma20 = sma(ticks, 20);
  const sma50 = sma(ticks, Math.min(50, ticks.length));

  // Score: positive = bullish, negative = bearish
  let score = 0;
  score += (rsiVal < 30) ? 2 : (rsiVal > 70) ? -2 : 0;
  score += mom > 0.5 ? 2 : mom < -0.5 ? -2 : mom > 0.1 ? 1 : mom < -0.1 ? -1 : 0;
  score += slope > 0 ? 1.5 : slope < 0 ? -1.5 : 0;
  score += price > sma20 ? 0.5 : -0.5;
  score += sma20 > sma50 ? 1 : -1;

  const direction: SignalDirection = score > 1.5 ? "BUY" : score < -1.5 ? "SELL" : "HOLD";

  // Confidence: 0–100 based on signal strength
  const absScore = Math.abs(score);
  const rawConfidence = Math.min(95, 40 + absScore * 8 + Math.random() * 10);
  const confidence = Math.round(rawConfidence);

  // Risk based on volatility
  const risk: RiskLevel = vol > 0.008 ? "HIGH" : vol > 0.003 ? "MEDIUM" : "LOW";

  // Build reason
  const reasons: string[] = [];
  if (direction === "BUY") {
    if (rsiVal < 35) reasons.push("RSI oversold (" + rsiVal.toFixed(0) + ")");
    if (mom > 0.3) reasons.push("positive momentum (" + mom.toFixed(2) + "%)");
    if (slope > 0) reasons.push("upward trend confirmed");
    if (price > sma20) reasons.push("price above 20-SMA");
    if (sma20 > sma50) reasons.push("golden cross forming");
  } else if (direction === "SELL") {
    if (rsiVal > 65) reasons.push("RSI overbought (" + rsiVal.toFixed(0) + ")");
    if (mom < -0.3) reasons.push("negative momentum (" + mom.toFixed(2) + "%)");
    if (slope < 0) reasons.push("downward trend confirmed");
    if (price < sma20) reasons.push("price below 20-SMA");
  } else {
    reasons.push("conflicting indicators — waiting for confirmation");
  }
  if (reasons.length === 0) reasons.push("multiple signals align with " + direction + " bias");
  const reason = reasons.join(". ").replace(/^./, (c) => c.toUpperCase()) + ".";

  // Entry, target, stop loss
  const spread = price * 0.0002;
  const entry = direction === "BUY" ? price + spread : price - spread;
  const riskFraction = risk === "HIGH" ? 0.02 : risk === "MEDIUM" ? 0.013 : 0.008;
  const rewardFraction = riskFraction * 2.2;
  const target = direction === "BUY" ? price * (1 + rewardFraction) : price * (1 - rewardFraction);
  const stopLoss = direction === "BUY" ? price * (1 - riskFraction) : price * (1 + riskFraction);

  return {
    symbol,
    signal: direction,
    confidence,
    risk,
    timeframe: pickTimeframe(),
    reason: `${reason} Risk: ${risk}. Confidence: ${confidence}%.`,
    entry: +entry.toFixed(4),
    target: +target.toFixed(4),
    stopLoss: +stopLoss.toFixed(4),
  };
}

export function generateAllSignals(): AiSignal[] {
  return SYMBOLS.map((sym) => computeSignal(sym));
}

export function generateSignalForSymbol(symbol: Symbol): AiSignal {
  return computeSignal(symbol);
}
