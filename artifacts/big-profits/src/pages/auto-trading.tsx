import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bot, Power, Search, Wallet, Clock3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAccountStore } from "@/store/account-store";
import { useGetWallet, getGetWalletQueryKey } from "@workspace/api-client-react";

const SYMBOLS = ["EURUSD", "XAUUSD", "BTCUSD", "GBPUSD", "NASDAQ", "ETHUSD"];

export default function AutoTrading() {
  const { mode } = useAccountStore();
  const isDemo = mode === "demo";
  const account = isDemo ? "demo" : "real";
  const { toast } = useToast();
  const api = import.meta.env.VITE_API_URL;

  const [enabled, setEnabled] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [phase, setPhase] = useState<"scanning" | "monitoring">("scanning");
  const [asset, setAsset] = useState("EURUSD");
  const [investmentAmount, setInvestmentAmount] = useState("10");
  const [tradeDuration, setTradeDuration] = useState("3600");
  const [strategy, setStrategy] = useState("trend");
  const [speed, setSpeed] = useState("fast");

  const authHeaders = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${localStorage.getItem("token") || ""}`,
  };

  const { data: wallet } = useGetWallet(
    { account },
    { query: { queryKey: getGetWalletQueryKey({ account }), refetchInterval: enabled ? 3000 : 10000 } }
  );

  const loadStatus = async () => {
    try {
      const r = await fetch(`${api}/auto-trading/status?account=${account}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token") || ""}` },
      });
      if (!r.ok) return;
      const d = await r.json();
      setEnabled(Boolean(d.enabled) && d.accountType === account);
      if (d.config) {
        if (d.config.asset) setAsset(String(d.config.asset));
        if (d.config.investmentAmount !== undefined) setInvestmentAmount(String(d.config.investmentAmount));
        if (d.config.tradeDuration !== undefined) setTradeDuration(String(d.config.tradeDuration));
        if (d.config.strategy) setStrategy(String(d.config.strategy));
      }
    } catch {}
  };

  useEffect(() => {
    void loadStatus();
    const timer = window.setInterval(() => void loadStatus(), 5000);
    return () => window.clearInterval(timer);
  }, [account]);

  const stopTrading = async () => {
    const r = await fetch(`${api}/auto-trading/stop`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ accountType: account }),
    });
    const d = await r.json();
    if (!r.ok) {
      toast({ title: "Unable to stop AI Trading", description: d.error || "Please try again.", variant: "destructive" });
      return;
    }
    setEnabled(false);
    setScannerOpen(false);
    toast({ title: "AI Trading stopped" });
  };

  const startTrading = async () => {
    const token = localStorage.getItem("token");
    if (!token) {
      window.location.href = "/login";
      return;
    }

    const amount = Number(investmentAmount);
    const duration = Number(tradeDuration);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast({ title: "Invalid stake", description: "Enter an investment amount greater than zero.", variant: "destructive" });
      return;
    }
    if (!Number.isFinite(duration) || duration < 5) {
      toast({ title: "Invalid duration", description: "Trade duration must be at least 5 seconds.", variant: "destructive" });
      return;
    }

    setConfigOpen(false);
    setPhase("scanning");
    setScannerOpen(true);

    const r = await fetch(`${api}/auto-trading/start`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        accountType: account,
        asset,
        investmentAmount: amount,
        tradeDuration: duration,
        strategy,
        aiSpeed: speed,
        riskPct: 2,
        lotSize: 0.1,
        dailyTargetPct: 5,
        dailyLossPct: 3,
        maxTrades: 5,
        stopLossPips: 30,
        takeProfitPips: 60,
        trailingStop: true,
        breakEven: true,
      }),
    });
    const d = await r.json();

    if (!r.ok) {
      setScannerOpen(false);
      if (r.status === 401) {
        window.location.href = "/login";
        return;
      }
      toast({ title: "AI Trading could not start", description: d.error || "Check the selected wallet balance.", variant: "destructive" });
      return;
    }

    setEnabled(true);
    window.setTimeout(() => setPhase("monitoring"), 2200);
    toast({ title: "AI Trading started", description: `Using the ${isDemo ? "Demo" : "Real"} wallet and ${asset} market engine.` });
    await loadStatus();
  };

  return (
    <div className="min-h-[70vh] flex items-center justify-center p-4">
      <div className="w-full max-w-md glass-card rounded-3xl border border-border p-6 text-center">
        <div className="mx-auto w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
          <Bot className="w-8 h-8 text-primary" />
        </div>

        <h1 className="text-2xl font-bold">AI Trading</h1>
        <p className="text-sm text-zinc-300 mt-2">
          {enabled ? "AI is actively monitoring the market for qualifying signals." : "Let AI scan the market and trade from your selected wallet."}
        </p>

        <div className="grid grid-cols-2 gap-3 mt-6 text-left">
          <div className="rounded-xl bg-muted/20 p-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Account</p>
            <p className="font-semibold mt-1">{isDemo ? "Demo" : "Real"}</p>
          </div>
          <div className="rounded-xl bg-muted/20 p-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Balance</p>
            <p className="font-semibold mt-1">${Number(wallet?.balance ?? 0).toFixed(2)}</p>
          </div>
        </div>

        {!enabled ? (
          <Button className="w-full h-12 mt-6 text-base" onClick={() => setConfigOpen(true)}>
            <Power className="w-5 h-5 mr-2" />
            Start AI Trading
          </Button>
        ) : (
          <Button variant="destructive" className="w-full h-12 mt-6 text-base" onClick={() => void stopTrading()}>
            Stop AI Trading
          </Button>
        )}
      </div>

      <AnimatePresence>
        {configOpen && !enabled && (
          <motion.div className="fixed inset-0 z-50 flex items-center justify-center bg-black p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className="w-full max-w-md rounded-2xl p-6 border border-zinc-700 bg-zinc-950 text-white shadow-2xl" initial={{ scale: 0.96, y: 12 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, y: 12 }}>
              <h2 className="text-xl font-bold text-white">Start AI Trading</h2>
              <p className="text-xs text-zinc-300 mt-1">Choose the trade parameters before AI starts scanning.</p>

              <div className="space-y-4 mt-5">
                <div>
                  <Label>Asset</Label>
                  <select value={asset} onChange={e => setAsset(e.target.value)} className="w-full h-10 mt-1 rounded-xl bg-zinc-900 border border-zinc-700 px-3 text-sm text-white [&>option]:bg-zinc-900 [&>option]:text-white">
                    {SYMBOLS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>

                <div>
                  <Label>Stake / Investment (USD)</Label>
                  <Input className="mt-1 bg-zinc-900 border-zinc-700 text-white placeholder:text-zinc-500" type="number" min="1" value={investmentAmount} onChange={e => setInvestmentAmount(e.target.value)} />
                </div>

                <div>
                  <Label>Trading Strategy</Label>
                  <select value={strategy} onChange={e => setStrategy(e.target.value)} className="w-full h-10 mt-1 rounded-xl bg-background border border-border px-3 text-sm">
                    <option value="trend">Trend Following</option>
                    <option value="scalp">Fast Scalping</option>
                    <option value="swing">Swing Trading</option>
                    <option value="breakout">Breakout Hunter</option>
                    <option value="smc">Smart Money</option>
                  </select>
                </div>

                <div>
                  <Label>Trade Duration</Label>
                  <select value={tradeDuration} onChange={e => setTradeDuration(e.target.value)} className="w-full h-10 mt-1 rounded-xl bg-background border border-border px-3 text-sm">
                    <option value="5">5 seconds</option>
                    <option value="10">10 seconds</option>
                    <option value="30">30 seconds</option>
                    <option value="60">1 minute</option>
                    <option value="300">5 minutes</option>
                    <option value="600">10 minutes</option>
                    <option value="900">15 minutes</option>
                    <option value="1800">30 minutes</option>
                    <option value="3600">1 hour</option>
                    <option value="7200">2 hours</option>
                    <option value="14400">4 hours</option>
                  </select>
                </div>

                <div>
                  <Label>AI Speed</Label>
                  <select value={speed} onChange={e => setSpeed(e.target.value)} className="w-full h-10 mt-1 rounded-xl bg-background border border-border px-3 text-sm">
                    <option value="fast">Fast AI</option>
                    <option value="slow">Slow AI</option>
                  </select>
                </div>

                <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-3 text-xs text-zinc-300">
                  <div className="flex justify-between"><span>Wallet</span><span className="font-semibold text-white">{isDemo ? "Demo" : "Real"}</span></div>
                  <div className="flex justify-between mt-1"><span>Market engine</span><span className="font-semibold text-foreground">Live repo engine</span></div>
                </div>

                <div className="flex gap-3">
                  <Button variant="outline" className="flex-1" onClick={() => setConfigOpen(false)}>Cancel</Button>
                  <Button className="flex-1" onClick={() => void startTrading()}>Start AI</Button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {scannerOpen && (
          <motion.div className="fixed inset-0 z-[60] flex items-center justify-center bg-black p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className="w-full max-w-sm rounded-2xl p-6 text-center border border-zinc-700 bg-zinc-950 text-white shadow-2xl">
              <div className="mx-auto w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                {phase === "scanning" ? <Search className="w-7 h-7 text-primary animate-pulse" /> : <Bot className="w-7 h-7 text-primary" />}
              </div>
              <h2 className="text-lg font-bold">{phase === "scanning" ? "AI is scanning the markets" : "AI is monitoring the market"}</h2>
              <p className="text-sm text-muted-foreground mt-2">
                {phase === "scanning" ? "Analyzing the repo market engine for a qualifying signal." : "Waiting for a qualifying signal before opening the next trade."}
              </p>

              <div className="mt-5 space-y-2 text-left text-xs text-zinc-300">
                <div className="flex justify-between"><span>Asset</span><span className="font-mono font-semibold text-white">{asset}</span></div>
                <div className="flex justify-between"><span>Stake</span><span className="font-mono font-semibold">${Number(investmentAmount).toFixed(2)}</span></div>
                <div className="flex justify-between"><span>Duration</span><span className="font-mono font-semibold">{Math.round(Number(tradeDuration) / 60)} min</span></div>
                <div className="flex justify-between"><span>Wallet</span><span className="font-mono font-semibold">{isDemo ? "Demo" : "Real"}</span></div>
              </div>

              <Button variant="outline" className="w-full mt-5" onClick={() => setScannerOpen(false)}>Close</Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
