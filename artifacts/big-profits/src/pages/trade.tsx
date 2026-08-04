import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import {
  useGetMarketPrices,
  useGetOpenTrades,
  useCreateTrade,
  useCloseTrade,
  useGetTrades,
  getGetOpenTradesQueryKey,
  getGetDashboardSummaryQueryKey,
  getGetTradesQueryKey,
  getGetMarketPricesQueryKey,
  useGetWallet,
  getGetWalletQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowUp, ArrowDown, X, History, Layers, TrendingUp, TrendingDown,
  Maximize2, ChevronDown, BarChart3, Trophy, AlertTriangle, Clock,
} from "lucide-react";
import {
  createChart, IChartApi, ISeriesApi, ColorType,
  CandlestickSeries, HistogramSeries, LineSeries, AreaSeries, Time,
} from "lightweight-charts";
import { format } from "date-fns";
import { useAccountStore } from "@/store/account-store";

/* ─── Symbol config ──────────────────────────────────────────────────── */
const SYMBOL_COLORS: Record<string, string> = {
  BTCUSD: "#F97316", XAUUSD: "#F59E0B", EURUSD: "#6366F1",
  GBPUSD: "#10B981", USDJPY: "#3B82F6", ETHUSD: "#8B5CF6",
};

const SYMBOL_GROUPS: Record<string, string[]> = {
  Crypto:      ["BTCUSD", "ETHUSD"],
  Commodities: ["XAUUSD"],
  Forex:       ["EURUSD", "GBPUSD", "USDJPY"],
};

const ALL_SYMBOLS = ["BTCUSD", "XAUUSD", "EURUSD", "GBPUSD", "USDJPY", "ETHUSD"];

const TIMEFRAMES = [
  { label: "5s",  value: "S5"  },
  { label: "15s", value: "S15" },
  { label: "30s", value: "S30" },
  { label: "1m",  value: "M1"  },
  { label: "3m",  value: "M3"  },
  { label: "5m",  value: "M5"  },
  { label: "15m", value: "M15" },
  { label: "30m", value: "M30" },
  { label: "45m", value: "M45" },
  { label: "1H",  value: "H1"  },
  { label: "2H",  value: "H2"  },
  { label: "4H",  value: "H4"  },
  { label: "D",   value: "D1"  },
  { label: "W",   value: "W1"  },
  { label: "M",   value: "MN"  },
];

/* ─── Helpers ────────────────────────────────────────────────────────── */
const dp = (s: string) =>
  ["EURUSD", "GBPUSD", "USDJPY"].includes(s) ? 4 : 2;

const n = (v: unknown): number => { const x = Number(v); return isNaN(x) ? 0 : x; };
const fmt = (v: unknown, d: number) => n(v).toFixed(d);
const fmtKes = (v: unknown) =>
  "$" + n(v).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

/* ─── Indicator calculations ─────────────────────────────────────────── */
function calcEMA(data: number[], period: number): (number | null)[] {
  const k = 2 / (period + 1);
  const out: (number | null)[] = Array(data.length).fill(null);
  let ema: number | null = null;
  for (let i = 0; i < data.length; i++) {
    if (ema === null) {
      if (i >= period - 1) {
        ema = data.slice(0, period).reduce((a, b) => a + b, 0) / period;
        out[i] = ema;
      }
    } else {
      ema = data[i] * k + ema * (1 - k);
      out[i] = ema;
    }
  }
  return out;
}

function calcSMA(data: number[], period: number): (number | null)[] {
  return data.map((_, i) =>
    i >= period - 1
      ? data.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0) / period
      : null,
  );
}

/* ─── Types ──────────────────────────────────────────────────────────── */
interface RawCandle { time: number; open: number; high: number; low: number; close: number; volume: number; }
type IndicatorKey = "ema9" | "ema21" | "sma50" | "sma200" | "volume";

/* ─── Candlestick Chart Component ────────────────────────────────────── */
interface TvChartProps {
  symbol: string;
  timeframe: string;
  indicators: Record<IndicatorKey, boolean>;
}

