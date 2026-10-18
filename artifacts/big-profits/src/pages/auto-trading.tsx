import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Bot, Power, Search, Wallet, ShieldCheck, Activity, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAccountStore } from "@/store/account-store";
import { useGetWallet, getGetWalletQueryKey } from "@workspace/api-client-react";

const STRATEGIES = [
  { label: "Trend Following", value: "trend" }, { label: "Fast Scalping", value: "scalp" },
  { label: "Swing Trader", value: "swing" }, { label: "Breakout Hunter", value: "breakout" },
  { label: "Grid Navigator", value: "grid" }, { label: "Smart Money", value: "smc" },
] as const;
const NAMES = [
  "Atlas Trend Rider","Gold Falcon","Pip Navigator","Quantum Scalper","London Breakout",
  "New York Momentum","Smart Money Flow","Orion Swing","Phoenix Reversal","Bullion Hunter",
  "Velocity FX","Apex Trend","Blue Wave Trader","Steady Pip","Nova Breakout","Titan Scalper",
  "Eagle Eye FX","Candle Compass","Momentum Forge","Silver Arrow","Aurora Grid","Rapid Pips","Pip Mover","Pip Mover Elite 3",
  "Zenith Trader","Market Pulse","Vortex Momentum","Delta Trend","Night Hawk FX","Prime Breakout",
  "Cobalt Swing","Lionheart Gold","Alpha Structure","Orbit Scalper","Summit FX","Marlin Trend",
  "Redwood Trader","Stellar Gold","Precision Pip","Falcon Wave","Equinox Strategy","Pioneer FX",
];
const RISKS = ["Low", "Moderate", "High"] as const;
type EA = { id: string; name: string; strategy: string; strategyLabel: string; asset: string; risk: typeof RISKS[number]; minInvestment: number; description: string };
const EAS: EA[] = Array.from({ length: 120 }, (_, index) => {
  const n = index + 1;
  const name = n === 1 ? "Fortunex Ai" : n === 2 ? "Fortunex Ai premium" : n === 3 ? "Fortunex Ai elite" : NAMES[(n - 1) % NAMES.length];
  const suffix = n > NAMES.length ? " " + ["Pro", "Prime", "Elite"][Math.floor((n - 1) / NAMES.length) % 3] + " " + Math.ceil(n / NAMES.length) : "";
  const isPipMover = name.toLowerCase().startsWith("pip mover");
  // Route every Pip Mover-branded EA through the existing Smart Money strategy
  // implementation; the backend receives this selected strategy when the EA starts.
  const strategy = isPipMover
    ? STRATEGIES.find((item) => item.value === "smc")!
    : STRATEGIES[(n * 7 + Math.floor(n / 3)) % STRATEGIES.length];
  const asset = "ALL";
  return {
    id: "EA-" + String(n).padStart(3, "0"), name: name + suffix,
    strategy: strategy.value, strategyLabel: strategy.label, asset, risk: RISKS[(n * 11) % RISKS.length],
    minInvestment: n === 1 ? 10 : n === 2 ? 50 : n === 3 ? 100 : 10 + (n % 10) * 10,
    description: strategy.label + " strategy scans all supported markets and selects the strongest confirmed signal.",
  };
});

