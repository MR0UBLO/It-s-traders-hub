import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import {
  Activity, ArrowLeft, ArrowDownRight, ArrowUpRight, Bot, CheckCircle2,
  CircleStop, Clock3, Cpu, Gauge, Radio, RefreshCw, ShieldCheck, Terminal,
  TrendingDown, TrendingUp, Wallet, Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAccountStore } from "@/store/account-store";

type Trade = {
  id: number;
  ticketNumber?: string | null;
  symbol: string;
  direction: string;
  amount: string | number;
  entryPrice: string | number;
  closePrice?: string | number | null;
  currentPrice?: string | number;
  profitLoss?: string | number | null;
  result?: string | null;
  status: string;
  createdAt?: string | Date;
  closedAt?: string | Date | null;
  expiryTime?: string | Date;
  remainingSeconds?: number;
  floatingProfitLoss?: number;
};
type TerminalStatus = {
  enabled: boolean;
  accountType: string;
  budgetId?: number;
  config?: Record<string, any>;
  startedAt?: number | null;
  lastAction?: string;
  lastActionAt?: number | null;
  tradesOpened?: number;
  wins?: number;
  losses?: number;
  wallet?: { balance?: number; totalProfit?: number } | null;
  openTrades?: Trade[];
  closedTrades?: Trade[];
};
type MarketPrice = { symbol: string; bid: number; ask: number; spread?: number; change?: number };

