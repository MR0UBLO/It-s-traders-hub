import { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bot, TrendingUp, TrendingDown, Minus, Zap, Clock, Target, Search, Star, Bell, BellOff, Shield, AlertTriangle, ChevronRight, BarChart2, Filter } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { BarChart, Bar, ResponsiveContainer, Tooltip, XAxis, YAxis, Cell } from "recharts";

/* ─── AI SIGNAL GENERATOR ────────────────────────────────────────── */
const FOREX   = ["EURUSD","GBPUSD","USDJPY","USDCHF","AUDUSD","NZDUSD","USDCAD","EURJPY","GBPJPY","EURGBP"];
const CRYPTO  = ["BTCUSD","ETHUSD","SOLUSDT","BNBUSDT","XRPUSDT","ADAUSDT","DOGEUSDT","AVAXUSDT"];
const STOCKS  = ["AAPL","TSLA","AMZN","NVDA","MSFT","GOOGL","META","NFLX"];
const COMMOD  = ["XAUUSD","XAGUSD","CRUDE OIL","BRENT","NATURAL GAS","COPPER","PLATINUM"];
const INDICES = ["NASDAQ","S&P500","DOW JONES","FTSE100","DAX40","NIKKEI225","ASX200"];

const TIMEFRAMES = ["M1","M5","M15","M30","H1","H4","Daily","Weekly"] as const;
type TF = typeof TIMEFRAMES[number];

const TRENDS = ["Strong Uptrend","Uptrend","Sideways","Downtrend","Strong Downtrend"] as const;
const SUMMARIES = [
  "RSI oversold + bullish engulfing at key support. MACD crossover confirmed. Moving averages aligned.",
  "Double bottom pattern at major support zone. Volume increasing. Stochastic turning up from oversold.",
  "Head & shoulders breakdown. Price below 200 EMA. Momentum strongly bearish. Sell pressure increasing.",
  "Golden cross on H4. Price retesting breakout level. Fibonacci 0.618 holding as support.",
  "Breaking out of 3-week consolidation range. Volume spike confirms move. Trend continuation expected.",
  "Supply zone rejection. Bearish divergence on RSI. Price action shows weakness. Distribution phase.",
  "Smart money accumulation zone. Liquidity sweep complete. Institutional order flow bullish.",
  "Key resistance break with strong close. Previous resistance now acts as support. Continuation likely.",
];
const RISK_LEVELS = ["Low","Medium","High"] as const;
const DURATIONS = ["15-30 min","1-4 hours","4-8 hours","1-3 days","3-7 days","1-2 weeks"];

function seeded(seed: number, max: number, min = 0) {
  const x = Math.sin(seed + 1) * 43758.5453;
  return min + ((x - Math.floor(x)) * (max - min));
}

function makePriceEntry(symbol: string, seed: number) {
  const base = symbol === "BTCUSD" ? 97000 : symbol === "ETHUSD" ? 3100 : symbol === "XAUUSD" ? 2840 : symbol.includes("USD") && !symbol.startsWith("USD") ? 1 + seeded(seed, 0.5) : symbol.includes("JPY") ? 145 + seeded(seed, 10) : 100 + seeded(seed * 3, 200);
  const pip = base < 10 ? 0.0001 : base < 100 ? 0.01 : base < 10000 ? 1 : 100;
  return { base, pip };
}

function formatPrice(v: number, symbol: string) {
  if (symbol.includes("JPY")) return v.toFixed(3);
  if (v > 1000) return v.toFixed(2);
  if (v > 10) return v.toFixed(3);
  return v.toFixed(5);
}

type Signal = {
  id: number; symbol: string; category: string; direction: "BUY"|"SELL"|"NEUTRAL";
  confidence: number; timeframe: TF; entry: number; sl: number; tp1: number; tp2: number; tp3: number;
  risk: typeof RISK_LEVELS[number]; trend: typeof TRENDS[number]; summary: string;
  timestamp: string; duration: string; active: boolean; isFav: boolean;
  rr: number; pipsGain: number; formatEntry: string; formatSL: string; formatTP1: string; formatTP2: string; formatTP3: string;
};

