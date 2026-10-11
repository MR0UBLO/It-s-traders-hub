import { useEffect, useMemo, useState } from "react";
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
  "Eagle Eye FX","Candle Compass","Momentum Forge","Silver Arrow","Aurora Grid","Rapid Pips",
  "Zenith Trader","Market Pulse","Vortex Momentum","Delta Trend","Night Hawk FX","Prime Breakout",
  "Cobalt Swing","Lionheart Gold","Alpha Structure","Orbit Scalper","Summit FX","Marlin Trend",
  "Redwood Trader","Stellar Gold","Precision Pip","Falcon Wave","Equinox Strategy","Pioneer FX",
];
const RISKS = ["Low", "Moderate", "High"] as const;
type EA = { id: string; name: string; strategy: string; strategyLabel: string; asset: string; risk: typeof RISKS[number]; minInvestment: number; description: string };
const EAS: EA[] = Array.from({ length: 120 }, (_, index) => {
  const n = index + 1;
  const strategy = STRATEGIES[(n * 7 + Math.floor(n / 3)) % STRATEGIES.length];
  const asset = "ALL";
  const suffix = n > NAMES.length ? " " + ["Pro", "Prime", "Elite"][Math.floor((n - 1) / NAMES.length) % 3] + " " + Math.ceil(n / NAMES.length) : "";
  return {
    id: "EA-" + String(n).padStart(3, "0"), name: NAMES[(n - 1) % NAMES.length] + suffix,
    strategy: strategy.value, strategyLabel: strategy.label, asset, risk: RISKS[(n * 11) % RISKS.length],
    minInvestment: 10 + (n % 10) * 10,
    description: strategy.label + " strategy scans all supported markets and selects the strongest confirmed signal.",
  };
});