const money = (value: unknown) => {
  const n = Number(value ?? 0);
  return (n < 0 ? "-$" : "$") + Math.abs(Number.isFinite(n) ? n : 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};
const stamp = (value?: string | number | Date | null) => {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleTimeString([], { hour12: false });
};

export default function EATerminal() {
  const { mode } = useAccountStore();
  const account = mode === "demo" ? "demo" : "real";
  const api = import.meta.env.VITE_API_URL;
  const [, setLocation] = useLocation();
  const [status, setStatus] = useState<TerminalStatus | null>(null);
  const [prices, setPrices] = useState<MarketPrice[]>([]);
  const [priceHistory, setPriceHistory] = useState<number[]>([]);
  const [logs, setLogs] = useState<Array<{ id: string; time: string; type: "system" | "trade" | "win" | "loss" | "warn"; text: string }>>([]);
  const [stopping, setStopping] = useState(false);
  const [clock, setClock] = useState(Date.now());
  const logEndRef = useRef<HTMLDivElement>(null);
  const seenEvents = useRef<Set<string>>(new Set());

  const addLog = useCallback((text: string, type: "system" | "trade" | "win" | "loss" | "warn" = "system", key?: string) => {
    const eventKey = key || text;
    if (seenEvents.current.has(eventKey)) return;
    seenEvents.current.add(eventKey);
    setLogs(previous => [...previous, { id: eventKey + "-" + Date.now(), time: new Date().toLocaleTimeString([], { hour12: false }), type, text }].slice(-160));
  }, []);

  const load = useCallback(async () => {
    const token = localStorage.getItem("bp_token") || "";
    try {
      const response = await fetch(api + "/auto-trading/status?account=" + account, { headers: { Authorization: "Bearer " + token } });
      if (!response.ok) {
        addLog("Status API returned HTTP " + response.status, "warn", "status-http-" + response.status);
        return;
      }
      const data: TerminalStatus = await response.json();
      setStatus(data);
      if (data.enabled) {
        addLog("Session connected • " + (data.config?.eaId || "EA") + " • " + account.toUpperCase() + " account", "system", "connected-" + data.startedAt);
      } else {
        addLog("No active EA runtime was reported by the server.", "warn", "inactive-" + data.accountType + "-" + (data.startedAt || "none"));
      }
      if (data.lastAction) addLog(data.lastAction, data.lastAction.toLowerCase().includes("win") ? "win" : data.lastAction.toLowerCase().includes("loss") ? "loss" : data.lastAction.toLowerCase().includes("limit") ? "warn" : "system", "action-" + data.lastActionAt + "-" + data.lastAction);
      const trades = [...(data.openTrades || []), ...(data.closedTrades || [])];
      for (const trade of trades) {
        if (!trade.ticketNumber?.startsWith("AT-")) continue;
        if (trade.status === "open") addLog("OPEN " + trade.direction.toUpperCase() + " " + trade.symbol + " • stake " + money(trade.amount) + " • ticket " + trade.ticketNumber, "trade", "open-" + trade.id);
        if (trade.status === "closed") addLog("CLOSED " + trade.symbol + " • " + (trade.result || "SETTLED") + " • P/L " + money(trade.profitLoss), trade.result === "WIN" ? "win" : "loss", "closed-" + trade.id);
      }
    } catch {
      addLog("Connection interrupted — retaining last confirmed server state.", "warn", "network-" + Math.floor(Date.now() / 15000));
    }

    try {
      const response = await fetch(api + "/market/prices", { headers: { Authorization: "Bearer " + token } });
      if (!response.ok) return;
      const payload = await response.json();
      const list = Array.isArray(payload) ? payload : Array.isArray(payload.prices) ? payload.prices : Array.isArray(payload.data) ? payload.data : [];
      const normalized = list.map((p: any) => ({ symbol: String(p.symbol || p.asset || ""), bid: Number(p.bid), ask: Number(p.ask), spread: Number(p.spread), change: Number(p.change) })).filter((p: MarketPrice) => p.symbol && Number.isFinite(p.bid) && Number.isFinite(p.ask));
      if (normalized.length) {
        setPrices(normalized);
        const focus = normalized.find(p => p.symbol === "EURUSD") || normalized[0];
        setPriceHistory(previous => [...previous, (focus.bid + focus.ask) / 2].slice(-72));
      }
    } catch { /* the terminal remains usable if the price feed briefly disconnects */ }
  }, [account, addLog, api]);

  useEffect(() => {
    addLog("Terminal boot sequence initiated.", "system", "boot");
    addLog("Awaiting authenticated EA session telemetry.", "system", "await-telemetry");
    void load();
    const poll = window.setInterval(() => void load(), 1500);
    const tick = window.setInterval(() => setClock(Date.now()), 1000);
    return () => { window.clearInterval(poll); window.clearInterval(tick); };
  }, [load, addLog]);

  useEffect(() => { logEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [logs.length]);

  const sessionTrades = useMemo(() => {
    const all = [...(status?.openTrades || []), ...(status?.closedTrades || [])];
    const budgetId = status?.budgetId;
    return all.filter(t => budgetId ? t.ticketNumber?.startsWith("AT-" + budgetId + "-") : t.ticketNumber?.startsWith("AT-"));
  }, [status]);
  const closedSessionTrades = sessionTrades.filter(t => t.status === "closed");
  const openSessionTrades = sessionTrades.filter(t => t.status === "open");
  const realizedPL = closedSessionTrades.reduce((sum, t) => sum + Number(t.profitLoss || 0), 0);
  const floatingPL = openSessionTrades.reduce((sum, t) => sum + Number(t.floatingProfitLoss || 0), 0);
  const wins = closedSessionTrades.filter(t => t.result === "WIN").length;
  const losses = closedSessionTrades.filter(t => t.result === "LOSS").length;
  const winRate = closedSessionTrades.length ? (wins / closedSessionTrades.length) * 100 : 0;
  const durationSeconds = Number(status?.config?.sessionDurationSeconds || 300);
  const startedAt = Number(status?.startedAt || 0);
  const remaining = status?.enabled && startedAt ? Math.max(0, Math.ceil((startedAt + durationSeconds * 1000 - clock) / 1000)) : 0;
  const elapsed = startedAt ? Math.max(0, Math.min(durationSeconds, Math.floor((clock - startedAt) / 1000))) : 0;
  const progress = durationSeconds ? Math.min(100, elapsed / durationSeconds * 100) : 0;
  const focusedPrice = prices.find(p => p.symbol === "EURUSD") || prices[0];
  const path = useMemo(() => {
    if (priceHistory.length < 2) return "";
    const min = Math.min(...priceHistory), max = Math.max(...priceHistory);
    const range = max - min || 0.00001;
    return priceHistory.map((v, i) => (i ? "L" : "M") + (i * 760 / Math.max(1, priceHistory.length - 1)).toFixed(1) + " " + (94 - ((v - min) / range) * 78).toFixed(1)).join(" ");
  }, [priceHistory]);

  const stop = async () => {
    setStopping(true);
    addLog("Stop command sent by operator.", "warn", "manual-stop-" + Date.now());
    try {
      const response = await fetch(api + "/auto-trading/stop", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + (localStorage.getItem("bp_token") || "") },
        body: JSON.stringify({ accountType: account }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) addLog("Stop request failed: " + (data.error || response.status), "warn", "stop-fail-" + Date.now());
      else {
        addLog("Server confirmed EA stop. Budget release was requested.", "system", "stop-ok-" + Date.now());
        setStatus(previous => previous ? { ...previous, enabled: false } : previous);
      }
    } catch {
      addLog("Stop request could not reach the server. Verify session state before leaving.", "warn", "stop-network-" + Date.now());
    } finally {
      setStopping(false);
      await load();
    }
  };

  const config = status?.config || {};
  const active = Boolean(status?.enabled);
  const logColor = (type: string) => type === "win" ? "text-emerald-300" : type === "loss" ? "text-rose-300" : type === "trade" ? "text-cyan-200" : type === "warn" ? "text-amber-300" : "text-slate-300";

  return <main className="min-h-screen bg-[#05080d] text-slate-100">
    <div className="pointer-events-none fixed inset-0 opacity-[0.12]" style={{ backgroundImage: "linear-gradient(rgba(56,189,248,.14) 1px, transparent 1px), linear-gradient(90deg, rgba(56,189,248,.14) 1px, transparent 1px)", backgroundSize: "34px 34px" }} />
    <div className="relative mx-auto max-w-[1600px] space-y-4 p-3 sm:p-5 lg:p-7">
      <header className="flex flex-col justify-between gap-4 border-b border-cyan-950 pb-5 xl:flex-row xl:items-center">
        <div className="flex items-start gap-3">
          <div className="rounded-xl border border-cyan-500/30 bg-cyan-500/10 p-3 text-cyan-300"><Terminal className="h-7 w-7"/></div>
          <div><div className="flex flex-wrap items-center gap-2 text-[10px] font-bold uppercase tracking-[.28em] text-cyan-300"><span>TRADOLLAR // EXECUTION CONSOLE</span><span className="rounded border border-slate-700 px-2 py-1 text-slate-400">BUILD 2.6</span></div><h1 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl">Advanced EA Terminal</h1><p className="mt-1 text-xs text-slate-500">Live session telemetry · order lifecycle · account-isolated execution</p></div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-950/80 px-3 py-2 text-xs"><span className={"h-2 w-2 rounded-full " + (active ? "animate-pulse bg-emerald-400" : "bg-amber-400")}/><span className={active ? "text-emerald-300" : "text-amber-300"}>{active ? "ENGINE ONLINE" : "ENGINE IDLE"}</span></div>
          <span className="rounded-lg border border-slate-800 bg-slate-950/80 px-3 py-2 text-xs text-slate-300">{account.toUpperCase()} ACCOUNT</span>
          <Button variant="outline" className="border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800" onClick={() => setLocation("/auto-trading")}><ArrowLeft className="mr-2 h-4 w-4"/>Back to EAs</Button>
        </div>
      </header>

      <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {[
          { label: "Allocated EA budget", value: money(config.investmentAmount), sub: "Dedicated allocation", icon: Wallet, color: "text-cyan-300" },
          { label: "Realized session P/L", value: money(realizedPL), sub: closedSessionTrades.length + " settled trades", icon: realizedPL >= 0 ? TrendingUp : TrendingDown, color: realizedPL >= 0 ? "text-emerald-300" : "text-rose-300" },
          { label: "Floating P/L", value: money(floatingPL), sub: openSessionTrades.length + " open positions", icon: Activity, color: floatingPL >= 0 ? "text-emerald-300" : "text-rose-300" },
          { label: "Win rate", value: closedSessionTrades.length ? winRate.toFixed(1) + "%" : "—", sub: wins + " wins / " + losses + " losses", icon: Gauge, color: "text-violet-300" },
        ].map((item, index) => <motion.div key={item.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * .06 }} className="rounded-xl border border-slate-800 bg-[#0a111b]/95 p-4 shadow-[0_0_28px_rgba(8,145,178,.04)]">
          <div className="flex items-center justify-between gap-2"><span className="text-[10px] font-bold uppercase tracking-[.14em] text-slate-500">{item.label}</span><item.icon className={"h-4 w-4 " + item.color}/></div>
          <div className={"mt-3 text-xl font-black tabular-nums sm:text-2xl " + item.color}>{item.value}</div><p className="mt-1 text-[11px] text-slate-500">{item.sub}</p>
        </motion.div>)}
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.55fr_1fr]">
        <div className="overflow-hidden rounded-xl border border-slate-800 bg-[#080e16]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 px-4 py-3"><div className="flex items-center gap-2"><Activity className="h-4 w-4 text-cyan-300"/><h2 className="text-xs font-bold uppercase tracking-[.18em]">Market telemetry</h2></div><div className="flex items-center gap-2 text-[10px] text-slate-500"><span className="h-2 w-2 animate-pulse rounded-full bg-cyan-400"/>LIVE API FEED</div></div>
          <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3">
            {(prices.length ? prices.slice(0, 6) : [{ symbol: "Waiting for feed", bid: 0, ask: 0 } as MarketPrice]).map(p => <div key={p.symbol} className="rounded-lg border border-slate-800/80 bg-slate-950/70 p-3"><div className="text-[10px] font-bold tracking-widest text-slate-500">{p.symbol}</div><div className="mt-2 text-sm font-bold tabular-nums">{p.bid ? p.bid.toLocaleString("en-US", { maximumFractionDigits: 5 }) : "—"}</div><div className="mt-1 flex items-center justify-between text-[10px]"><span className="text-slate-600">ASK {p.ask ? p.ask.toLocaleString("en-US", { maximumFractionDigits: 5 }) : "—"}</span><span className={Number(p.change || 0) >= 0 ? "text-emerald-400" : "text-rose-400"}>{p.change == null || !Number.isFinite(Number(p.change)) ? "—" : (Number(p.change) > 0 ? "+" : "") + p.change + "%"}</span></div></div>)}
          </div>
          <div className="border-t border-slate-800 px-4 py-3"><div className="mb-2 flex items-center justify-between"><span className="text-[10px] font-bold uppercase tracking-[.16em] text-slate-500">{focusedPrice?.symbol || "Price"} · observed midpoint history</span><span className="font-mono text-[10px] text-cyan-300">{focusedPrice ? ((focusedPrice.bid + focusedPrice.ask) / 2).toFixed(5) : "Waiting for ticks"}</span></div>
            <div className="h-32 w-full overflow-hidden rounded-lg bg-[#060b12]">
              {path ? <svg viewBox="0 0 760 110" preserveAspectRatio="none" className="h-full w-full"><defs><linearGradient id="eaTerminalFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#22d3ee" stopOpacity=".22"/><stop offset="100%" stopColor="#22d3ee" stopOpacity="0"/></linearGradient></defs>{[22,48,74,100].map(y => <line key={y} x1="0" x2="760" y1={y} y2={y} stroke="#1e293b" strokeDasharray="4 5"/>)}<path d={path + " L760 110 L0 110 Z"} fill="url(#eaTerminalFill)"/><path d={path} fill="none" stroke="#22d3ee" strokeWidth="2" vectorEffect="non-scaling-stroke"/></svg> : <div className="flex h-full items-center justify-center gap-2 text-xs text-slate-600"><Radio className="h-4 w-4 animate-pulse"/>Waiting for real price ticks from the API</div>}
            </div><p className="mt-2 text-[10px] text-slate-600">Chart uses sampled server prices received by this terminal. It is not a prediction or a guarantee of the next move.</p>
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-[#080e16]">
          <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3"><div className="flex items-center gap-2"><Clock3 className="h-4 w-4 text-violet-300"/><h2 className="text-xs font-bold uppercase tracking-[.18em]">Session controller</h2></div><span className="font-mono text-[10px] text-slate-500">{active ? "AUTO-MANAGED" : "STANDBY"}</span></div>
          <div className="space-y-5 p-4">
            <div className="flex items-end justify-between gap-3"><div><p className="text-[10px] uppercase tracking-widest text-slate-500">Time remaining</p><p className="mt-1 font-mono text-4xl font-black tracking-tight">{String(Math.floor(remaining / 60)).padStart(2, "0")}:{String(remaining % 60).padStart(2, "0")}</p></div><div className="text-right"><p className="text-[10px] uppercase tracking-widest text-slate-500">Duration</p><p className="mt-1 text-sm font-bold">{Math.round(durationSeconds / 60)} min</p></div></div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-800"><motion.div className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-violet-400" animate={{ width: progress + "%" }} transition={{ duration: .4 }}/></div>
            <div className="grid grid-cols-2 gap-3"><div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3"><p className="text-[10px] uppercase tracking-widest text-slate-500">Trade cadence</p><p className="mt-1 text-sm font-bold text-cyan-200">Every 4 seconds</p></div><div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3"><p className="text-[10px] uppercase tracking-widest text-slate-500">Trade limit</p><p className="mt-1 text-sm font-bold">{status?.tradesOpened || 0} / {config.maxTrades || 0}</p></div></div>
            <div className="grid grid-cols-2 gap-3 text-xs"><div><p className="text-slate-500">Strategy</p><p className="mt-1 font-semibold uppercase">{config.strategy || "—"}</p></div><div><p className="text-slate-500">EA identifier</p><p className="mt-1 font-semibold">{config.eaId || "—"}</p></div><div><p className="text-slate-500">Session started</p><p className="mt-1 font-semibold">{stamp(startedAt || null)}</p></div><div><p className="text-slate-500">Server clock</p><p className="mt-1 font-mono font-semibold">{new Date(clock).toLocaleTimeString([], { hour12: false })}</p></div></div>
            <div className="rounded-lg border border-cyan-950 bg-cyan-950/20 p-3 text-[11px] leading-relaxed text-slate-400"><ShieldCheck className="mr-2 inline h-4 w-4 text-cyan-300"/>The EA can stop earlier when the trade-count, budget, daily-risk or other safety limit is reached. A completed session does not imply profit.</div>
            <Button variant="destructive" disabled={!active || stopping} onClick={() => void stop()} className="w-full"><CircleStop className="mr-2 h-4 w-4"/>{stopping ? "Sending stop command..." : "STOP EA SESSION"}</Button>
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.25fr_1fr]">
        <div className="overflow-hidden rounded-xl border border-slate-800 bg-[#080e16]">
          <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3"><div className="flex items-center gap-2"><Cpu className="h-4 w-4 text-violet-300"/><h2 className="text-xs font-bold uppercase tracking-[.18em]">Execution monitor</h2></div><span className="text-[10px] text-slate-500">{openSessionTrades.length} ACTIVE</span></div>
          <div className="overflow-x-auto"><table className="w-full min-w-[560px] text-left text-xs"><thead className="bg-slate-950/70 text-[10px] uppercase tracking-widest text-slate-500"><tr><th className="px-4 py-3">Market / ticket</th><th className="px-3 py-3">Side</th><th className="px-3 py-3">Stake</th><th className="px-3 py-3">Entry</th><th className="px-3 py-3">Live P/L</th><th className="px-4 py-3">State</th></tr></thead><tbody className="divide-y divide-slate-800/80">{sessionTrades.slice().sort((a,b) => Number(b.id)-Number(a.id)).slice(0,12).map(t => <tr key={t.id} className="hover:bg-slate-900/50"><td className="px-4 py-3"><div className="font-bold">{t.symbol}</div><div className="mt-1 font-mono text-[9px] text-slate-600">{t.ticketNumber || "EA ticket"}</div></td><td className={"px-3 py-3 font-bold " + (t.direction === "buy" ? "text-emerald-300" : "text-rose-300")}>{t.direction?.toUpperCase() === "BUY" ? <ArrowUpRight className="mr-1 inline h-3 w-3"/> : <ArrowDownRight className="mr-1 inline h-3 w-3"/>}{t.direction?.toUpperCase()}</td><td className="px-3 py-3 font-mono">{money(t.amount)}</td><td className="px-3 py-3 font-mono">{Number(t.entryPrice).toLocaleString("en-US", { maximumFractionDigits: 5 })}</td><td className={"px-3 py-3 font-mono " + (Number(t.profitLoss ?? t.floatingProfitLoss ?? 0) >= 0 ? "text-emerald-300" : "text-rose-300")}>{money(t.status === "closed" ? t.profitLoss : t.floatingProfitLoss)}</td><td className="px-4 py-3"><span className={"rounded px-2 py-1 text-[9px] font-bold " + (t.status === "open" ? "bg-cyan-500/10 text-cyan-300" : t.result === "WIN" ? "bg-emerald-500/10 text-emerald-300" : "bg-rose-500/10 text-rose-300")}>{t.status === "open" ? "OPEN " + (t.remainingSeconds ?? "—") + "s" : t.result || "CLOSED"}</span></td></tr>)}{sessionTrades.length === 0 && <tr><td colSpan={6} className="px-4 py-12 text-center text-slate-600"><Zap className="mx-auto mb-2 h-5 w-5"/>Waiting for the first EA ticket reported by the server.</td></tr>}</tbody></table></div>
        </div>
        <div className="flex min-h-[390px] flex-col overflow-hidden rounded-xl border border-slate-800 bg-[#060a10]">
          <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950/70 px-4 py-3"><div className="flex items-center gap-2"><Terminal className="h-4 w-4 text-emerald-300"/><h2 className="text-xs font-bold uppercase tracking-[.18em]">Live execution logs</h2></div><div className="flex items-center gap-2 text-[10px] text-slate-500"><RefreshCw className="h-3 w-3 animate-spin"/> POLLING 1.5S</div></div>
          <div className="flex items-center gap-2 border-b border-slate-900 px-4 py-2 font-mono text-[10px] text-slate-600"><span className="text-emerald-400">●</span> ea-runtime@tradhub <span className="text-slate-800">/</span> session.log <span className="ml-auto">UTF-8</span></div>
          <div className="flex-1 space-y-2 overflow-y-auto p-4 font-mono text-[10px] leading-relaxed sm:text-[11px]">
            {logs.map(log => <div key={log.id} className="flex gap-3"><span className="shrink-0 text-slate-700">[{log.time}]</span><span className={"break-words " + logColor(log.type)}><span className="mr-2 text-slate-700">{log.type === "win" ? "[WIN]" : log.type === "loss" ? "[LOSS]" : log.type === "trade" ? "[ORDER]" : log.type === "warn" ? "[WARN]" : "[INFO]"}</span>{log.text}</span></div>)}
            <div ref={logEndRef} className="flex items-center gap-2 text-emerald-400"><span>›</span><span className="inline-block h-3 w-1.5 animate-pulse bg-emerald-400"/></div>
          </div>
          <div className="flex items-center justify-between border-t border-slate-900 px-4 py-2 text-[9px] text-slate-600"><span>{logs.length} observed events (last 160 retained)</span><span>SERVER-DERIVED TELEMETRY</span></div>
        </div>
      </section>
      <footer className="flex flex-col justify-between gap-2 border-t border-slate-900 py-4 text-[10px] text-slate-600 sm:flex-row"><span>TRADOLLAR EXECUTION CONSOLE · {account.toUpperCase()} MODE</span><span>Displayed statistics are calculated from API-reported trades. They do not predict future outcomes.</span></footer>
    </div>
  </main>;
}
