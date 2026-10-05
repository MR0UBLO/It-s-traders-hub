import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bot, Zap, TrendingUp, TrendingDown, BarChart2, Power, AlertTriangle, Shield, RefreshCw, BookOpen, Settings, ChevronDown } from "lucide-react";
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
  const [investmentAmount, setInvestmentAmount] = useState("10");
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
      toast({ title: "Auto Trading stopped", description: "Existing open positions remain recorded and can settle normally." });
      return;
    }

    const r = await fetch(`${api}/auto-trading/start`, {
      method: "POST", headers: authHeaders,
      body: JSON.stringify({
        accountType: account,
        strategy,
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
      toast({ title: "Auto Trading could not start", description: d.error || "The selected wallet has insufficient balance.", variant: "destructive" });
      return;
    }
    setServerEnabled(true);
    setEmergency(false);
    toast({ title: "Auto Trading activated", description: `${selectedStrat.label} is now running against the ${account === "demo" ? "Demo" : "Real"} wallet.` });
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