function TvChart({ symbol, timeframe, indicators }: TvChartProps) {
  const containerRef    = useRef<HTMLDivElement>(null);
  const volContainerRef = useRef<HTMLDivElement>(null);

  const chartRef         = useRef<IChartApi | null>(null);
  const volChartRef      = useRef<IChartApi | null>(null);
  const candleSeriesRef  = useRef<ISeriesApi<"Candlestick", Time> | null>(null);
  const volSeriesRef     = useRef<ISeriesApi<"Histogram",   Time> | null>(null);
  const ema9Ref          = useRef<ISeriesApi<"Line",        Time> | null>(null);
  const ema21Ref         = useRef<ISeriesApi<"Line",        Time> | null>(null);
  const sma50Ref         = useRef<ISeriesApi<"Line",        Time> | null>(null);
  const sma200Ref        = useRef<ISeriesApi<"Line",        Time> | null>(null);

  const lastCandlesRef   = useRef<RawCandle[]>([]);
  const seededRef        = useRef(false);
  const pollingRef       = useRef<ReturnType<typeof setInterval> | null>(null);

  const [ohlc, setOhlc]         = useState<{ o: number; h: number; l: number; c: number } | null>(null);
  const [livePrice, setLivePrice] = useState<{ bid: number; ask: number } | null>(null);
  const decimals = dp(symbol);

  /* Build the main chart once per symbol */
  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#9ca3af", fontSize: 11,
      },
      grid: {
        vertLines: { color: "rgba(255,255,255,0.04)" },
        horzLines: { color: "rgba(255,255,255,0.04)" },
      },
      rightPriceScale: {
        borderColor: "rgba(255,255,255,0.08)",
        scaleMargins: { top: 0.08, bottom: 0.08 },
      },
      timeScale: {
        borderColor: "rgba(255,255,255,0.08)",
        timeVisible: true, secondsVisible: true,
      },
      crosshair: { mode: 1 },
      handleScroll: true, handleScale: true,
    });

    const cs = chart.addSeries(CandlestickSeries, {
      upColor:        "#22c55e", downColor:        "#ef4444",
      borderUpColor:  "#22c55e", borderDownColor:  "#ef4444",
      wickUpColor:    "#22c55e", wickDownColor:    "#ef4444",
    });
    const e9  = chart.addSeries(LineSeries, { color: "#f59e0b", lineWidth: 1, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });
    const e21 = chart.addSeries(LineSeries, { color: "#60a5fa", lineWidth: 1, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });
    const s50 = chart.addSeries(LineSeries, { color: "#a78bfa", lineWidth: 1, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });
    const s200= chart.addSeries(LineSeries, { color: "#f87171", lineWidth: 1, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });

    chartRef.current        = chart;
    candleSeriesRef.current = cs;
    ema9Ref.current         = e9;
    ema21Ref.current        = e21;
    sma50Ref.current        = s50;
    sma200Ref.current       = s200;
    seededRef.current       = false;
    lastCandlesRef.current  = [];

    chart.subscribeCrosshairMove((param) => {
      if (candleSeriesRef.current && param.seriesData) {
        const bar = param.seriesData.get(candleSeriesRef.current) as any;
        if (bar) setOhlc({ o: bar.open, h: bar.high, l: bar.low, c: bar.close });
      }
    });

    const ro = new ResizeObserver(() => {
      if (containerRef.current)
        chart.applyOptions({ width: containerRef.current.clientWidth, height: containerRef.current.clientHeight });
    });
    ro.observe(containerRef.current);
    return () => { ro.disconnect(); chart.remove(); seededRef.current = false; };
  }, [symbol]);

  /* Volume sub-chart */
  useEffect(() => {
    if (!volContainerRef.current) return;
    if (!indicators.volume) {
      if (volChartRef.current) { volChartRef.current.remove(); volChartRef.current = null; volSeriesRef.current = null; }
      return;
    }
    const vc = createChart(volContainerRef.current, {
      layout: { background: { type: ColorType.Solid, color: "transparent" }, textColor: "#9ca3af", fontSize: 10 },
      grid: { vertLines: { color: "rgba(255,255,255,0.03)" }, horzLines: { color: "rgba(255,255,255,0.03)" } },
      rightPriceScale: { borderColor: "rgba(255,255,255,0.06)", scaleMargins: { top: 0.1, bottom: 0 } },
      timeScale: { borderColor: "rgba(255,255,255,0.06)", timeVisible: true, secondsVisible: true },
      crosshair: { mode: 1 }, handleScroll: true, handleScale: false,
    });
    const vs = vc.addSeries(HistogramSeries, { color: "#3b82f680", priceFormat: { type: "volume" } });
    volChartRef.current = vc; volSeriesRef.current = vs;
    const ro = new ResizeObserver(() => {
      if (volContainerRef.current) vc.applyOptions({ width: volContainerRef.current.clientWidth, height: volContainerRef.current.clientHeight });
    });
    ro.observe(volContainerRef.current);
    return () => { ro.disconnect(); vc.remove(); volChartRef.current = null; volSeriesRef.current = null; };
  }, [indicators.volume]);

  /* Apply indicator overlays */
  const applyIndicators = useCallback((candles: RawCandle[]) => {
    if (!candles.length) return;
    const closes = candles.map((c) => c.close);

    const applyLine = (ref: React.MutableRefObject<ISeriesApi<"Line", Time> | null>, vals: (number | null)[], visible: boolean) => {
      if (!ref.current) return;
      const data = candles
        .map((c, i) => ({ time: Math.floor(c.time / 1000) as Time, value: vals[i] }))
        .filter((d) => d.value !== null) as { time: Time; value: number }[];
      ref.current.setData(data);
      ref.current.applyOptions({ visible });
    };
    applyLine(ema9Ref,  calcEMA(closes, 9),   indicators.ema9);
    applyLine(ema21Ref, calcEMA(closes, 21),  indicators.ema21);
    applyLine(sma50Ref, calcSMA(closes, 50),  indicators.sma50);
    applyLine(sma200Ref,calcSMA(closes, 200), indicators.sma200);
  }, [indicators]);

  /* Fetch candles and live price, update chart incrementally */
  const fetchAndUpdate = useCallback(async () => {
  console.log("fetchAndUpdate running", symbol, timeframe);

  try {
      const [candleRes, priceRes] = await Promise.all([
  fetch(
    `${import.meta.env.VITE_API_URL}/market/candles/${symbol}/${timeframe}?limit=200`
  ),
  fetch(
    `${import.meta.env.VITE_API_URL}/market/prices`
  ),
]);
      if (!candleRes.ok || !priceRes.ok) return;

      const candles: RawCandle[] = await candleRes.json();
      console.log("CANDLE DATA:", candles);
      const prices: { symbol: string; bid: number; ask: number }[] = await priceRes.json();
console.log("PRICE DATA:", prices);

      const p = prices.find((d) => d.symbol === symbol);
      if (p) setLivePrice({ bid: p.bid, ask: p.ask });

      if (!candles.length || !candleSeriesRef.current) return;

      // Deduplicate + sort by time
      const seen = new Set<number>();
      const deduped = candles
        .sort((a, b) => a.time - b.time)
        .filter((c) => { if (seen.has(c.time)) return false; seen.add(c.time); return true; });

      const last = deduped[deduped.length - 1];
      setOhlc({ o: last.open, h: last.high, l: last.low, c: last.close });

      if (!seededRef.current) {
        // First load — setData for everything
        const lwData = deduped.map((c) => ({
          time:  Math.floor(c.time / 1000) as Time,
          open:  c.open, high: c.high, low: c.low, close: c.close,
        }));
        console.log("Setting chart data", lwData.length, lwData);
        candleSeriesRef.current.setData(lwData);
        chartRef.current?.timeScale().fitContent();

        if (volSeriesRef.current) {
          volSeriesRef.current.setData(
            deduped.map((c) => ({
              time:  Math.floor(c.time / 1000) as Time,
              value: c.volume,
              color: c.close >= c.open ? "#22c55e40" : "#ef444440",
            })),
          );
        }

        applyIndicators(deduped);
        seededRef.current = true;
        lastCandlesRef.current = deduped;
        return;
      }

      const prev = lastCandlesRef.current;

      // Update only the last bar (or add a new one) — smooth live movement
      const prevLast = prev[prev.length - 1];
      if (prevLast) {
        const lwBar = {
          time:  Math.floor(last.time  / 1000) as Time,
          open:  last.open, high: last.high, low: last.low, close: last.close,
        };
        candleSeriesRef.current.update(lwBar);

        if (volSeriesRef.current) {
          volSeriesRef.current.update({
            time:  Math.floor(last.time / 1000) as Time,
            value: last.volume,
            color: last.close >= last.open ? "#22c55e40" : "#ef444440",
          });
        }
      }

      // Re-seed indicators every 30 updates for accuracy but don't block the live update
      const prevLen = prev.length;
      if (Math.abs(deduped.length - prevLen) >= 1 || (deduped.length > 0 && deduped.length % 30 === 0)) {
        applyIndicators(deduped);
      }

      lastCandlesRef.current = deduped;
    } catch { /* silently ignore network errors */ }
  }, [symbol, timeframe, applyIndicators]);

  /* Reset chart when symbol or timeframe changes */
  useEffect(() => {
    seededRef.current      = false;
    lastCandlesRef.current = [];
    setOhlc(null);
    setLivePrice(null);
  }, [symbol, timeframe]);

  /* Polling loop */
  useEffect(() => {
    fetchAndUpdate();
    if (pollingRef.current) clearInterval(pollingRef.current);
    pollingRef.current = setInterval(fetchAndUpdate, 2000);
    return () => { if (pollingRef.current) clearInterval(pollingRef.current); };
  }, [fetchAndUpdate]);

  /* Indicator visibility toggle (no full re-seed needed) */
  useEffect(() => {
    if (ema9Ref.current)  ema9Ref.current.applyOptions({ visible: indicators.ema9 });
    if (ema21Ref.current) ema21Ref.current.applyOptions({ visible: indicators.ema21 });
    if (sma50Ref.current) sma50Ref.current.applyOptions({ visible: indicators.sma50 });
    if (sma200Ref.current) sma200Ref.current.applyOptions({ visible: indicators.sma200 });
  }, [indicators.ema9, indicators.ema21, indicators.sma50, indicators.sma200]);

  return (
    <div className="flex flex-col h-full">
      {/* OHLC bar */}
      <div className="flex items-center gap-3 px-3 pt-2 pb-1 text-[11px] font-mono flex-wrap gap-y-1 border-b border-border/30">
        {ohlc ? (
          <>
            <span className="text-muted-foreground">O <span className="text-foreground">{fmt(ohlc.o, decimals)}</span></span>
            <span className="text-muted-foreground">H <span className="text-green-400">{fmt(ohlc.h, decimals)}</span></span>
            <span className="text-muted-foreground">L <span className="text-red-400">{fmt(ohlc.l, decimals)}</span></span>
            <span className="text-muted-foreground">C <span className={ohlc.c >= ohlc.o ? "text-green-400" : "text-red-400"}>{fmt(ohlc.c, decimals)}</span></span>
            {livePrice && (
              <>
                <span className="ml-2 text-muted-foreground">Bid <span className="text-red-400">{fmt(livePrice.bid, decimals)}</span></span>
                <span className="text-muted-foreground">Ask <span className="text-green-400">{fmt(livePrice.ask, decimals)}</span></span>
              </>
            )}
          </>
        ) : (
          <span className="text-muted-foreground animate-pulse">Loading chart…</span>
        )}
        <div className="ml-auto flex items-center gap-2 text-[10px]">
          {indicators.ema9  && <span className="text-amber-400">EMA9</span>}
          {indicators.ema21 && <span className="text-blue-400">EMA21</span>}
          {indicators.sma50 && <span className="text-violet-400">SMA50</span>}
          {indicators.sma200 && <span className="text-red-400">SMA200</span>}
        </div>
      </div>

      <div
        ref={containerRef}
        className="w-full"
        style={{ flex: indicators.volume ? "3 1 0" : "1 1 0", minHeight: 0 }}
      />
      {indicators.volume && (
        <div
          ref={volContainerRef}
          className="w-full border-t border-border/20"
          style={{ flex: "1 1 0", minHeight: 60, maxHeight: 100 }}
        />
      )}
    </div>
  );
}

