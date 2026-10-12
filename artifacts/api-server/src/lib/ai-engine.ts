import { getPriceTicks, getSimulationContext, SYMBOLS, type Symbol } from "./market.js";
import { getCandles } from "./candle-engine.js";

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

function average(values: number[]): number {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function sma(prices: number[], period: number): number {
  return average(prices.slice(-period));
}

function rsi(prices: number[], period = 14): number {
  if (prices.length < period + 1) return 50;
  const slice = prices.slice(-(period + 1));
  let gains = 0;
  let losses = 0;
  for (let i = 1; i < slice.length; i++) {
    const diff = slice[i] - slice[i - 1];
    if (diff > 0) gains += diff;
    else losses += Math.abs(diff);
  }
  if (losses === 0) return gains === 0 ? 50 : 100;
  if (gains === 0) return 0;
  const rs = gains / losses;
  return 100 - 100 / (1 + rs);
}

function momentum(prices: number[], period = 10): number {
  if (prices.length < period) return 0;
  const previous = prices[prices.length - period];
  const current = prices[prices.length - 1];
  return previous === 0 ? 0 : ((current - previous) / previous) * 100;
}

function stdDev(prices: number[], period = 20): number {
  const slice = prices.slice(-period);
  const mean = average(slice);
  return Math.sqrt(average(slice.map((value) => (value - mean) ** 2)));
}

function trendSlope(prices: number[], period = 20): number {
  const slice = prices.slice(-period);
  if (slice.length < 2 || slice[0] === 0) return 0;
  const n = slice.length;
  const sumX = (n * (n - 1)) / 2;
  const sumX2 = (n * (n - 1) * (2 * n - 1)) / 6;
  const sumY = slice.reduce((sum, value) => sum + value, 0);
  const sumXY = slice.reduce((sum, value, index) => sum + index * value, 0);
  return ((n * sumXY - sumX * sumY) / (n * sumX2 - sumX ** 2)) / slice[0];
}

function computeSignal(symbol: Symbol): AiSignal {
  const ticks = getPriceTicks(symbol);
  const simulation = getSimulationContext(symbol);
  const price = ticks[ticks.length - 1] ?? 1;
  const candles5s = getCandles(symbol, "S5").slice(-5);
  const candles15s = getCandles(symbol, "S15").slice(-4);
  const candleDirection = (candles: Array<{ open: number; close: number }>) => {
    const recent = candles.slice(-3);
    return recent.reduce((sum, candle) => sum + (candle.close > candle.open ? 1 : candle.close < candle.open ? -1 : 0), 0);
  };

  const rsiVal = rsi(ticks);
  const mom = momentum(ticks, 10);
  const slope = trendSlope(ticks, 30);
  const vol = price > 0 ? stdDev(ticks, 20) / price : 0;
  const sma20 = sma(ticks, 20);
  const sma50 = sma(ticks, Math.min(50, ticks.length));
  const shortCandleBias = candleDirection(candles5s);
  const mediumCandleBias = candleDirection(candles15s);

  let score = 0;
  score += rsiVal < 30 ? 1.5 : rsiVal > 70 ? -1.5 : rsiVal < 45 ? 0.5 : rsiVal > 55 ? -0.5 : 0;
  score += mom > 0.08 ? 1.5 : mom < -0.08 ? -1.5 : 0;
  score += slope > 0 ? 1 : slope < 0 ? -1 : 0;
  score += price > sma20 ? 0.75 : price < sma20 ? -0.75 : 0;
  score += sma20 > sma50 ? 0.75 : sma20 < sma50 ? -0.75 : 0;
  score += shortCandleBias >= 2 ? 1 : shortCandleBias <= -2 ? -1 : 0;
  score += mediumCandleBias >= 2 ? 0.75 : mediumCandleBias <= -2 ? -0.75 : 0;

  // The simulator's own trend state is an additional input. Its influence fades
  // near a trend-cycle boundary, when the simulator may reverse direction.
  const trendIsNearReset = !!simulation && simulation.ticksRemaining <= 5;
  const simulatorTrendWeight = simulation
    ? (trendIsNearReset ? 0.5 : 1.75) * simulation.strength
    : 0;
  const simulatorTrendScore = simulation ? simulation.direction * simulatorTrendWeight : 0;
  score += simulatorTrendScore;

  const candleConfirmedBuy = shortCandleBias > 0 && mediumCandleBias >= 0;
  const candleConfirmedSell = shortCandleBias < 0 && mediumCandleBias <= 0;
  const simulatorConfirmsBuy = !simulation || (simulation.direction === 1 && !trendIsNearReset);
  const simulatorConfirmsSell = !simulation || (simulation.direction === -1 && !trendIsNearReset);
  // During a simulated volatility spike, require a stronger combined score.
  const entryThreshold = simulation?.spikeActive ? 4.25 : 3;
  const direction: SignalDirection =
    score >= entryThreshold && candleConfirmedBuy && simulatorConfirmsBuy ? "BUY" :
    score <= -entryThreshold && candleConfirmedSell && simulatorConfirmsSell ? "SELL" : "HOLD";

  // This is a deterministic signal-strength score, not a measured win probability.
  const simulatorAligned =
    (direction === "BUY" && simulatorConfirmsBuy) ||
    (direction === "SELL" && simulatorConfirmsSell);
  const spikePenalty = simulation?.spikeActive ? 8 : 0;
  const confidence = Math.min(94, Math.max(35, Math.round(
    48 + Math.abs(score) * 6 + (simulatorAligned ? 5 : 0) - spikePenalty
  )));
  const risk: RiskLevel = vol > 0.008 ? "HIGH" : vol > 0.003 ? "MEDIUM" : "LOW";
  const reasons: string[] = [];
  if (simulation) {
    reasons.push(
      `simulator trend ${simulation.direction === 1 ? "up" : "down"} (strength ${simulation.strength.toFixed(2)}, ${simulation.ticksRemaining} ticks remaining)`
    );
    if (simulation.spikeActive) reasons.push("simulated volatility spike active; entry threshold raised");
    if (trendIsNearReset) reasons.push("trend cycle near reset; simulator confirmation reduced");
  }
  if (direction === "BUY") {
    if (mom > 0) reasons.push("positive price momentum");
    if (slope > 0) reasons.push("upward tick trend");
    if (price > sma20) reasons.push("price above short moving average");
    if (shortCandleBias > 0) reasons.push("recent 5-second candles bullish");
    if (mediumCandleBias >= 0) reasons.push("15-second candle bias confirms");
  } else if (direction === "SELL") {
    if (mom < 0) reasons.push("negative price momentum");
    if (slope < 0) reasons.push("downward tick trend");
    if (price < sma20) reasons.push("price below short moving average");
    if (shortCandleBias < 0) reasons.push("recent 5-second candles bearish");
    if (mediumCandleBias <= 0) reasons.push("15-second candle bias confirms");
  } else {
    reasons.push("tick indicators and short-candle confirmation do not agree; waiting");
  }
  const reason = reasons.join("; ") + ".";

  const spread = price * 0.0002;
  const entry = direction === "BUY" ? price + spread : price - spread;
  const riskFraction = risk === "HIGH" ? 0.02 : risk === "MEDIUM" ? 0.013 : 0.008;
  const rewardFraction = riskFraction * 2.2;
  const target = direction === "BUY" ? price * (1 + rewardFraction) : price * (1 - rewardFraction);
  const stopLoss = direction === "BUY" ? price * (1 - riskFraction) : price * (1 + riskFraction);

  return {
    symbol, signal: direction, confidence, risk, timeframe: "M1",
    reason: `${reason} Combined indicator/simulator score: ${confidence}/100; this is not a measured win probability.`,
    entry: +entry.toFixed(6), target: +target.toFixed(6), stopLoss: +stopLoss.toFixed(6),
  };
}

export function generateAllSignals(): AiSignal[] {
  return SYMBOLS.map((symbol) => computeSignal(symbol));
}

export function generateSignalForSymbol(symbol: Symbol): AiSignal {
  return computeSignal(symbol);
}