export default function AutoTrading() {
  const [, setLocation] = useLocation();
  const { mode } = useAccountStore();
  const isDemo = mode === "demo";
  const account = isDemo ? "demo" : "real";
  const { toast } = useToast();
  const api = import.meta.env.VITE_API_URL;
  const [search, setSearch] = useState("");
  const [selectedEA, setSelectedEA] = useState<EA | null>(null);
  const [amount, setAmount] = useState("10");
  const [tradeCount, setTradeCount] = useState("5");
  const [durationMinutes, setDurationMinutes] = useState(5);
  const [tradeDurationSeconds, setTradeDurationSeconds] = useState(5);
  const [aiSpeed, setAiSpeed] = useState<"fast" | "slow">("fast");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [status, setStatus] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const authHeaders = () => ({ "Content-Type": "application/json", Authorization: "Bearer " + (localStorage.getItem("bp_token") || "") });
  const { data: wallet } = useGetWallet({ account }, { query: { queryKey: getGetWalletQueryKey({ account }), refetchInterval: enabled ? 2000 : 10000 } });

  const loadStatus = async () => {
    try {
      const response = await fetch(api + "/auto-trading/status?account=" + account, { headers: { Authorization: "Bearer " + (localStorage.getItem("bp_token") || "") } });
      if (!response.ok) return;
      const data = await response.json();
      setStatus(data);
      setEnabled(Boolean(data.enabled) && data.accountType === account);
    } catch { /* retain the last known status on network errors */ }
  };
  useEffect(() => {
    void loadStatus();
    const timer = window.setInterval(() => void loadStatus(), enabled ? 1500 : 5000);
    return () => window.clearInterval(timer);
  }, [account, enabled]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? EAS.filter(ea => [ea.id, ea.name, ea.strategyLabel, ea.asset, ea.risk].some(v => v.toLowerCase().includes(q))) : EAS;
  }, [search]);

  const chooseEA = (ea: EA) => { setSelectedEA(ea); setAmount(String(ea.minInvestment)); setTradeCount("5"); setDurationMinutes(5); setTradeDurationSeconds(5); setAiSpeed("fast"); setPassword(""); setError(null); };

  const startTrading = async () => {
    if (!selectedEA) return;
    if (!localStorage.getItem("bp_token")) { setError("Your login session has expired. Please log in again."); return; }
    const investment = Number(amount);
    if (!Number.isFinite(investment) || investment < selectedEA.minInvestment) { setError("Minimum investment for this EA is $" + selectedEA.minInvestment + "."); return; }
    const tradesToOpen = Number(tradeCount);
    if (!Number.isInteger(tradesToOpen) || tradesToOpen < 1 || tradesToOpen > 100) { setError("Choose a whole number of trades between 1 and 100."); return; }
    if (investment / tradesToOpen < 1) { setError("Your budget must allocate at least $1 per trade. Reduce the trade count or increase the budget."); return; }
    if (!password.trim()) { setError("Enter the shared EA password to continue."); return; }
    setSubmitting(true);
    try {
      const response = await fetch(api + "/auto-trading/start", {
        method: "POST", headers: authHeaders(),
        body: JSON.stringify({
          accountType: account, eaId: selectedEA.id, eaPassword: password,
          asset: selectedEA.asset, investmentAmount: investment,
          tradeDuration: tradeDurationSeconds, sessionDurationSeconds: durationMinutes * 60,
          strategy: selectedEA.strategy, aiSpeed,
          riskPct: selectedEA.risk === "High" ? 4 : selectedEA.risk === "Moderate" ? 2 : 1,
          lotSize: 0.1, dailyTargetPct: 5, dailyLossPct: 3, maxTrades: tradesToOpen,
          stopLossPips: 30, takeProfitPips: 60, trailingStop: true, breakEven: true,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) { setError(data.error || "The EA could not be started."); return; }
      const name = selectedEA.name;
      setSelectedEA(null); setPassword(""); setEnabled(true);
      await loadStatus();
      toast({ title: name + " started", description: "Opening the live execution terminal." });
      setLocation("/ea-terminal");
    } catch { setError("Unable to connect to the trading server. Please try again."); }
    finally { setSubmitting(false); }
  };

  const stopTrading = async () => {
    try {
      const response = await fetch(api + "/auto-trading/stop", { method: "POST", headers: authHeaders(), body: JSON.stringify({ accountType: account }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) { toast({ title: "Unable to stop EA", description: data.error || "Please try again.", variant: "destructive" }); return; }
      setEnabled(false); await loadStatus(); toast({ title: "EA stopped", description: "Auto Trading has been stopped." });
    } catch { toast({ title: "Unable to stop EA", description: "Check your connection and try again.", variant: "destructive" }); }
  };

  const activeEA = EAS.find(ea => ea.id === status?.config?.eaId);
  const openTrades = Array.isArray(status?.openTrades) ? status.openTrades : [];
  const closedTrades = Array.isArray(status?.closedTrades) ? status.closedTrades : [];

  return <div className="mx-auto max-w-7xl p-4 md:p-6 space-y-6">
    <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div><div className="flex items-center gap-2 text-primary mb-2"><Bot className="h-6 w-6"/><span className="text-xs font-bold uppercase tracking-[0.2em]">Tradollar Automation</span></div><h1 className="text-3xl font-bold tracking-tight">Auto Trading EAs</h1><p className="mt-2 text-sm text-muted-foreground">Choose an Expert Advisor, allocate a separate EA budget, choose the trade count, and enter the shared EA password.</p></div>
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-border bg-card p-3 min-w-32"><div className="flex items-center gap-2 text-xs text-muted-foreground"><Wallet className="h-4 w-4"/>{isDemo ? "Demo" : "Real"} balance</div><p className="mt-1 text-xl font-bold">{"$"}{Number(wallet?.balance ?? 0).toFixed(2)}</p></div>
        <div className="rounded-xl border border-border bg-card p-3 min-w-32"><div className="flex items-center gap-2 text-xs text-muted-foreground"><Activity className="h-4 w-4"/>Available EAs</div><p className="mt-1 text-xl font-bold">120</p></div>
      </div>
    </div>

    {enabled && <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4 md:p-5">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between"><div><div className="flex items-center gap-2 text-sm font-semibold text-emerald-400"><span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse"/>EA session active</div><h2 className="mt-1 text-lg font-bold">{activeEA?.name || "Auto Trading EA"}</h2><p className="text-sm text-muted-foreground">{status?.config?.asset || "EURUSD"} · EA budget {"$"}{Number(status?.config?.investmentAmount ?? 0).toFixed(2)} · {status?.tradesOpened ?? 0}/{status?.config?.maxTrades ?? 0} trades · {isDemo ? "Demo wallet" : "Real wallet"}</p><p className="mt-1 text-xs text-muted-foreground">{status?.lastAction || "Monitoring market signals"} · {status?.tradesOpened ?? 0} trades opened · {status?.wins ?? 0} wins / {status?.losses ?? 0} losses</p><p className="mt-1 text-xs text-muted-foreground">Session time remaining: {Math.floor(Math.max(0, Number(status?.startedAt ?? 0) + Number(status?.config?.sessionDurationSeconds ?? 0) * 1000 - Date.now()) / 60000)}m {Math.floor((Math.max(0, Number(status?.startedAt ?? 0) + Number(status?.config?.sessionDurationSeconds ?? 0) * 1000 - Date.now()) % 60000) / 1000)}s · {status?.config?.aiSpeed === "slow" ? "entries every 10 seconds" : "entries every 5 seconds"} · {status?.config?.tradeDuration ?? 5}s per trade</p></div><Button variant="destructive" onClick={() => void stopTrading()}><Power className="mr-2 h-4 w-4"/>Stop Trading</Button></div>
      <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3"><div className="rounded-xl bg-background/70 p-3"><p className="text-xs text-muted-foreground">Open trades</p><p className="text-lg font-bold">{openTrades.length}</p></div><div className="rounded-xl bg-background/70 p-3"><p className="text-xs text-muted-foreground">Closed trades</p><p className="text-lg font-bold">{closedTrades.length}</p></div><div className="rounded-xl bg-background/70 p-3"><p className="text-xs text-muted-foreground">Wallet P/L</p><p className="text-lg font-bold">{"$"}{Number(wallet?.totalProfit ?? 0).toFixed(2)}</p></div><div className="rounded-xl bg-background/70 p-3"><p className="text-xs text-muted-foreground">Started</p><p className="text-lg font-bold">{status?.startedAt ? new Date(Number(status.startedAt)).toLocaleTimeString() : "—"}</p></div></div>
    </div>}

    <div className="flex flex-col gap-3 sm:flex-row"><div className="relative flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"/><Input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search EAs by name, ID, strategy or market..." className="pl-9"/></div><div className="flex flex-col justify-center gap-1 rounded-xl border border-border px-3 py-2 text-sm text-muted-foreground"><div className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-primary"/>One shared EA password</div><p className="text-xs">Win rates must reflect completed trades; no EA can guarantee 100% wins.</p></div></div>

    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {filtered.map((ea, index) => <motion.div key={ea.id} initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} transition={{delay:Math.min(index % 12,8)*0.025}} className="rounded-2xl border border-border bg-card p-4 flex flex-col gap-4 hover:border-primary/40 transition-colors">
        <div className="flex items-start gap-3"><div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Bot className="h-6 w-6"/></div><div className="min-w-0 flex-1"><h2 className="font-bold leading-tight">{ea.name}</h2><p className="mt-1 text-xs text-muted-foreground">{ea.id} · {ea.strategyLabel}</p></div><span className={"rounded-full px-2 py-1 text-[10px] font-semibold " + (ea.risk === "Low" ? "bg-emerald-500/10 text-emerald-400" : ea.risk === "Moderate" ? "bg-amber-500/10 text-amber-400" : "bg-red-500/10 text-red-400")}>{ea.risk} risk</span></div>
        <p className="text-sm text-muted-foreground">{ea.description}</p><div className="grid grid-cols-2 gap-3 rounded-xl bg-muted/30 p-3"><div><p className="text-[10px] uppercase tracking-wide text-muted-foreground">Market</p><p className="mt-1 text-sm font-semibold">{ea.asset === "ALL" ? "All supported markets" : ea.asset}</p></div><div><p className="text-[10px] uppercase tracking-wide text-muted-foreground">Minimum investment</p><p className="mt-1 text-sm font-semibold">{"$"}{ea.minInvestment.toFixed(2)}</p></div></div>
        <Button className="w-full mt-auto" disabled={enabled} onClick={() => chooseEA(ea)}><Power className="mr-2 h-4 w-4"/>{enabled ? "Stop active EA first" : "Start Trading"}</Button>
      </motion.div>)}
    </div>
    {filtered.length === 0 && <div className="rounded-2xl border border-dashed border-border p-10 text-center text-muted-foreground">No EAs match that search.</div>}
    <div className="flex items-start gap-2 rounded-xl border border-border p-4 text-xs text-muted-foreground"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary"/><p>EAs evaluate supported market prices and only open trades when the selected strategy confirms a setup. Fast mode spaces entries by at least 5 seconds; slow mode by at least 10 seconds. Each trade lasts for your selected 5–60 seconds. Results are not guaranteed, and trade-count or safety limits can stop a session earlier.</p></div>

    {createPortal(<AnimatePresence>{selectedEA && <motion.div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto overscroll-contain bg-black/80 p-3 backdrop-blur-sm sm:items-center sm:p-4" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} onClick={() => !submitting && setSelectedEA(null)}>
      <motion.div className="my-2 max-h-[calc(100dvh-1.5rem)] w-full max-w-md overflow-y-auto overscroll-contain rounded-2xl border border-zinc-700 bg-zinc-950 p-4 text-white shadow-2xl sm:my-4 sm:max-h-[calc(100dvh-2rem)] sm:p-5" initial={{opacity:0,y:12,scale:0.97}} animate={{opacity:1,y:0,scale:1}} exit={{opacity:0,y:12,scale:0.97}} onClick={event => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-widest text-primary">{selectedEA.id}</p><h2 className="mt-1 text-xl font-bold">{selectedEA.name}</h2><p className="mt-1 text-sm text-zinc-400">{selectedEA.strategyLabel} · {selectedEA.asset}</p></div><button aria-label="Close" className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-800 hover:text-white" disabled={submitting} onClick={() => setSelectedEA(null)}><X className="h-4 w-4"/></button></div>
        <div className="mt-4 rounded-xl border border-zinc-800 bg-zinc-900 p-3 text-sm"><div className="flex justify-between"><span className="text-zinc-400">Minimum investment</span><span className="font-bold">{"$"}{selectedEA.minInvestment.toFixed(2)}</span></div><div className="mt-2 flex justify-between"><span className="text-zinc-400">Wallet</span><span className="font-semibold">{isDemo ? "Demo" : "Real"}</span></div></div>
        {error && <div role="alert" className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">{error}</div>}
        <div className="mt-4 space-y-4"><div><Label className="text-zinc-200">Total EA budget (USD)</Label><Input autoFocus type="number" min={selectedEA.minInvestment} step="0.01" value={amount} onChange={event => setAmount(event.target.value)} className="mt-1 border-zinc-700 bg-zinc-900 text-white"/><p className="mt-1 text-xs text-zinc-500">This is the total amount set aside for this EA, not the stake for every trade. Minimum {"$"}{selectedEA.minInvestment.toFixed(2)}.</p></div><div><Label className="text-zinc-200">How many trades?</Label><Input type="number" min="1" max={Math.max(1, Math.min(100, Math.floor(Number(amount) || 1)))} step="1" value={tradeCount} onChange={event => setTradeCount(event.target.value)} className="mt-1 border-zinc-700 bg-zinc-900 text-white"/><p className="mt-1 text-xs text-zinc-500">Approx. stake per trade: {"$"}{Number(amount) > 0 && Number(tradeCount) > 0 ? (Math.floor((Number(amount) / Number(tradeCount)) * 100) / 100).toFixed(2) : "0.00"}. At least $1 per trade. The trade-count limit still applies.</p></div><div><div className="flex items-center justify-between gap-3"><Label htmlFor="ea-trade-duration" className="text-zinc-200">Duration of each trade</Label><span className="text-sm font-bold text-primary">{tradeDurationSeconds} seconds</span></div><input id="ea-trade-duration" type="range" min="5" max="60" step="5" value={tradeDurationSeconds} onChange={event => setTradeDurationSeconds(Math.max(5, Number(event.target.value)))} className="mt-3 w-full cursor-pointer accent-primary" aria-label="Individual EA trade duration in seconds"/><div className="flex justify-between text-xs text-zinc-500"><span>5 sec</span><span>30 sec</span><span>60 sec</span></div><p className="mt-1 text-xs text-zinc-500">Every individual trade stays open for 5–60 seconds unless a stop-loss or take-profit closes it earlier.</p></div><div><Label className="text-zinc-200">AI speed</Label><select value={aiSpeed} onChange={event => setAiSpeed(event.target.value === "slow" ? "slow" : "fast")} className="mt-1 h-10 w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 text-sm text-white"><option value="fast">Fast — entries at least every 5 seconds</option><option value="slow">Slow — entries at least every 10 seconds</option></select><p className="mt-1 text-xs text-zinc-500">Speed changes the minimum interval between entries; it does not guarantee more wins.</p></div><div><div className="flex items-center justify-between gap-3"><Label htmlFor="ea-session-duration" className="text-zinc-200">How long should the EA run?</Label><span className="text-sm font-bold text-primary">{durationMinutes} {durationMinutes === 1 ? "minute" : "minutes"}</span></div><input id="ea-session-duration" type="range" min="1" max="60" step="1" value={durationMinutes} onChange={event => setDurationMinutes(Number(event.target.value))} className="mt-3 w-full cursor-pointer accent-primary" aria-label="EA trading session duration in minutes"/><div className="flex justify-between text-xs text-zinc-500"><span>1 min</span><span>30 min</span><span>60 min</span></div><p className="mt-1 text-xs text-zinc-500">The session timer controls how long the EA may look for entries. Fast mode checks entry eligibility every 5 seconds; slow mode every 10 seconds. Individual trade duration is controlled separately above.</p></div><div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-100">Only this budget is reserved and exposed to EA trades. Your remaining wallet funds are not available to the EA. Any unused budget and the remaining balance are returned when you stop the EA.</div><div><Label className="text-zinc-200">Shared EA password</Label><Input type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} placeholder="Enter EA password" className="mt-1 border-zinc-700 bg-zinc-900 text-white"/></div><div className="flex gap-3"><Button variant="outline" className="flex-1" disabled={submitting} onClick={() => setSelectedEA(null)}>Cancel</Button><Button className="flex-1" disabled={submitting} onClick={() => void startTrading()}>{submitting ? "Starting..." : "Confirm & Start"}</Button></div></div>
      </motion.div>
    </motion.div>}</AnimatePresence>, document.body)}
  </div>;
}