/* ─── P&L Analytics Component ────────────────────────────────────────── */
interface PnlStats {
  totalTrades: number;
  winRate: number;
  totalPL: number;
  avgDuration: string;
  bestTrade: number;
  worstTrade: number;
  cumulative: { time: number; value: number }[];
}

function PnlAnalytics({ trades }: { trades: any[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef     = useRef<IChartApi | null>(null);
  const seriesRef    = useRef<ISeriesApi<"Area", Time> | null>(null);

  const stats: PnlStats = useMemo(() => {
    if (!trades.length) return { totalTrades: 0, winRate: 0, totalPL: 0, avgDuration: "—", bestTrade: 0, worstTrade: 0, cumulative: [] };

    let wins = 0, totalPL = 0, totalMs = 0, validDur = 0;
    let best = -Infinity, worst = Infinity;
    let runningPL = 0;
    const cumulative: { time: number; value: number }[] = [];

    [...trades]
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
      .forEach((t) => {
        const pl = n(t.profitLoss);
        totalPL += pl;
        runningPL += pl;
        if (pl > 0) wins++;
        if (pl > best) best = pl;
        if (pl < worst) worst = pl;
        if (t.closedAt && t.createdAt) {
          totalMs += new Date(t.closedAt).getTime() - new Date(t.createdAt).getTime();
          validDur++;
        }
        cumulative.push({ time: Math.floor(new Date(t.closedAt ?? t.createdAt).getTime() / 1000), value: parseFloat(runningPL.toFixed(2)) });
      });

    const avgMs   = validDur > 0 ? totalMs / validDur : 0;
    const avgDuration = avgMs < 60_000
      ? `${Math.round(avgMs / 1000)}s`
      : avgMs < 3_600_000
        ? `${Math.round(avgMs / 60_000)}m`
        : `${(avgMs / 3_600_000).toFixed(1)}h`;

    return {
      totalTrades: trades.length,
      winRate:     trades.length > 0 ? (wins / trades.length) * 100 : 0,
      totalPL,
      avgDuration,
      bestTrade:  best === -Infinity ? 0 : best,
      worstTrade: worst === Infinity ? 0 : worst,
      cumulative,
    };
  }, [trades]);

  useEffect(() => {
    if (!containerRef.current) return;
    const chart = createChart(containerRef.current, {
      layout: { background: { type: ColorType.Solid, color: "transparent" }, textColor: "#9ca3af", fontSize: 10 },
      grid: { vertLines: { color: "rgba(255,255,255,0.03)" }, horzLines: { color: "rgba(255,255,255,0.03)" } },
      rightPriceScale: { borderColor: "rgba(255,255,255,0.06)" },
      timeScale: { borderColor: "rgba(255,255,255,0.06)", timeVisible: true },
      crosshair: { mode: 1 }, handleScroll: true, handleScale: true,
    });
    console.log(
  "Chart size:",
  containerRef.current?.clientWidth,
  containerRef.current?.clientHeight
);
    console.log("Chart created");
    const series = chart.addSeries(AreaSeries, {
      lineColor: "#6366f1", topColor: "#6366f120", bottomColor: "#6366f105",
      lineWidth: 2, priceLineVisible: false, lastValueVisible: true,
    });
    chartRef.current = chart; seriesRef.current = series;
    const ro = new ResizeObserver(() => {
      if (containerRef.current) chart.applyOptions({ width: containerRef.current.clientWidth, height: containerRef.current.clientHeight });
    });
    ro.observe(containerRef.current);
    return () => { ro.disconnect(); chart.remove(); };
  }, []);

  useEffect(() => {
    if (!seriesRef.current || !stats.cumulative.length) return;
    // dedupe by time
    const seen = new Set<number>();
    const data = stats.cumulative
      .sort((a, b) => a.time - b.time)
      .filter((d) => { if (seen.has(d.time)) return false; seen.add(d.time); return true; });
    seriesRef.current.setData(data as any);
    chartRef.current?.timeScale().fitContent();
  }, [stats.cumulative]);

  if (!trades.length) return (
    <div className="text-center py-8 text-muted-foreground text-sm">
      <BarChart3 className="w-8 h-8 mx-auto mb-2 opacity-30" />
      Close some trades to see your analytics.
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: "Total Trades",   value: stats.totalTrades,                         icon: BarChart3,       color: "text-foreground"  },
          { label: "Win Rate",       value: `${stats.winRate.toFixed(1)}%`,             icon: Trophy,          color: stats.winRate >= 50 ? "text-green-400" : "text-red-400" },
          { label: "Total P/L",      value: `${stats.totalPL >= 0 ? "+" : ""}${fmtKes(stats.totalPL)} USD`, icon: TrendingUp, color: stats.totalPL >= 0 ? "text-green-400" : "text-red-400" },
          { label: "Avg Duration",   value: stats.avgDuration,                          icon: Clock,           color: "text-foreground"  },
          { label: "Best Trade",     value: `+${fmtKes(stats.bestTrade)} USD`,          icon: ArrowUp,         color: "text-green-400"   },
          { label: "Worst Trade",    value: `${fmtKes(stats.worstTrade)} USD`,          icon: AlertTriangle,   color: "text-red-400"     },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-background/40 rounded-xl p-3 space-y-1.5">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Icon className="w-3.5 h-3.5" />
              <span className="text-[10px] uppercase tracking-wide font-semibold">{label}</span>
            </div>
            <p className={`font-mono font-bold text-sm ${color}`}>{String(value)}</p>
          </div>
        ))}
      </div>

      {/* Cumulative P/L chart */}
      <div className="bg-background/40 rounded-xl overflow-hidden">
        <p className="text-xs font-semibold text-muted-foreground px-3 pt-3 pb-1">Cumulative P/L</p>
        <div ref={containerRef} className="w-full" style={{ height: 160 }} />
      </div>
    </div>
  );
}