export default function AutoTrading() {
  const { mode } = useAccountStore();
  const isDemo = mode === "demo";
  const account = isDemo ? "demo" : "real";
  const { toast } = useToast();
  const api = import.meta.env.VITE_API_URL;
  const [search, setSearch] = useState("");
  const [selectedEA, setSelectedEA] = useState<EA | null>(null);
  const [amount, setAmount] = useState("10");
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

  const chooseEA = (ea: EA) => { setSelectedEA(ea); setAmount(String(ea.minInvestment)); setPassword(""); setError(null); };

  const startTrading = async () => {
    if (!selectedEA) return;
    if (!localStorage.getItem("bp_token")) { setError("Your login session has expired. Please log in again."); return; }
    const investment = Number(amount);
    if (!Number.isFinite(investment) || investment < selectedEA.minInvestment) { setError("Minimum investment for this EA is $" + selectedEA.minInvestment + "."); return; }
    if (!password.trim()) { setError("Enter the shared EA password to continue."); return; }
    setSubmitting(true);
    try {
      const response = await fetch(api + "/auto-trading/start", {
        method: "POST", headers: authHeaders(),
        body: JSON.stringify({
          accountType: account, eaId: selectedEA.id, eaPassword: password,
          asset: selectedEA.asset, investmentAmount: investment,
          tradeDuration: 4,
          strategy: selectedEA.strategy, aiSpeed: "fast",
          riskPct: selectedEA.risk === "High" ? 4 : selectedEA.risk === "Moderate" ? 2 : 1,
          lotSize: 0.1, dailyTargetPct: 5, dailyLossPct: 3, maxTrades: 5,
          stopLossPips: 30, takeProfitPips: 60, trailingStop: true, breakEven: true,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) { setError(data.error || "The EA could not be started."); return; }
      const name = selectedEA.name;
      setSelectedEA(null); setPassword(""); setEnabled(true);
      await loadStatus();
      toast({ title: name + " started", description: "Running on your " + (isDemo ? "Demo" : "Real") + " wallet. Trading involves risk." });
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
      <div><div className="flex items-center gap-2 text-primary mb-2"><Bot className="h-6 w-6"/><span className="text-xs font-bold uppercase tracking-[0.2em]">Tradollar Automation</span></div><h1 className="text-3xl font-bold tracking-tight">Auto Trading EAs</h1><p className="mt-2 text-sm text-muted-foreground">Choose an Expert Advisor, set your investment, and enter the shared EA password to start.</p></div>
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-border bg-card p-3 min-w-32"><div className="flex items-center gap-2 text-xs text-muted-foreground"><Wallet className="h-4 w-4"/>{isDemo ? "Demo" : "Real"} balance</div><p className="mt-1 text-xl font-bold">{"$"}{Number(wallet?.balance ?? 0).toFixed(2)}</p></div>
        <div className="rounded-xl border border-border bg-card p-3 min-w-32"><div className="flex items-center gap-2 text-xs text-muted-foreground"><Activity className="h-4 w-4"/>Available EAs</div><p className="mt-1 text-xl font-bold">120</p></div>
      </div>
    </div>

    {enabled && <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4 md:p-5">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between"><div><div className="flex items-center gap-2 text-sm font-semibold text-emerald-400"><span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse"/>EA session active</div><h2 className="mt-1 text-lg font-bold">{activeEA?.name || "Auto Trading EA"}</h2><p className="text-sm text-muted-foreground">{status?.config?.asset || "EURUSD"} · Investment {"$"}{Number(status?.config?.investmentAmount ?? 0).toFixed(2)} · {isDemo ? "Demo wallet" : "Real wallet"}</p><p className="mt-1 text-xs text-muted-foreground">{status?.lastAction || "Monitoring market signals"} · {status?.tradesOpened ?? 0} trades opened · {status?.wins ?? 0} wins / {status?.losses ?? 0} losses</p></div><Button variant="destructive" onClick={() => void stopTrading()}><Power className="mr-2 h-4 w-4"/>Stop Trading</Button></div>
      <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3"><div className="rounded-xl bg-background/70 p-3"><p className="text-xs text-muted-foreground">Open trades</p><p className="text-lg font-bold">{openTrades.length}</p></div><div className="rounded-xl bg-background/70 p-3"><p className="text-xs text-muted-foreground">Closed trades</p><p className="text-lg font-bold">{closedTrades.length}</p></div><div className="rounded-xl bg-background/70 p-3"><p className="text-xs text-muted-foreground">Wallet P/L</p><p className="text-lg font-bold">{"$"}{Number(wallet?.totalProfit ?? 0).toFixed(2)}</p></div><div className="rounded-xl bg-background/70 p-3"><p className="text-xs text-muted-foreground">Started</p><p className="text-lg font-bold">{status?.startedAt ? new Date(Number(status.startedAt)).toLocaleTimeString() : "—"}</p></div></div>
    </div>}

    <div className="flex flex-col gap-3 sm:flex-row"><div className="relative flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"/><Input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search EAs by name, ID, strategy or market..." className="pl-9"/></div><div className="flex items-center gap-2 rounded-xl border border-border px-3 text-sm text-muted-foreground"><ShieldCheck className="h-4 w-4 text-primary"/>One shared EA password</div></div>

    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {filtered.map((ea, index) => <motion.div key={ea.id} initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} transition={{delay:Math.min(index % 12,8)*0.025}} className="rounded-2xl border border-border bg-card p-4 flex flex-col gap-4 hover:border-primary/40 transition-colors">
        <div className="flex items-start gap-3"><div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Bot className="h-6 w-6"/></div><div className="min-w-0 flex-1"><h2 className="font-bold leading-tight">{ea.name}</h2><p className="mt-1 text-xs text-muted-foreground">{ea.id} · {ea.strategyLabel}</p></div><span className={"rounded-full px-2 py-1 text-[10px] font-semibold " + (ea.risk === "Low" ? "bg-emerald-500/10 text-emerald-400" : ea.risk === "Moderate" ? "bg-amber-500/10 text-amber-400" : "bg-red-500/10 text-red-400")}>{ea.risk} risk</span></div>
        <p className="text-sm text-muted-foreground">{ea.description}</p><div className="grid grid-cols-2 gap-3 rounded-xl bg-muted/30 p-3"><div><p className="text-[10px] uppercase tracking-wide text-muted-foreground">Market</p><p className="mt-1 text-sm font-semibold">{ea.asset === "ALL" ? "All supported markets" : ea.asset}</p></div><div><p className="text-[10px] uppercase tracking-wide text-muted-foreground">Minimum investment</p><p className="mt-1 text-sm font-semibold">{"$"}{ea.minInvestment.toFixed(2)}</p></div></div>
        <Button className="w-full mt-auto" disabled={enabled} onClick={() => chooseEA(ea)}><Power className="mr-2 h-4 w-4"/>{enabled ? "Stop active EA first" : "Start Trading"}</Button>
      </motion.div>)}
    </div>
    {filtered.length === 0 && <div className="rounded-2xl border border-dashed border-border p-10 text-center text-muted-foreground">No EAs match that search.</div>}
    <div className="flex items-start gap-2 rounded-xl border border-border p-4 text-xs text-muted-foreground"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary"/><p>EAs scan all supported markets every second using shared price ticks and 5s/15s candle confirmation. Trades last 1–4 seconds; weak or conflicting signals are skipped. Signal strength is not a measured win rate or a guarantee of profit.</p></div>

    <AnimatePresence>{selectedEA && <motion.div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} onClick={() => !submitting && setSelectedEA(null)}>
      <motion.div className="w-full max-w-md rounded-2xl border border-zinc-700 bg-zinc-950 p-5 text-white shadow-2xl" initial={{opacity:0,y:12,scale:0.97}} animate={{opacity:1,y:0,scale:1}} exit={{opacity:0,y:12,scale:0.97}} onClick={event => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-widest text-primary">{selectedEA.id}</p><h2 className="mt-1 text-xl font-bold">{selectedEA.name}</h2><p className="mt-1 text-sm text-zinc-400">{selectedEA.strategyLabel} · {selectedEA.asset}</p></div><button aria-label="Close" className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-800 hover:text-white" disabled={submitting} onClick={() => setSelectedEA(null)}><X className="h-4 w-4"/></button></div>
        <div className="mt-4 rounded-xl border border-zinc-800 bg-zinc-900 p-3 text-sm"><div className="flex justify-between"><span className="text-zinc-400">Minimum investment</span><span className="font-bold">{"$"}{selectedEA.minInvestment.toFixed(2)}</span></div><div className="mt-2 flex justify-between"><span className="text-zinc-400">Wallet</span><span className="font-semibold">{isDemo ? "Demo" : "Real"}</span></div></div>
        {error && <div role="alert" className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">{error}</div>}
        <div className="mt-4 space-y-4"><div><Label className="text-zinc-200">Investment amount (USD)</Label><Input autoFocus type="number" min={selectedEA.minInvestment} step="0.01" value={amount} onChange={event => setAmount(event.target.value)} className="mt-1 border-zinc-700 bg-zinc-900 text-white"/><p className="mt-1 text-xs text-zinc-500">Enter at least {"$"}{selectedEA.minInvestment.toFixed(2)}.</p></div><div><Label className="text-zinc-200">Shared EA password</Label><Input type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} placeholder="Enter EA password" className="mt-1 border-zinc-700 bg-zinc-900 text-white"/></div><div className="flex gap-3"><Button variant="outline" className="flex-1" disabled={submitting} onClick={() => setSelectedEA(null)}>Cancel</Button><Button className="flex-1" disabled={submitting} onClick={() => void startTrading()}>{submitting ? "Starting..." : "Confirm & Start"}</Button></div></div>
      </motion.div>
    </motion.div>}</AnimatePresence>
  </div>;
}
