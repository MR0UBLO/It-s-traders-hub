import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bot, Zap, TrendingUp, TrendingDown, BarChart2, Power, AlertTriangle, Shield, RefreshCw, BookOpen, Settings, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAccountStore } from "@/store/account-store";
import { AreaChart, Area, ResponsiveContainer, Tooltip, XAxis, YAxis, BarChart, Bar } from "recharts";

/* ─── STRATEGIES ──────────────────────────────────────────────────── */
const STRATEGIES = [
  { id: "trend",   label: "Trend Following", desc: "Follows strong market trends using EMA crossovers and momentum indicators.", risk: "Medium", timeframe: "H1–H4" },
  { id: "scalp",   label: "Scalping AI",     desc: "High-frequency micro-trades targeting 5-15 pip moves on short timeframes.", risk: "High",   timeframe: "M1–M5" },
  { id: "swing",   label: "Swing Trading",   desc: "Captures multi-day moves using support/resistance and Fibonacci levels.", risk: "Low",    timeframe: "H4–Daily" },
  { id: "breakout",label: "Breakout Hunter", desc: "Detects and trades price breakouts from key consolidation zones.", risk: "Medium", timeframe: "H1–H4" },
  { id: "grid",    label: "Grid Trading",    desc: "Places orders at fixed price intervals to profit from oscillating markets.", risk: "Medium", timeframe: "Any" },
  { id: "smc",     label: "Smart Money",     desc: "Follows institutional order flow, fair value gaps, and liquidity sweeps.", risk: "High",   timeframe: "M15–H1" },
];

/* ─── STRATEGY DATA ─────────────────────────────────────────────── */
function seeded(seed: number, max: number, min = 0) {
  const x = Math.sin(seed + 1) * 43758.5453;
  return min + ((x - Math.floor(x)) * (max - min));
}

function makeEquity(enabled: boolean) {
  let v = 10000;
  return Array.from({ length: 30 }, (_, i) => {
    const delta = enabled ? seeded(i * 7, 220, -60) : seeded(i * 7, 80, -80);
    v = Math.max(7000, v + delta);
    return { day: `D${i + 1}`, equity: Math.round(v) };
  });
}

const SYMBOLS = ["EURUSD","XAUUSD","BTCUSD","GBPUSD","NASDAQ","ETHUSD"];
const DIRS    = ["BUY","SELL"] as const;

function makeTrades(n: number, active: boolean) {
  return Array.from({ length: n }, (_, i) => {
    const s = i + 1;
    const sym = SYMBOLS[i % SYMBOLS.length];
    const dir = seeded(s * 7, 1) > 0.45 ? "BUY" : "SELL";
    const pnl = active ? Math.round(seeded(s * 11, 180, -60) * 10) / 10 : Math.round(seeded(s * 13, 420, -120) * 10) / 10;
    const lots = Math.round(seeded(s * 17, 0.5, 0.01) * 100) / 100;
    const mins = Math.floor(seeded(s * 19, 240, 2));
    const time = active ? `${mins}m ago` : new Date(Date.now() - seeded(s * 23, 86400000 * 14)).toLocaleDateString("en-KE", { day: "2-digit", month: "short" });
    return { id: s, sym, dir, pnl, lots, time, open: active };
  });
}

const DAILY_STATS = Array.from({ length: 7 }, (_, i) => ({
  day: ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"][i],
  profit: Math.round(seeded((i + 1) * 7, 320, -80)),
  trades: Math.floor(seeded((i + 1) * 11, 18, 2)),
}));