/* ─── Main Trade Page ────────────────────────────────────────────────── */
export default function Trade() {
  const { mode } = useAccountStore();
  const isDemo = mode === "demo";

  const [symbol,    setSymbol]    = useState("BTCUSD");
  const [timeframe, setTimeframe] = useState("M5");
  const [direction, setDirection] = useState<"buy" | "sell">("buy");
  const [lotSize,   setLotSize]   = useState("0.01");
  const [tradeDuration, setTradeDuration] = useState("5");
  const [stopLoss,  setStopLoss]  = useState("");
  const [takeProfit,setTakeProfit]= useState("");
  const [activeTab, setActiveTab] = useState<"positions" | "history" | "analytics">("positions");
  const [symbolMenuOpen,    setSymbolMenuOpen]    = useState(false);
  const [indicatorMenuOpen, setIndicatorMenuOpen] = useState(false);
  const [isFullscreen,      setIsFullscreen]      = useState(false);
  const [indicators, setIndicators] = useState<Record<IndicatorKey, boolean>>({
    ema9: false, ema21: false, sma50: false, sma200: false, volume: true,
  });
  const chartWrapRef = useRef<HTMLDivElement>(null);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: prices } = useGetMarketPrices({ query: { queryKey: getGetMarketPricesQueryKey(), refetchInterval: 2000 } });
  const { data: openTrades }      = useGetOpenTrades({ account: mode }, { query: { queryKey: getGetOpenTradesQueryKey({ account: mode }), refetchInterval: 3000 } });
  const { data: allTrades }       = useGetTrades({ account: mode }, { query: { queryKey: getGetTradesQueryKey({ account: mode }), refetchInterval: 5000 } });
  const { data: wallet }          = useGetWallet({ account: mode }, { query: { queryKey: getGetWalletQueryKey({ account: mode }), refetchInterval: 5000 } });
  const createTrade = useCreateTrade();
  const closeTrade  = useCloseTrade();

  const currentPrice = prices?.find((p: any) => p.symbol === symbol);
  const decimals     = dp(symbol);
  const spread       = currentPrice ? n(currentPrice.ask) - n(currentPrice.bid) : 0;
  const commission   = n(amount) * 0.0001;
  const swap         = n(amount) * 0.00002;
  const margin       = n(amount) * 0.01;

  const closedTrades = useMemo(() => (allTrades ?? []).filter((t: any) => t.status === "closed"), [allTrades]);
  const totalFloatPL = useMemo(() => (openTrades ?? []).reduce((sum: number, t: any) => sum + n(t.profitLoss), 0), [openTrades]);
  const balance = n(wallet?.balance);

  /* Auto-fill SL/TP */
  useEffect(() => {
    if (!currentPrice) return;
    const price = direction === "buy" ? n(currentPrice.ask) : n(currentPrice.bid);
    const slOff = price * 0.005;
    const tpOff = price * 0.01;
    setStopLoss((direction === "buy" ? price - slOff : price + slOff).toFixed(decimals));
    setTakeProfit((direction === "buy" ? price + tpOff : price - tpOff).toFixed(decimals));
  }, [direction, symbol]);

  /* Open trade */
  const handleOpen = () => {
    const numAmt = Number(amount);
    if (isNaN(numAmt) || numAmt < 1) { toast({ title: "Minimum $1 USD", variant: "destructive" }); return; }
    const numLot = Number(lotSize);
    if (isNaN(numLot) || numLot <= 0)  { toast({ title: "Invalid lot size", variant: "destructive" }); return; }
    if (!currentPrice)                  { toast({ title: "Price unavailable", variant: "destructive" }); return; }

    const slNum = stopLoss   ? Number(stopLoss)   : null;
    const tpNum = takeProfit ? Number(takeProfit) : null;
    const entryPrice = direction === "buy" ? n(currentPrice.ask) : n(currentPrice.bid);

    const payload: any = { symbol, direction, amount: numAmt, lotSize: numLot, accountType: mode };
    if (slNum != null) payload.stopLoss = slNum;
    if (tpNum != null) payload.takeProfit = tpNum;

    createTrade.mutate({ data: payload }, {
      onSuccess: () => {
        toast({ title: "✓ Trade opened", description: `${direction.toUpperCase()} ${symbol} — $${numAmt.toLocaleString()} USD` });
        queryClient.invalidateQueries({ queryKey: getGetOpenTradesQueryKey({ account: mode }) });
        queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey({ account: mode }) });
        queryClient.invalidateQueries({ queryKey: getGetTradesQueryKey({ account: mode }) });
        queryClient.invalidateQueries({ queryKey: getGetWalletQueryKey({ account: mode }) });
        setActiveTab("positions");
      },
      onError: (err: any) => {
        toast({ title: "Trade Failed", description: err?.data?.error || err?.message || "Trade failed", variant: "destructive" });
      },
    });
  };

  /* Close trade */
  
