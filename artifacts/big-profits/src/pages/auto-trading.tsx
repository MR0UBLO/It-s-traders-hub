import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bot, Zap, TrendingUp, TrendingDown, BarChart2, Power, AlertTriangle, Shield, RefreshCw, BookOpen, Settings, ChevronDown, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAccountStore } from "@/store/account-store";
import { useGetWallet, useGetOpenTrades, useGetTrades, getGetWalletQueryKey, getGetOpenTradesQueryKey, getGetTradesQueryKey } from "@workspace/api-client-react";
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

/* ─── REAL TRADE DATA ───────────────────────────────────────────── */
function makeEquity(trades: Array<{ profitLoss?: number | null; closedAt?: string | null }>) {
  const closed = [...trades].filter((t) => t.closedAt).sort((a, b) => new Date(a.closedAt!).getTime() - new Date(b.closedAt!).getTime());
  let cumulative = 0;
  const points = closed.slice(-30).map((t, i) => {
    cumulative += Number(t.profitLoss ?? 0);
    return { day: `T${i + 1}`, equity: Number(cumulative.toFixed(2)) };
  });
  return points.length ? points : [{ day: "Start", equity: 0 }];
}

const SYMBOLS = ["EURUSD","XAUUSD","BTCUSD","GBPUSD","NASDAQ","ETHUSD"];
/* ─── MAIN ─────────────────────────────────────────────────────────── */
export default function AutoTrading() {
  const { mode } = useAccountStore();
  const isDemo = mode === "demo";
  const { toast } = useToast();

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
  const [investmentAmount, setInvestmentAmount] = useState("10");
  const [tradeDuration, setTradeDuration] = useState("3600");
  const [asset, setAsset] = useState("EURUSD");
  const [configOpen, setConfigOpen] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scannerPhase, setScannerPhase] = useState<"scanning"|"monitoring">("scanning");
  const [tab, setTab]                 = useState<"active"|"closed"|"journal"|"stats">("active");
  const [stratOpen, setStratOpen]     = useState(false);

  const selectedStrat = STRATEGIES.find(s => s.id === strategy)!;
  const account = isDemo ? "demo" : "real";
  const api = import.meta.env.VITE_API_URL;
  const [serverEnabled, setServerEnabled] = useState(false);
  const [serverAccount, setServerAccount] = useState(account);

  const loadAutoStatus = async () => {
    try {
      const r = await fetch(`${api}/auto-trading/status?account=${account}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token") || ""}` },
      });
      if (!r.ok) return;
      const d = await r.json();
      setServerEnabled(Boolean(d.enabled) && d.accountType === account);
      setServerAccount(d.accountType);
      if (d.config) {
        setStrategy(d.config.strategy);
        setRiskPct(String(d.config.riskPct));
        setPosSize(String(d.config.lotSize));
        setDailyTarget(String(d.config.dailyTargetPct));
        setDailyLoss(String(d.config.dailyLossPct));
        setMaxTrades(String(d.config.maxTrades));
        setSl(String(d.config.stopLossPips));
        setTp(String(d.config.takeProfitPips));
        setTrailing(Boolean(d.config.trailingStop));
        setBreakeven(Boolean(d.config.breakEven));
        if (d.config.investmentAmount !== undefined) setInvestmentAmount(String(d.config.investmentAmount));
        if (d.config.tradeDuration !== undefined) setTradeDuration(String(d.config.tradeDuration));
        if (d.config.asset) setAsset(String(d.config.asset));
      }
    } catch {}
  };

  useEffect(() => {
    void loadAutoStatus();
    const timer = window.setInterval(() => void loadAutoStatus(), 5000);
    return () => window.clearInterval(timer);
  }, [account]);

  const enabled = serverEnabled;
  const authHeaders = { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("token") || ""}` };
  const { data: wallet } = useGetWallet({ account }, { query: { queryKey: getGetWalletQueryKey({ account }), refetchInterval: enabled ? 3000 : 10000 } });
  const { data: openTrades = [] } = useGetOpenTrades({ account }, { query: { queryKey: getGetOpenTradesQueryKey({ account }), refetchInterval: enabled ? 2000 : 5000 } });
  const { data: allTrades = [] } = useGetTrades({ account }, { query: { queryKey: getGetTradesQueryKey({ account }), refetchInterval: enabled ? 5000 : 10000 } });
  const activeTrades = openTrades.map((t) => ({ ...t, sym: t.symbol, dir: t.direction.toUpperCase(), lots: Number(t.lotSize ?? 0), pnl: Number(t.profitLoss ?? 0), time: new Date(t.createdAt).toLocaleTimeString("en-KE", { hour: "2-digit", minute: "2-digit" }) }));
  const closedTrades = allTrades.filter((t) => t.status === "closed").map((t) => ({ ...t, sym: t.symbol, dir: t.direction.toUpperCase(), lots: Number(t.lotSize ?? 0), pnl: Number(t.profitLoss ?? 0), time: t.closedAt ? new Date(t.closedAt).toLocaleString("en-KE", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : new Date(t.createdAt).toLocaleString("en-KE") }));
  const totalPnL = activeTrades.reduce((sum, t) => sum + t.pnl, 0);
  const todayPnL = closedTrades.filter((t) => t.closedAt && new Date(t.closedAt).toDateString() === new Date().toDateString()).reduce((sum, t) => sum + t.pnl, 0);
  const winRate = closedTrades.length ? Math.round(closedTrades.filter((t) => t.pnl > 0).length / closedTrades.length * 100) : 0;
  const totalProfit = closedTrades.reduce((sum, t) => sum + t.pnl, 0);
  const equity = useMemo(() => makeEquity(closedTrades), [closedTrades]);


  const handleToggle = async () => {
    if (enabled) {
      const r = await fetch(`${api}/auto-trading/stop`, {
        method: "POST", headers: authHeaders,
        body: JSON.stringify({ accountType: account }),
      });
      const d = await r.json();
      if (!r.ok) {
        toast({ title: "Unable to stop Auto Trading", description: d.error || "Please try again.", variant: "destructive" });
        return;
      }
      setServerEnabled(false);
      setScannerOpen(false);
      toast({ title: "Auto Trading stopped", description: "Existing open positions remain recorded and can settle normally." });
      return;
    }
    setConfigOpen(true);
  };

  const startConfiguredTrading = async () => {
    const amount = Number(investmentAmount);
    const duration = Number(tradeDuration);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast({ title: "Enter a valid investment amount", description: "The stake must be greater than zero.", variant: "destructive" });
      return;
    }
    if (!Number.isFinite(duration) || duration < 60) {
      toast({ title: "Enter a valid trade duration", description: "Trade duration must be at least 1 minute.", variant: "destructive" });
      return;
    }
    setConfigOpen(false);
    setScannerPhase("scanning");
    setScannerOpen(true);
    const r = await fetch(`${api}/auto-trading/start`, {
      method: "POST", headers: authHeaders,
      body: JSON.stringify({
        accountType: account,
        strategy,
        investmentAmount: amount,
        tradeDuration: duration,
        asset,
        riskPct: Number(riskPct),
        lotSize: Number(posSize),
        dailyTargetPct: Number(dailyTarget),
        dailyLossPct: Number(dailyLoss),
        maxTrades: Number(maxTrades),
        stopLossPips: Number(sl),
        takeProfitPips: Number(tp),
        trailingStop: trailing,
        breakEven: breakeven,
      }),
    });
    const d = await r.json();
    if (!r.ok) {
      setScannerOpen(false);
      toast({ title: "Auto Trading could not start", description: d.error || "The selected wallet has insufficient balance.", variant: "destructive" });
      return;
    }
    setServerEnabled(true);
    setEmergency(false);
    setScannerPhase("scanning");
    window.setTimeout(() => setScannerPhase("monitoring"), 2200);
    toast({ title: "AI Trading started", description: `${selectedStrat.label} is scanning ${asset} opportunities using the ${account === "demo" ? "Demo" : "Real"} wallet.` });
    await loadAutoStatus();
  };

  const handleEmergency = async () => {
    await fetch(`${api}/auto-trading/stop`, {
      method: "POST", headers: authHeaders,
      body: JSON.stringify({ accountType: account }),
    });
    setEmergency(true);
    setServerEnabled(false);
    toast({ title: "Emergency Stop activated", description: "New auto trades are halted immediately. Existing positions remain open.", variant: "destructive" });
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

      <AnimatePresence>
        {configOpen && !enabled && (
          <motion.div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className="w-full max-w-md glass-card rounded-2xl p-6 shadow-2xl border border-border" initial={{ scale: 0.96, y: 12 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, y: 12 }}>
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center"><Bot className="w-5 h-5 text-primary" /></div>
                <div><h2 className="text-lg font-bold">Start AI Trading</h2><p className="text-xs text-muted-foreground">Set the parameters the AI will use for each trade.</p></div>
              </div>
              <div className="space-y-4">
                <div className="space-y-1.5"><Label className="text-xs text-muted-foreground uppercase tracking-wider">Asset</Label>
                  <select value={asset} onChange={e => setAsset(e.target.value)} className="w-full h-10 rounded-xl bg-background border border-border px-3 text-sm">
                    {SYMBOLS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5"><Label className="text-xs text-muted-foreground uppercase tracking-wider">Stake (USD)</Label><Input type="number" min="1" step="1" value={investmentAmount} onChange={e => setInvestmentAmount(e.target.value)} /></div>
                  <div className="space-y-1.5"><Label className="text-xs text-muted-foreground uppercase tracking-wider">Duration</Label>
                    <select value={tradeDuration} onChange={e => setTradeDuration(e.target.value)} className="w-full h-10 rounded-xl bg-background border border-border px-3 text-sm">
                      <option value="60">1 minute</option><option value="300">5 minutes</option><option value="600">10 minutes</option><option value="900">15 minutes</option><option value="1800">30 minutes</option><option value="3600">1 hour</option><option value="7200">2 hours</option><option value="14400">4 hours</option>
                    </select>
                  </div>
                </div>
                <div className="rounded-xl bg-muted/20 p-3 text-xs text-muted-foreground"><div className="flex justify-between"><span>Account</span><span className="font-semibold text-foreground">{isDemo ? "Demo" : "Real"}</span></div><div className="flex justify-between mt-1"><span>Strategy</span><span className="font-semibold text-foreground">{selectedStrat.label}</span></div><div className="flex justify-between mt-1"><span>AI target</span><span className="font-semibold text-primary">90% signal target</span></div></div>
                <div className="flex gap-3 pt-1"><Button variant="outline" className="flex-1" onClick={() => setConfigOpen(false)}>Cancel</Button><Button className="flex-1" onClick={() => void startConfiguredTrading()}><Power className="w-4 h-4 mr-2" />Start AI Trading</Button></div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {scannerOpen && (
          <motion.div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className="w-full max-w-sm glass-card rounded-2xl p-6 text-center border border-primary/20 shadow-2xl">
              <div className="mx-auto w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mb-4">{scannerPhase === "scanning" ? <Search className="w-7 h-7 text-primary animate-pulse" /> : <Bot className="w-7 h-7 text-primary" />}</div>
              <h2 className="text-lg font-bold">{scannerPhase === "scanning" ? "AI is scanning the markets" : "AI is monitoring the market"}</h2>
              <p className="text-sm text-muted-foreground mt-2">{scannerPhase === "scanning" ? `Checking ${asset} for a qualifying opportunity...` : `Waiting for a qualifying ${asset} signal before opening the next trade.`}</p>
              <div className="mt-5 space-y-2 text-left">
                <div className="flex items-center justify-between text-xs"><span>Asset</span><span className="font-mono font-semibold">{asset}</span></div>
                <div className="flex items-center justify-between text-xs"><span>Stake</span><span className="font-mono font-semibold">${Number(investmentAmount).toFixed(2)}</span></div>
                <div className="flex items-center justify-between text-xs"><span>Duration</span><span className="font-mono font-semibold">{Math.round(Number(tradeDuration)/60)} min</span></div>
                <div className="flex items-center justify-between text-xs"><span>Signal target</span><span className="font-mono font-semibold text-primary">90%</span></div>
              </div>
              <Button variant="outline" className="w-full mt-5" onClick={() => setScannerOpen(false)}>Close</Button>
            </motion.div>
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

            {/* Investment amount */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider">Investment Per Trade (USD)</Label>
              <Input type="number" value={investmentAmount} onChange={e => setInvestmentAmount(e.target.value)} min="1" step="1" className="h-9 bg-background border-border font-mono text-sm" disabled={enabled} />
              <p className="text-[10px] text-muted-foreground">Each auto trade uses this amount from the selected {isDemo ? "Demo" : "Real"} wallet.</p>
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