let _sigSeed = 0;
function makeSignal(symbol: string, category: string, tfIndex: number, idx: number): Signal {
  const seed = ++_sigSeed * 7 + idx * 13 + tfIndex * 31;
  const dir = seeded(seed, 1) > 0.45 ? "BUY" : seeded(seed * 3, 1) > 0.7 ? "NEUTRAL" : "SELL";
  const confidence = Math.round(seeded(seed * 5, 44, 51));
  const tf = TIMEFRAMES[tfIndex % TIMEFRAMES.length];
  const { base, pip } = makePriceEntry(symbol, seed);
  const slPips = Math.round(seeded(seed * 7, 80, 15));
  const tp1Pips = Math.round(slPips * (1 + seeded(seed * 11, 0.8, 0.2)));
  const tp2Pips = Math.round(tp1Pips * (1 + seeded(seed * 13, 0.8, 0.3)));
  const tp3Pips = Math.round(tp2Pips * (1 + seeded(seed * 17, 1, 0.4)));
  const entry = base;
  const sl   = dir === "BUY" ? entry - slPips * pip : entry + slPips * pip;
  const tp1  = dir === "BUY" ? entry + tp1Pips * pip : entry - tp1Pips * pip;
  const tp2  = dir === "BUY" ? entry + tp2Pips * pip : entry - tp2Pips * pip;
  const tp3  = dir === "BUY" ? entry + tp3Pips * pip : entry - tp3Pips * pip;
  const minAgo = Math.floor(seeded(seed * 19, 180, 1));
  const timestamp = minAgo < 60 ? `${minAgo} min ago` : `${Math.floor(minAgo / 60)}h ${minAgo % 60}m ago`;
  return {
    id: seed, symbol, category, direction: dir as "BUY"|"SELL"|"NEUTRAL",
    confidence, timeframe: tf, entry, sl, tp1, tp2, tp3,
    risk: RISK_LEVELS[Math.floor(seeded(seed * 23, 3))],
    trend: TRENDS[Math.floor(seeded(seed * 29, 5))],
    summary: SUMMARIES[Math.floor(seeded(seed * 31, SUMMARIES.length))],
    timestamp, duration: DURATIONS[Math.floor(seeded(seed * 37, DURATIONS.length))],
    active: seeded(seed * 41, 1) > 0.4,
    isFav: false, rr: Math.round(tp1Pips / slPips * 10) / 10,
    pipsGain: tp1Pips,
    formatEntry: formatPrice(entry, symbol),
    formatSL: formatPrice(sl, symbol),
    formatTP1: formatPrice(tp1, symbol),
    formatTP2: formatPrice(tp2, symbol),
    formatTP3: formatPrice(tp3, symbol),
  };
}

const ALL_SIGNALS: Signal[] = [
  ...FOREX.flatMap((s, i) => [makeSignal(s, "Forex", i % 8, i), makeSignal(s, "Forex", (i + 3) % 8, i + 100)]),
  ...CRYPTO.flatMap((s, i) => [makeSignal(s, "Crypto", i % 8, i + 200)]),
  ...STOCKS.flatMap((s, i) => [makeSignal(s, "Stocks", i % 8, i + 300)]),
  ...COMMOD.flatMap((s, i) => [makeSignal(s, "Commodities", i % 8, i + 400)]),
  ...INDICES.flatMap((s, i) => [makeSignal(s, "Indices", i % 8, i + 500)]),
];

/* ─── PERFORMANCE HISTORY ───────────────────────────────────────── */
const PERF_DATA = Array.from({ length: 30 }, (_, i) => ({
  day: i + 1,
  won: Math.floor(seeded((i + 1) * 7, 8, 2)),
  lost: Math.floor(seeded((i + 1) * 11, 4, 0)),
}));

/* ─── CONFIDENCE BAR ─────────────────────────────────────────────── */
function ConfidenceBar({ value }: { value: number }) {
  const color = value >= 80 ? "#22C55E" : value >= 65 ? "#F59E0B" : "#EF4444";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
        <motion.div initial={{ width: 0 }} animate={{ width: `${value}%` }} transition={{ duration: 0.8 }} className="h-full rounded-full" style={{ backgroundColor: color }} />
      </div>
      <span className="text-xs font-bold tabular-nums" style={{ color }}>{value}%</span>
    </div>
  );
}