/* Close trade */
const handleClose = (id: number) => {
  closeTrade.mutate(
    { id },
    {
      onSuccess: (data: any) => {
        const pl = data?.profitLoss;

        toast({
          title: "✓ Trade closed",
          description:
            pl != null
              ? `P/L: ${n(pl) >= 0 ? "+" : ""}$${Math.abs(n(pl)).toFixed(2)} USD`
              : "Position closed",
        });

        queryClient.invalidateQueries({
          queryKey: getGetOpenTradesQueryKey({ account: mode }),
        });
        queryClient.invalidateQueries({
          queryKey: getGetDashboardSummaryQueryKey({ account: mode }),
        });
        queryClient.invalidateQueries({
          queryKey: getGetTradesQueryKey({ account: mode }),
        });
        queryClient.invalidateQueries({
          queryKey: getGetWalletQueryKey({ account: mode }),
        });
      },
      onError: (err: any) => {
        toast({
          title: "Close Failed",
          description:
            err?.data?.error || err?.message || "Close failed",
          variant: "destructive",
        });
      },
    }
  );
};
  const handleCloseAll = () => (openTrades ?? []).forEach((t: any) => handleClose(t.id));

  /* Fullscreen */
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) { chartWrapRef.current?.requestFullscreen().catch(() => {}); setIsFullscreen(true); }
    else                             { document.exitFullscreen().catch(() => {}); }
  };
  useEffect(() => {
    const fn = () => { if (!document.fullscreenElement) setIsFullscreen(false); };
    document.addEventListener("fullscreenchange", fn);
    return () => document.removeEventListener("fullscreenchange", fn);
  }, []);

  const indicatorList: { key: IndicatorKey; label: string; color: string }[] = [
    { key: "ema9",   label: "EMA 9",   color: "text-amber-400"  },
    { key: "ema21",  label: "EMA 21",  color: "text-blue-400"   },
    { key: "sma50",  label: "SMA 50",  color: "text-violet-400" },
    { key: "sma200", label: "SMA 200", color: "text-red-400"    },
    { key: "volume", label: "Volume",  color: "text-sky-400"    },
  ];

  return (
    <div className="flex flex-col h-full overflow-auto bg-background">
      <div className="p-3 space-y-3 max-w-[1800px] mx-auto w-full">

        {/* ── Top row: chart + order panel ── */}
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_300px] gap-3">

          {/* Chart panel */}
          <motion.div
            ref={chartWrapRef}
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            className="glass-card rounded-2xl overflow-visible flex flex-col"
            style={{ minHeight: 520 }}
          >
            {/* Chart toolbar */}
            <div className="flex items-center gap-2 px-3 py-2 border-b border-border flex-wrap gap-y-2 shrink-0">

              {/* Symbol picker */}
              <div className="relative">
                <button
                  onClick={() => setSymbolMenuOpen(!symbolMenuOpen)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-background/60 border border-border text-sm font-bold hover:bg-accent transition-colors"
                  style={{ color: SYMBOL_COLORS[symbol] || "#fff" }}
                >
                  {symbol} <ChevronDown className="w-3.5 h-3.5 opacity-60" />
                </button>
                <AnimatePresence>
                  {symbolMenuOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -4, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -4, scale: 0.97 }}
                      className="absolute top-full left-0 mt-1 z-50 glass-card rounded-xl p-2 shadow-xl min-w-[160px]"
                    >
                      {Object.entries(SYMBOL_GROUPS).map(([group, syms]) => (
                        <div key={group} className="mb-2 last:mb-0">
                          <p className="text-[10px] text-muted-foreground uppercase tracking-widest px-2 mb-1">{group}</p>
                          {syms.filter((s) => ALL_SYMBOLS.includes(s)).map((s) => (
                            <button key={s} onClick={() => { setSymbol(s); setSymbolMenuOpen(false); }}
                              className={`w-full text-left px-2 py-1.5 rounded-lg text-sm font-semibold transition-colors hover:bg-accent ${symbol === s ? "bg-primary/10" : ""}`}
                              style={{ color: SYMBOL_COLORS[s] || "inherit" }}
                            >{s}</button>
                          ))}
                        </div>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Current price */}
              {currentPrice && (
                <div className="flex items-center gap-2">
                  <span className="text-xl font-bold font-mono" style={{ color: SYMBOL_COLORS[symbol] }}>
                    {n(currentPrice.bid).toLocaleString("en", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}
                  </span>
                  <span className={`flex items-center gap-0.5 text-xs font-semibold px-1.5 py-0.5 rounded-md ${n(currentPrice.changePercent24h) >= 0 ? "bg-green-500/10 text-green-500" : "bg-red-500/10 text-red-500"}`}>
                    {n(currentPrice.changePercent24h) >= 0 ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
                    {Math.abs(n(currentPrice.changePercent24h)).toFixed(2)}%
                  </span>
                </div>
              )}

              <div className="flex-1" />

              {/* Timeframe buttons */}
              <div className="flex items-center gap-0.5 flex-wrap">
                {TIMEFRAMES.map((tf) => (
                  <button key={tf.value} onClick={() => setTimeframe(tf.value)}
                    className={`px-2 py-1 rounded-md text-xs font-semibold transition-colors ${timeframe === tf.value ? "bg-primary/15 text-primary border border-primary/30" : "text-muted-foreground hover:text-foreground hover:bg-accent"}`}
                  >{tf.label}</button>
                ))}
              </div>

              {/* Indicators dropdown */}
              <div className="relative">
                <button onClick={() => setIndicatorMenuOpen(!indicatorMenuOpen)}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg border border-border text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                >
                  Indicators <ChevronDown className="w-3 h-3" />
                </button>
                <AnimatePresence>
                  {indicatorMenuOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -4, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -4, scale: 0.97 }}
                      className="absolute top-full left-0 mt-1 z-50 glass-card rounded-xl p-2 shadow-xl min-w-[160px]"
                    >
                      {indicatorList.map(({ key, label, color }) => (
                        <button key={key} onClick={() => setIndicators((p) => ({ ...p, [key]: !p[key] }))}
                          className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors hover:bg-accent ${indicators[key] ? "bg-primary/5" : ""}`}
                        >
                          <span className={`w-2 h-2 rounded-full ${indicators[key] ? "bg-current" : "border border-current opacity-40"} ${color}`} />
                          <span className={indicators[key] ? color : "text-muted-foreground"}>{label}</span>
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Fullscreen */}
              <button onClick={toggleFullscreen}
                className="w-7 h-7 flex items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* The chart */}
            <div className="flex-1" style={{ minHeight: 0 }}>
              <TvChart symbol={symbol} timeframe={timeframe} indicators={indicators} />
            </div>
          </motion.div>

          {/* ── Order panel ── */}
          <motion.div
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}
            className="glass-card rounded-2xl p-4 flex flex-col gap-3"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-sm">Order Entry</h3>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${isDemo ? "bg-amber-500/15 text-amber-400 border-amber-500/20" : "bg-emerald-500/15 text-emerald-400 border-emerald-500/20"}`}>
                {isDemo ? "DEMO" : "REAL"}
              </span>
            </div>

            {/* Buy / Sell */}
            <div className="grid grid-cols-2 gap-1.5 bg-background/50 rounded-xl p-1">
              <button onClick={() => setDirection("buy")}
                className={`flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-sm font-bold transition-all ${direction === "buy" ? "bg-green-500 text-white shadow-lg shadow-green-500/20" : "text-muted-foreground hover:text-foreground"}`}
              ><TrendingUp className="w-4 h-4" /> BUY</button>
              <button onClick={() => setDirection("sell")}
                className={`flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-sm font-bold transition-all ${direction === "sell" ? "bg-red-500 text-white shadow-lg shadow-red-500/20" : "text-muted-foreground hover:text-foreground"}`}
              ><TrendingDown className="w-4 h-4" /> SELL</button>
            </div>

            {/* Bid / Ask live */}
            {currentPrice && (
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-red-500/5 border border-red-500/15 rounded-xl p-2.5 text-center">
                  <p className="text-[10px] text-muted-foreground mb-0.5 uppercase tracking-wide">Bid</p>
                  <p className="font-mono font-bold text-red-400 text-sm">{fmt(currentPrice.bid, decimals)}</p>
                </div>
                <div className="bg-green-500/5 border border-green-500/15 rounded-xl p-2.5 text-center">
                  <p className="text-[10px] text-muted-foreground mb-0.5 uppercase tracking-wide">Ask</p>
                  <p className="font-mono font-bold text-green-400 text-sm">{fmt(currentPrice.ask, decimals)}</p>
                </div>
              </div>
            )}

            {/* Lot size */}
           {/* Stake Amount */}
<div className="space-y-1">
  <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
    Stake Amount (USD)
  </label>

  <Input
    type="number"
    value={amount}
    onChange={(e) => setAmount(e.target.value)}
    className="font-mono text-base h-10 bg-background/60"
    min="1"
  />

  <div className="grid grid-cols-4 gap-1">
    {[10, 20, 50, 100].map((a) => (
      <button
        key={a}
        onClick={() => setAmount(String(a))}
        className={`py-1 text-xs rounded-lg border transition-colors ${
          amount === String(a)
            ? "border-primary/60 text-primary bg-primary/10"
            : "border-border hover:border-primary/40"
        }`}
      >
        ${a}
      </button>
    ))}
  </div>
</div>

            {/* Amount */}
            {/* Trade Duration */}
<div className="space-y-1">
  <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
    Trade Duration
  </label>

  <select
    value={tradeDuration}
    onChange={(e) => setTradeDuration(e.target.value)}
    className="w-full h-10 rounded-lg border border-border bg-background/60 px-3 text-sm"
  >
    <option value="5">5 Seconds</option>
    <option value="10">10 Seconds</option>
    <option value="15">15 Seconds</option>
    <option value="30">30 Seconds</option>
    <option value="60">1 Minute</option>
    <option value="180">3 Minutes</option>
    <option value="300">5 Minutes</option>
    <option value="900">15 Minutes</option>
    <option value="1800">30 Minutes</option>
    <option value="3600">1 Hour</option>
  </select>
</div>

            {/* SL / TP */}
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-red-400/80 uppercase tracking-wider">Stop Loss</label>
                <Input type="number" value={stopLoss} onChange={(e) => setStopLoss(e.target.value)} placeholder="Optional" className="font-mono text-xs h-8 bg-background/60 border-red-500/20" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-green-400/80 uppercase tracking-wider">Take Profit</label>
                <Input type="number" value={takeProfit} onChange={(e) => setTakeProfit(e.target.value)} placeholder="Optional" className="font-mono text-xs h-8 bg-background/60 border-green-500/20" />
              </div>
            </div>

            {/* Market info */}
            <div className="bg-background/40 rounded-xl px-3 py-2 space-y-1.5 text-xs">
              {[
                ["Spread",       `${spread.toFixed(decimals + 1)}`],
                ["Commission",   `$${(commission/130).toFixed(2)} USD`],
                ["Swap",         `$${(swap/130).toFixed(4)} USD`],
                ["Margin req.",  `$${(margin/130).toFixed(2)} USD`],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between">
                  <span className="text-muted-foreground">{k}</span>
                  <span className="font-mono">{v}</span>
                </div>
              ))}
              <div className="flex justify-between border-t border-border/40 pt-1.5">
                <span className="text-muted-foreground">Balance</span>
                <span className="font-mono font-semibold">{fmtKes(balance)} USD</span>
              </div>
              {(openTrades ?? []).length > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Float P/L</span>
                  <motion.span
                    key={Math.round(totalFloatPL)}
                    initial={{ opacity: 0.6 }} animate={{ opacity: 1 }}
                    className={`font-mono font-semibold ${totalFloatPL >= 0 ? "text-green-400" : "text-red-400"}`}
                  >
                    {totalFloatPL >= 0 ? "+" : ""}{fmtKes(totalFloatPL)} USD
                  </motion.span>
                </div>
              )}
            </div>

            {/* Execute button */}
            <Button
              onClick={handleOpen}
              disabled={createTrade.isPending}
              className={`w-full h-11 font-bold text-sm ${direction === "buy" ? "bg-green-500 hover:bg-green-600" : "bg-red-500 hover:bg-red-600"} text-white shadow-lg`}
            >
              {createTrade.isPending ? "Processing…" : `${direction === "buy" ? "Buy" : "Sell"} ${symbol}`}
            </Button>
          </motion.div>
        </div>

        {/* ── Bottom panel: positions / history / analytics ── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
          className="glass-card rounded-2xl p-4"
        >
          {/* Tab bar */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-1">
              {([
                { key: "positions" as const,  label: "Open Positions", icon: Layers,   badge: (openTrades ?? []).length  },
                { key: "history"   as const,  label: "History",        icon: History,  badge: closedTrades.length },
                { key: "analytics" as const,  label: "Analytics",      icon: BarChart3, badge: 0 },
              ] as const).map(({ key, label, icon: Icon, badge }) => (
                <button key={key} onClick={() => setActiveTab(key)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors ${activeTab === key ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-accent"}`}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                  {badge > 0 && (
                    <span className={`ml-0.5 px-1.5 py-0.5 rounded-full text-xs font-bold ${activeTab === key ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"}`}>{badge}</span>
                  )}
                </button>
              ))}
            </div>
            {activeTab === "positions" && (openTrades ?? []).length > 1 && (
              <Button size="sm" variant="outline" onClick={handleCloseAll} className="h-7 text-xs border-destructive/30 text-destructive hover:bg-destructive/10">
                Close All
              </Button>
            )}
          </div>

          {/* Open Positions */}
          {activeTab === "positions" && (
            (openTrades ?? []).length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border/30">
                      {["Symbol","Dir","Lots","Amount","Entry","Current","SL","TP","Float P/L",""].map((h, i) => (
                        <TableHead key={i} className={`text-xs ${i >= 8 ? "text-right" : ""} ${h === "SL" ? "text-red-400" : h === "TP" ? "text-green-400" : ""}`}>{h}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(openTrades as any[]).map((trade) => {
                      const cp    = prices?.find((p: any) => p.symbol === trade.symbol);
                      const entry = n(trade.entryPrice);
                      const amt   = n(trade.amount);
                      const cur   = cp ? (trade.direction === "buy" ? n(cp.bid) : n(cp.ask)) : null;
                      const floatPL = n(trade.profitLoss ?? 0);

                      return (
                        <TableRow key={trade.id} className="border-border/20 hover:bg-accent/20 transition-colors">
                          <TableCell className="font-bold text-sm" style={{ color: SYMBOL_COLORS[trade.symbol] }}>{trade.symbol}</TableCell>
                          <TableCell>
                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${trade.direction === "buy" ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"}`}>
                              {(trade.direction ?? "buy").toUpperCase()}
                            </span>
                          </TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground">{n(trade.lotSize).toFixed(2)}</TableCell>
                          <TableCell className="font-mono text-xs">
  {`$${n(amt).toFixed(2)} USD`}
</TableCell>
                          <TableCell className="font-mono text-xs">{fmt(trade.entryPrice, dp(trade.symbol))}</TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground">{cur != null ? fmt(cur, dp(trade.symbol)) : "—"}</TableCell>
                          <TableCell className="font-mono text-xs text-red-400">{trade.stopLoss   != null ? fmt(trade.stopLoss,   dp(trade.symbol)) : "—"}</TableCell>
                          <TableCell className="font-mono text-xs text-green-400">{trade.takeProfit != null ? fmt(trade.takeProfit, dp(trade.symbol)) : "—"}</TableCell>
                          <TableCell className="text-right font-mono font-bold text-sm">
                            <motion.span
  key={Math.round(floatPL * 100)}
  initial={{ opacity: 0.6 }}
  animate={{ opacity: 1 }}
  className={floatPL >= 0 ? "text-green-400" : "text-red-400"}
>
  {floatPL >= 0 ? "+" : ""}${n(floatPL).toFixed(2)} USD
</motion.span>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button size="sm" variant="outline" onClick={() => handleClose(trade.id)} disabled={closeTrade.isPending}
                              className="h-6 text-xs gap-1 border-border hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30"
                            ><X className="w-3 h-3" /> Close</Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-10 text-muted-foreground text-sm">
                <Layers className="w-8 h-8 mx-auto mb-2 opacity-30" />
                No open positions. Use the order panel to open a trade.
              </div>
            )
          )}

          {/* History */}
          {activeTab === "history" && (
            (closedTrades as any[]).length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border/30">
                      {["Date","Symbol","Dir","Amount","Entry","Close","P/L"].map((h, i) => (
                        <TableHead key={i} className={`text-xs ${i === 6 ? "text-right" : ""}`}>{h}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(closedTrades as any[]).map((trade) => {
                      const pl = trade.profitLoss != null ? n(trade.profitLoss) : null;
                      return (
                        <TableRow key={trade.id} className="border-border/20 hover:bg-accent/20 transition-colors">
                          <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{format(new Date(trade.createdAt), "MM/dd HH:mm")}</TableCell>
                          <TableCell className="font-bold text-xs" style={{ color: SYMBOL_COLORS[trade.symbol] }}>{trade.symbol}</TableCell>
                          <TableCell>
                            <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${trade.direction === "buy" ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"}`}>
                              {(trade.direction ?? "buy").toUpperCase()}
                            </span>
                          </TableCell>
                          <TableCell className="font-mono text-xs">
  ${n(trade.amount).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} USD
</TableCell>
                          <TableCell className="font-mono text-xs">{fmt(trade.entryPrice, dp(trade.symbol))}</TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground">{trade.closePrice != null ? fmt(trade.closePrice, dp(trade.symbol)) : "—"}</TableCell>
                          <TableCell className="text-right font-mono font-bold text-sm">
                            {pl != null ? (
                              <span className={pl >= 0 ? "text-green-400" : "text-red-400"}>
                                {pl >= 0 ? "+" : ""}
${n(pl).toLocaleString("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})} USD
                              </span>
                            ) : "—"}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-10 text-muted-foreground text-sm">
                <History className="w-8 h-8 mx-auto mb-2 opacity-30" />
                No closed trades yet.
              </div>
            )
          )}

          {/* Analytics */}
          {activeTab === "analytics" && (
            <PnlAnalytics trades={closedTrades as any[]} />
          )}
        </motion.div>
      </div>
    </div>
  );
}