/* ─── MAIN ─────────────────────────────────────────────────────────── */
export default function AutoTrading() {
  const { mode } = useAccountStore();
  const isDemo = mode === "demo";
  const { toast } = useToast();

  const [enabled, setEnabled]         = useState(false);
  const [strategy, setStrategy]       = useState("trend");
  const [riskPct, setRiskPct]         = useState("2");
  const [posSize, setPosSize]         = useState("0.1");
  const [dailyTarget, setDailyTarget] = useState("5");
  const [dailyLoss, setDailyLoss]     = useState("3");
  const [maxTrades, setMaxTrades]     = useState("5");
  const [sl, setSl]                   = useState("30");
  const [tp, setTp]                   = useState("60");
  const [trailing, setTrailing]       = useState(false);
  const [breakeven, setBreakeven]     = useState(false);
  const [emergency, setEmergency]     = useState(false);
  const [tab, setTab]                 = useState<"active"|"closed"|"journal"|"stats">("active");
  const [stratOpen, setStratOpen]     = useState(false);

  const [equity, setEquity] = useState(() => makeEquity(false));
  useEffect(() => { setEquity(makeEquity(enabled)); }, [enabled]);

  const selectedStrat = STRATEGIES.find(s => s.id === strategy)!;

  const activeTrades = enabled ? makeTrades(Math.floor(Number(maxTrades) * 0.6) || 3, true) : [];
  const closedTrades = makeTrades(20, false);

  const totalPnL   = activeTrades.reduce((a, t) => a + t.pnl, 0);
  const todayPnL   = closedTrades.slice(0, 5).reduce((a, t) => a + t.pnl, 0);
  const winRate    = Math.round(closedTrades.filter(t => t.pnl > 0).length / closedTrades.length * 100);
  const totalProfit = closedTrades.reduce((a, t) => a + t.pnl, 0);

  const handleToggle = () => {
    if (!enabled) {
      toast({ title: "Auto Trading activated", description: `${selectedStrat.label} strategy running in ${isDemo ? "Demo" : "Real"} mode.` });
    } else {
      toast({ title: "Auto Trading stopped", description: "All open positions remain until closed manually." });
    }
    setEnabled(!enabled);
    setEmergency(false);
  };

  const handleEmergency = () => {
    setEmergency(true);
    setEnabled(false);
    toast({ title: "Emergency Stop activated", description: "All auto trading halted immediately.", variant: "destructive" });
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2"><Bot className="w-7 h-7 text-primary" />Auto Trading</h1>
          <p className="text-muted-foreground text-sm mt-0.5">AI-powered automated trading in {isDemo ? "Demo" : "Real"} account.</p>
        </div>
        <div className="flex items-center gap-3">
          {emergency && <span className="px-3 py-1.5 bg-red-500/10 text-red-400 border border-red-500/20 rounded-xl text-xs font-bold">EMERGENCY STOP ACTIVE</span>}
          <button
            onClick={handleToggle}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all border ${enabled ? "bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20" : "bg-primary/10 border-primary/30 text-primary hover:bg-primary/20"}`}
          >
            <Power className={`w-4 h-4 ${enabled ? "animate-pulse" : ""}`} />
            {enabled ? "Stop AI Trading" : "Start AI Trading"}
          </button>
        </div>
      </div>

      {/* Status banner */}
      <AnimatePresence>
        {enabled && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="flex items-center gap-3 p-4 bg-green-500/5 border border-green-500/20 rounded-2xl">
            <span className="w-2.5 h-2.5 rounded-full bg-green-400 animate-pulse flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-green-400">Auto Trading Active — {selectedStrat.label}</p>
              <p className="text-xs text-muted-foreground">Running in {isDemo ? "Demo" : "Real"} mode · {activeTrades.length} active positions · Open P&L: <span className={totalPnL >= 0 ? "text-green-400" : "text-red-400"}>{totalPnL >= 0 ? "+" : ""}{totalPnL.toFixed(2)} USD</span></p>
            </div>
            <button onClick={handleEmergency} className="px-3 py-1.5 bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg text-xs font-bold hover:bg-red-500/20 transition-colors flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5" />Emergency Stop
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Settings panel */}
        <div className="space-y-4">
          <div className="glass-card rounded-2xl p-5 space-y-5">
            <p className="font-semibold flex items-center gap-2"><Settings className="w-4 h-4 text-primary" />Configuration</p>

            {/* Strategy */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider">Strategy</Label>
              <button onClick={() => setStratOpen(!stratOpen)} className="w-full flex items-center justify-between p-3 bg-background border border-border rounded-xl text-sm font-semibold hover:border-primary/40 transition-colors">
                <span>{selectedStrat.label}</span>
                <ChevronDown className={`w-4 h-4 transition-transform ${stratOpen ? "rotate-180" : ""}`} />
              </button>
              <AnimatePresence>
                {stratOpen && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                    <div className="space-y-1.5 mt-1">
                      {STRATEGIES.map(s => (
                        <button key={s.id} onClick={() => { setStrategy(s.id); setStratOpen(false); }} className={`w-full text-left p-3 rounded-xl border text-xs transition-all ${strategy === s.id ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"}`}>
                          <div className="flex items-center justify-between">
                            <p className="font-semibold">{s.label}</p>
                            <span className={`px-2 py-0.5 rounded-full font-bold ${s.risk === "Low" ? "bg-green-500/10 text-green-400" : s.risk === "High" ? "bg-red-500/10 text-red-400" : "bg-yellow-500/10 text-yellow-400"}`}>{s.risk}</span>
                          </div>
                          <p className="text-muted-foreground mt-1 text-[10px] leading-relaxed">{s.desc}</p>
                          <p className="text-muted-foreground mt-0.5 text-[10px]">Timeframe: {s.timeframe}</p>
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Risk settings */}
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Risk %", value: riskPct, set: setRiskPct, min: "0.1", max: "10" },
                { label: "Lot Size", value: posSize, set: setPosSize, min: "0.01", max: "10" },
                { label: "Daily Target %", value: dailyTarget, set: setDailyTarget, min: "0.5", max: "50" },
                { label: "Daily Loss Limit %", value: dailyLoss, set: setDailyLoss, min: "0.5", max: "50" },
                { label: "Max Trades", value: maxTrades, set: setMaxTrades, min: "1", max: "50" },
                { label: "Stop Loss (pips)", value: sl, set: setSl, min: "5", max: "500" },
                { label: "Take Profit (pips)", value: tp, set: setTp, min: "5", max: "1000" },
              ].map(({ label, value, set, min, max }) => (
                <div key={label} className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</Label>
                  <Input type="number" value={value} onChange={e => set(e.target.value)} min={min} max={max} className="h-9 bg-background border-border font-mono text-sm" disabled={enabled} />
                </div>
              ))}
            </div>

            {/* Toggles */}
            <div className="space-y-2">
              {[
                { label: "Trailing Stop", value: trailing, set: setTrailing, desc: "Moves SL as price advances" },
                { label: "Break-Even", value: breakeven, set: setBreakeven, desc: "Move SL to entry at 50% TP" },
              ].map(({ label, value, set, desc }) => (
                <div key={label} className="flex items-center justify-between p-3 bg-muted/20 rounded-xl">
                  <div>
                    <p className="text-sm font-medium">{label}</p>
                    <p className="text-[10px] text-muted-foreground">{desc}</p>
                  </div>
                  <button onClick={() => !enabled && set(!value)} className={`w-11 h-6 rounded-full transition-all relative ${value ? "bg-primary" : "bg-muted"} ${enabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}>
                    <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${value ? "translate-x-5" : ""}`} />
                  </button>
                </div>
              ))}
            </div>

            {enabled && <p className="text-[10px] text-muted-foreground text-center">Stop AI Trading to modify settings</p>}
          </div>
        </div>

        {/* Right side */}
        <div className="xl:col-span-2 space-y-5">
          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: "Active Trades", value: activeTrades.length, color: "text-primary" },
              { label: "Today P&L", value: `${todayPnL >= 0 ? "+" : ""}$${todayPnL.toFixed(2)}`, color: todayPnL >= 0 ? "text-green-400" : "text-red-400" },
              { label: "Win Rate", value: `${winRate}%`, color: "text-yellow-400" },
              { label: "Total P&L", value: `${totalProfit >= 0 ? "+" : ""}$${totalProfit.toFixed(2)}`, color: totalProfit >= 0 ? "text-green-400" : "text-red-400" },
            ].map(({ label, value, color }) => (
              <div key={label} className="glass-card rounded-2xl p-4 text-center">
                <p className={`text-xl font-bold font-mono ${color}`}>{value}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{label}</p>
              </div>
            ))}
          </div>

          {/* Equity chart */}
          <div className="glass-card rounded-2xl p-5">
            <p className="font-semibold text-sm mb-4 flex items-center gap-2"><TrendingUp className="w-4 h-4 text-primary" />Equity Curve (30 Days)</p>
            <div className="h-40">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={equity}>
                  <defs>
                    <linearGradient id="eqGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="day" tick={{ fontSize: 9 }} tickLine={false} axisLine={false} interval={4} />
                  <YAxis tick={{ fontSize: 9 }} tickLine={false} axisLine={false} width={55} tickFormatter={v => `$${(v/1000).toFixed(1)}k`} />
                  <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} formatter={(v: any) => [`$${v.toLocaleString()}`, "Equity"]} />
                  <Area type="monotone" dataKey="equity" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#eqGrad)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Tabs */}
          <div className="glass-card rounded-2xl overflow-hidden">
            <div className="flex border-b border-border">
              {(["active","closed","stats","journal"] as const).map(t => (
                <button key={t} onClick={() => setTab(t)} className={`flex-1 py-3 text-xs font-semibold capitalize transition-colors ${tab === t ? "text-primary border-b-2 border-primary bg-primary/5" : "text-muted-foreground hover:text-foreground"}`}>{t}</button>
              ))}
            </div>

            {tab === "active" && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-border/50">
                    {["Symbol","Direction","Lots","Open P&L","Opened"].map(h => <th key={h} className="text-left p-3 text-xs text-muted-foreground font-semibold">{h}</th>)}
                  </tr></thead>
                  <tbody>
                    {activeTrades.length === 0 ? (
                      <tr><td colSpan={5} className="text-center py-10 text-muted-foreground text-sm">
                        <Bot className="w-8 h-8 mx-auto mb-2 opacity-30" />
                        {enabled ? "Scanning for opportunities…" : "Enable Auto Trading to start"}
                      </td></tr>
                    ) : activeTrades.map(t => (
                      <tr key={t.id} className="border-b border-border/40 hover:bg-muted/10 transition-colors">
                        <td className="p-3 font-semibold">{t.sym}</td>
                        <td className="p-3"><span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${t.dir === "BUY" ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"}`}>{t.dir}</span></td>
                        <td className="p-3 font-mono text-xs">{t.lots}</td>
                        <td className={`p-3 font-mono font-bold text-sm ${t.pnl >= 0 ? "text-green-400" : "text-red-400"}`}>{t.pnl >= 0 ? "+" : ""}{t.pnl.toFixed(2)}</td>
                        <td className="p-3 text-xs text-muted-foreground">{t.time}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {tab === "closed" && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-border/50">
                    {["Symbol","Direction","Lots","P&L","Closed"].map(h => <th key={h} className="text-left p-3 text-xs text-muted-foreground font-semibold">{h}</th>)}
                  </tr></thead>
                  <tbody>
                    {closedTrades.map(t => (
                      <tr key={t.id} className="border-b border-border/40 hover:bg-muted/10 transition-colors">
                        <td className="p-3 font-semibold">{t.sym}</td>
                        <td className="p-3"><span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${t.dir === "BUY" ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"}`}>{t.dir}</span></td>
                        <td className="p-3 font-mono text-xs">{t.lots}</td>
                        <td className={`p-3 font-mono font-bold text-sm ${t.pnl >= 0 ? "text-green-400" : "text-red-400"}`}>{t.pnl >= 0 ? "+" : ""}{t.pnl.toFixed(2)}</td>
                        <td className="p-3 text-xs text-muted-foreground">{t.time}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {tab === "stats" && (
              <div className="p-5 space-y-5">
                <div>
                  <p className="text-sm font-semibold mb-3">Daily P&L (This Week)</p>
                  <div className="h-40">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={DAILY_STATS}>
                        <XAxis dataKey="day" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                        <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                        <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
                        <Bar dataKey="profit" name="P&L" radius={[4,4,0,0]}>
                          {DAILY_STATS.map((d, i) => <rect key={i} fill={d.profit >= 0 ? "#22c55e" : "#ef4444"} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: "Total Trades", value: closedTrades.length },
                    { label: "Winning Trades", value: closedTrades.filter(t => t.pnl > 0).length },
                    { label: "Losing Trades", value: closedTrades.filter(t => t.pnl < 0).length },
                    { label: "Win Rate", value: `${winRate}%` },
                    { label: "Best Trade", value: `+$${Math.max(...closedTrades.map(t => t.pnl)).toFixed(2)}` },
                    { label: "Worst Trade", value: `$${Math.min(...closedTrades.map(t => t.pnl)).toFixed(2)}` },
                  ].map(({ label, value }) => (
                    <div key={label} className="bg-muted/20 rounded-xl p-3">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</p>
                      <p className="font-bold text-sm mt-0.5">{value}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {tab === "journal" && (
              <div className="p-5 space-y-3">
                {closedTrades.slice(0, 8).map((t, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 bg-muted/20 rounded-xl">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${t.pnl >= 0 ? "bg-green-500/10" : "bg-red-500/10"}`}>
                      {t.pnl >= 0 ? <TrendingUp className="w-4 h-4 text-green-400" /> : <TrendingDown className="w-4 h-4 text-red-400" />}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold">{t.sym} {t.dir}</p>
                        <span className={`text-sm font-bold font-mono ${t.pnl >= 0 ? "text-green-400" : "text-red-400"}`}>{t.pnl >= 0 ? "+" : ""}{t.pnl.toFixed(2)}</span>
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{["Signal strength high, trend continuation","Volume spike confirmed breakout","RSI divergence triggered exit","Moving average crossover entry","Fibonacci retracement level hit","Support zone held, strong bounce"][i % 6]}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{t.time} · {t.lots} lots</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-start gap-2 text-xs text-muted-foreground p-3 bg-muted/20 rounded-xl border border-border">
            <Shield className="w-4 h-4 flex-shrink-0 mt-0.5 text-primary/50" />
            Auto Trading uses live market prices. Past performance does not guarantee future results.
          </div>
        </div>
      </div>
    </div>
  );
}