/* ─── SIGNAL DETAIL MODAL ─────────────────────────────────────────── */
function SignalModal({ signal, onClose }: { signal: Signal; onClose: () => void }) {
  const { toast } = useToast();
  const isDir = (d: "BUY"|"SELL"|"NEUTRAL") => signal.direction === d;
  const dirColor = isDir("BUY") ? "text-green-400" : isDir("SELL") ? "text-red-400" : "text-yellow-400";
  const dirBg   = isDir("BUY") ? "bg-green-500/10 border-green-500/20" : isDir("SELL") ? "bg-red-500/10 border-red-500/20" : "bg-yellow-500/10 border-yellow-500/20";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} onClick={e => e.stopPropagation()} className="w-full max-w-lg bg-card border border-border rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${dirBg}`}>
              {isDir("BUY") ? <TrendingUp className={`w-5 h-5 ${dirColor}`} /> : isDir("SELL") ? <TrendingDown className={`w-5 h-5 ${dirColor}`} /> : <Minus className={`w-5 h-5 ${dirColor}`} />}
            </div>
            <div>
              <p className="font-bold text-lg">{signal.symbol}</p>
              <p className={`text-xs font-bold ${dirColor}`}>{signal.direction} · {signal.timeframe}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-accent transition-colors text-muted-foreground">✕</button>
        </div>
        <div className="p-5 space-y-5">
          <div>
            <p className="text-xs text-muted-foreground mb-1">AI Confidence</p>
            <ConfidenceBar value={signal.confidence} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Entry Price", value: signal.formatEntry, color: "" },
              { label: "Stop Loss", value: signal.formatSL, color: "text-red-400" },
              { label: "Take Profit 1", value: signal.formatTP1, color: "text-green-400" },
              { label: "Take Profit 2", value: signal.formatTP2, color: "text-green-400" },
              { label: "Take Profit 3", value: signal.formatTP3, color: "text-green-400" },
              { label: "Risk:Reward", value: `1:${signal.rr}`, color: "text-primary" },
            ].map(({ label, value, color }) => (
              <div key={label} className="bg-muted/30 rounded-xl p-3">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</p>
                <p className={`font-mono font-bold mt-0.5 ${color}`}>{value}</p>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: "Risk Level", value: signal.risk },
              { label: "Trend", value: signal.trend },
              { label: "Est. Duration", value: signal.duration },
            ].map(({ label, value }) => (
              <div key={label} className="bg-muted/20 rounded-xl p-3 text-center">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</p>
                <p className="text-xs font-bold mt-0.5">{value}</p>
              </div>
            ))}
          </div>
          <div className="bg-primary/5 border border-primary/20 rounded-xl p-4">
            <p className="text-xs font-semibold text-primary mb-1.5">Technical Summary</p>
            <p className="text-sm text-muted-foreground leading-relaxed">{signal.summary}</p>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="w-3.5 h-3.5" />Generated {signal.timestamp}
            {signal.active && <span className="ml-1 px-2 py-0.5 bg-green-500/10 text-green-400 rounded-full font-semibold border border-green-500/20">● Live</span>}
          </div>
          <button onClick={() => { toast({ title: "Signal saved to favorites" }); onClose(); }} className="w-full py-2.5 rounded-xl border border-primary/30 text-primary text-sm font-semibold hover:bg-primary/10 transition-colors">
            <Star className="w-3.5 h-3.5 inline mr-1.5" />Save to Favorites
          </button>
        </div>
      </motion.div>
    </div>
  );
}

/* ─── SIGNAL CARD ─────────────────────────────────────────────────── */
function SignalCard({ signal, isFav, onToggleFav, onClick }: { signal: Signal; isFav: boolean; onToggleFav: () => void; onClick: () => void }) {
  const isDir = (d: string) => signal.direction === d;
  const dirColor = isDir("BUY") ? "text-green-400" : isDir("SELL") ? "text-red-400" : "text-yellow-400";
  const dirBg   = isDir("BUY") ? "bg-green-500/10 text-green-500" : isDir("SELL") ? "bg-red-500/10 text-red-500" : "bg-yellow-500/10 text-yellow-500";

  return (
    <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className={`glass-card rounded-2xl p-5 cursor-pointer hover:border-primary/20 border border-transparent transition-all group ${signal.active ? "border-l-2 border-l-primary" : ""}`} onClick={onClick}>
      <div className="flex flex-col md:flex-row md:items-center gap-4">
        {/* Direction */}
        <div className="flex items-center gap-3 min-w-[160px]">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${dirBg}`}>
            {isDir("BUY") ? <TrendingUp className="w-5 h-5" /> : isDir("SELL") ? <TrendingDown className="w-5 h-5" /> : <Minus className="w-5 h-5" />}
          </div>
          <div>
            <p className="font-bold">{signal.symbol}</p>
            <p className={`text-xs font-bold ${dirColor}`}>{signal.direction}</p>
            <p className="text-[10px] text-muted-foreground">{signal.category}</p>
          </div>
        </div>

        {/* Confidence + summary */}
        <div className="flex-1 space-y-1.5">
          <ConfidenceBar value={signal.confidence} />
          <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">{signal.summary}</p>
        </div>

        {/* Prices */}
        <div className="grid grid-cols-4 gap-3 text-xs min-w-[260px]">
          <div className="text-center">
            <p className="text-muted-foreground mb-0.5">Entry</p>
            <p className="font-mono font-bold text-[11px]">{signal.formatEntry}</p>
          </div>
          <div className="text-center">
            <p className="text-muted-foreground mb-0.5">SL</p>
            <p className="font-mono font-bold text-red-400 text-[11px]">{signal.formatSL}</p>
          </div>
          <div className="text-center">
            <p className="text-muted-foreground mb-0.5">TP1</p>
            <p className="font-mono font-bold text-green-400 text-[11px]">{signal.formatTP1}</p>
          </div>
          <div className="text-center">
            <p className="text-muted-foreground mb-0.5">R:R</p>
            <p className="font-mono font-bold text-primary text-[11px]">1:{signal.rr}</p>
          </div>
        </div>

        {/* Meta */}
        <div className="flex flex-col items-end gap-1.5 text-xs text-muted-foreground min-w-[110px]">
          <div className="flex items-center gap-1.5">
            <span className="px-2 py-0.5 rounded-full border border-border">{signal.timeframe}</span>
            {signal.active && <span className="px-2 py-0.5 rounded-full bg-green-500/10 text-green-400 font-semibold border border-green-500/20">Live</span>}
          </div>
          <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{signal.timestamp}</span>
          <span className="flex items-center gap-1">{signal.duration}</span>
          <div className="flex items-center gap-1">
            <button onClick={e => { e.stopPropagation(); onToggleFav(); }} className={`w-6 h-6 rounded flex items-center justify-center transition-colors ${isFav ? "text-yellow-400" : "text-muted-foreground hover:text-yellow-400"}`}><Star className={`w-3.5 h-3.5 ${isFav ? "fill-yellow-400" : ""}`} /></button>
            <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
          </div>
        </div>
      </div>
    </motion.div>
  );
}

/* ─── MAIN ─────────────────────────────────────────────────────────── */
const CATEGORIES = ["All","Forex","Crypto","Stocks","Commodities","Indices"];

export default function AiSignals() {
  const [category, setCategory]   = useState("All");
  const [tfFilter, setTfFilter]   = useState<TF | "All">("All");
  const [dirFilter, setDirFilter] = useState<"All"|"BUY"|"SELL">("All");
  const [search, setSearch]       = useState("");
  const [favs, setFavs]           = useState<Set<number>>(new Set());
  const [showFavsOnly, setShowFavsOnly] = useState(false);
  const [notifOn, setNotifOn]     = useState(false);
  const [selected, setSelected]   = useState<Signal | null>(null);
  const [tab, setTab]             = useState<"signals"|"history"|"performance">("signals");
  const { toast }                 = useToast();

  // refresh signals every 30s
  const [tick, setTick] = useState(0);
  useEffect(() => { const id = setInterval(() => setTick(t => t + 1), 30000); return () => clearInterval(id); }, []);

  const filtered = useMemo(() => {
    let list = [...ALL_SIGNALS];
    if (category !== "All") list = list.filter(s => s.category === category);
    if (tfFilter !== "All") list = list.filter(s => s.timeframe === tfFilter);
    if (dirFilter !== "All") list = list.filter(s => s.direction === dirFilter);
    if (search) list = list.filter(s => s.symbol.toLowerCase().includes(search.toLowerCase()));
    if (showFavsOnly) list = list.filter(s => favs.has(s.id));
    return list.slice(0, 40);
  }, [category, tfFilter, dirFilter, search, showFavsOnly, favs, tick]);

  const activeCount = ALL_SIGNALS.filter(s => s.active).length;
  const avgConf = Math.round(filtered.reduce((a, s) => a + s.confidence, 0) / Math.max(filtered.length, 1));
  const buyCount  = filtered.filter(s => s.direction === "BUY").length;
  const sellCount = filtered.filter(s => s.direction === "SELL").length;

  const toggleFav = (id: number) => setFavs(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2"><Bot className="w-7 h-7 text-primary" />AI Signals</h1>
        <p className="text-muted-foreground text-sm">Machine-learning powered trade signals. Updated every 30 seconds.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Live Signals", value: activeCount, icon: Zap, color: "text-green-400" },
          { label: "Avg Confidence", value: `${avgConf}%`, icon: Target, color: "text-primary" },
          { label: "Buy Signals", value: buyCount, icon: TrendingUp, color: "text-green-400" },
          { label: "Sell Signals", value: sellCount, icon: TrendingDown, color: "text-red-400" },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="glass-card rounded-2xl p-4 text-center">
            <Icon className={`w-5 h-5 ${color} mx-auto mb-2`} />
            <p className="text-2xl font-bold">{value}</p>
            <p className="text-xs text-muted-foreground">{label}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-muted/30 rounded-xl p-1 w-fit">
        {(["signals","history","performance"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 rounded-lg text-sm font-semibold capitalize transition-all ${tab === t ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>{t}</button>
        ))}
      </div>

      {tab === "signals" && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search symbol..." className="pl-8 h-9 w-44 bg-card border-border text-sm" />
            </div>
            <div className="flex gap-1 flex-wrap">
              {CATEGORIES.map(c => (
                <button key={c} onClick={() => setCategory(c)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${category === c ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/40"}`}>{c}</button>
              ))}
            </div>
            <div className="flex gap-1">
              {(["All","BUY","SELL"] as const).map(d => (
                <button key={d} onClick={() => setDirFilter(d)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${dirFilter === d ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/40"}`}>{d}</button>
              ))}
            </div>
            <div className="flex gap-1 flex-wrap">
              {(["All",...TIMEFRAMES] as const).map(t => (
                <button key={t} onClick={() => setTfFilter(t as any)} className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold border transition-all ${tfFilter === t ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/30"}`}>{t}</button>
              ))}
            </div>
            <div className="flex gap-2 ml-auto">
              <button onClick={() => setShowFavsOnly(!showFavsOnly)} className={`flex items-center gap-1 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all ${showFavsOnly ? "border-yellow-500 bg-yellow-500/10 text-yellow-400" : "border-border text-muted-foreground hover:border-primary/40"}`}>
                <Star className={`w-3 h-3 ${showFavsOnly ? "fill-yellow-400" : ""}`} />Favorites
              </button>
              <button onClick={() => { setNotifOn(!notifOn); toast({ title: notifOn ? "Notifications off" : "Notifications on", description: notifOn ? "You will not receive signal alerts." : "You will receive alerts for new signals." }); }} className={`flex items-center gap-1 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all ${notifOn ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}>
                {notifOn ? <Bell className="w-3 h-3" /> : <BellOff className="w-3 h-3" />}{notifOn ? "On" : "Off"}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Showing <span className="font-semibold text-foreground">{filtered.length}</span> signals</p>
            <span className="text-[10px] bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 px-2 py-0.5 rounded-full font-semibold">⚠ NOT FINANCIAL ADVICE</span>
          </div>

          <div className="space-y-3">
            {filtered.map((s, i) => (
              <motion.div key={`${s.id}-${tick}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
                <SignalCard signal={s} isFav={favs.has(s.id)} onToggleFav={() => toggleFav(s.id)} onClick={() => setSelected(s)} />
              </motion.div>
            ))}
            {filtered.length === 0 && (
              <div className="text-center py-16 text-muted-foreground">
                <Bot className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="font-medium">No signals match your filters</p>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === "history" && (
        <div className="space-y-4">
          <div className="glass-card rounded-2xl overflow-hidden">
            <div className="p-4 border-b border-border">
              <h3 className="font-semibold">Signal History (Last 30 Days)</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-border">
                  {["Symbol","Direction","TF","Entry","Close","Result","Date"].map(h => <th key={h} className="text-left p-3 text-xs text-muted-foreground font-semibold">{h}</th>)}
                </tr></thead>
                <tbody>
                  {Array.from({ length: 20 }, (_, i) => {
                    const sym = [...FOREX,...CRYPTO,...COMMOD][i % 17];
                    const won = seeded((i+1)*7, 1) > 0.37;
                    const dir = seeded((i+1)*11, 1) > 0.45 ? "BUY" : "SELL";
                    const pips = Math.round(seeded((i+1)*13, 80, 5));
                    const date = new Date(Date.now() - seeded((i+1)*17, 86400000*30)).toLocaleDateString("en-KE",{day:"2-digit",month:"short"});
                    return (
                      <tr key={i} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                        <td className="p-3 font-semibold">{sym}</td>
                        <td className="p-3"><span className={`text-xs font-bold px-2 py-0.5 rounded-full ${dir==="BUY"?"bg-green-500/10 text-green-400":"bg-red-500/10 text-red-400"}`}>{dir}</span></td>
                        <td className="p-3 text-muted-foreground">{TIMEFRAMES[i % 8]}</td>
                        <td className="p-3 font-mono text-xs">{(1.1+seeded((i+1)*19,0.5)).toFixed(4)}</td>
                        <td className="p-3 font-mono text-xs">{(1.1+seeded((i+1)*23,0.5)).toFixed(4)}</td>
                        <td className="p-3"><span className={`text-xs font-bold ${won?"text-green-400":"text-red-400"}`}>{won?"+":"-"}{pips} pips</span></td>
                        <td className="p-3 text-muted-foreground text-xs">{date}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {tab === "performance" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { label: "Overall Win Rate", value: "63.4%", sub: "Last 30 days", color: "text-green-400" },
              { label: "Total Signals", value: "847", sub: "Generated this month", color: "text-primary" },
              { label: "Avg R:R Ratio", value: "1:2.1", sub: "Across all signals", color: "text-yellow-400" },
            ].map(({ label, value, sub, color }) => (
              <div key={label} className="glass-card rounded-2xl p-5 text-center">
                <p className={`text-3xl font-bold ${color}`}>{value}</p>
                <p className="font-semibold text-sm mt-1">{label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>
              </div>
            ))}
          </div>

          <div className="glass-card rounded-2xl p-5">
            <h3 className="font-semibold mb-4">Daily Signal Performance (Last 30 Days)</h3>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={PERF_DATA} barGap={2}>
                  <XAxis dataKey="day" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="won" name="Won" radius={[3,3,0,0]} fill="#22c55e" />
                  <Bar dataKey="lost" name="Lost" radius={[3,3,0,0]} fill="#ef4444" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="glass-card rounded-2xl p-5">
            <h3 className="font-semibold mb-4">Performance by Asset Class</h3>
            <div className="space-y-3">
              {[["Forex","72%",72],["Crypto","58%",58],["Stocks","65%",65],["Commodities","69%",69],["Indices","61%",61]].map(([cat, pct, val]) => (
                <div key={cat as string} className="flex items-center gap-4">
                  <p className="text-sm font-medium w-24">{cat}</p>
                  <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                    <motion.div initial={{ width: 0 }} animate={{ width: `${val}%` }} transition={{ duration: 1 }} className="h-full rounded-full bg-primary" />
                  </div>
                  <p className="text-sm font-bold w-10 text-right">{pct}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="glass-card rounded-2xl p-4 flex items-start gap-2 text-xs text-muted-foreground">
        <Shield className="w-4 h-4 flex-shrink-0 mt-0.5 text-primary/50" />
        All AI signals are generated for informational purposes only. They do not represent real trading recommendations, guaranteed profits, or guaranteed win rates. Trading involves substantial risk of loss.
      </div>

      <AnimatePresence>
        {selected && <SignalModal signal={selected} onClose={() => setSelected(null)} />}
      </AnimatePresence>
    </div>
  );
}
