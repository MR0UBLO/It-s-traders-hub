import { useGetMarketPrices } from "@workspace/api-client-react";
import { motion } from "framer-motion";
import { ArrowUp, ArrowDown, TrendingUp, Activity } from "lucide-react";

const SYMBOL_META: Record<string, { name: string; description: string; color: string }> = {
  XAUUSD: { name: "Gold / USD", description: "Precious Metal", color: "#F59E0B" },
  EURUSD: { name: "Euro / USD", description: "Forex Major", color: "#6366F1" },
  BTCUSD: { name: "Bitcoin / USD", description: "Cryptocurrency", color: "#F97316" },
};

function MiniSparkline({ up }: { up: boolean }) {
  const path = up
    ? "M0,40 L20,32 L40,35 L60,25 L80,28 L100,15"
    : "M0,15 L20,22 L40,18 L60,28 L80,25 L100,38";
  const color = up ? "#22C55E" : "#EF4444";
  return (
    <svg width="100" height="50" viewBox="0 0 100 50" className="opacity-80">
      <path d={path} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export default function Markets() {
  const { data: prices, isLoading } = useGetMarketPrices({ query: { queryKey: [], refetchInterval: 3000 } });

  return (
    <div className="p-6 space-y-8 max-w-7xl mx-auto">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <Activity className="w-7 h-7 text-primary" /> Live Markets
        </h1>
        <p className="text-muted-foreground">Real-time prices refreshing every 3 seconds.</p>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {isLoading
          ? [1, 2, 3].map((i) => (
              <div key={i} className="glass-card h-48 animate-pulse rounded-2xl bg-card/40" />
            ))
          : prices?.map((p, i) => {
              const meta = SYMBOL_META[p.symbol] || { name: p.symbol, description: "Market", color: "#64748b" };
              const up = p.changePercent24h >= 0;
              return (
                <motion.div
                  key={p.symbol}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className="glass-card p-6 rounded-2xl group hover:border-primary/30 transition-all duration-300"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ backgroundColor: meta.color }}
                        />
                        <span className="text-xs text-muted-foreground font-medium uppercase tracking-widest">
                          {p.symbol}
                        </span>
                      </div>
                      <p className="font-bold text-lg leading-tight">{meta.name}</p>
                      <p className="text-xs text-muted-foreground">{meta.description}</p>
                    </div>
                    <MiniSparkline up={up} />
                  </div>

                  <div className="space-y-3">
                    <div className="text-3xl font-bold font-mono tracking-tight">
                      {p.bid.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className={`flex items-center gap-1 font-semibold ${up ? "text-green-500" : "text-red-500"}`}>
                        {up ? <ArrowUp className="w-3.5 h-3.5" /> : <ArrowDown className="w-3.5 h-3.5" />}
                        {Math.abs(p.changePercent24h).toFixed(2)}% 24h
                      </span>
                      <div className="text-right text-muted-foreground text-xs">
                        <div>Ask: <span className="text-foreground font-mono">{p.ask.toFixed(2)}</span></div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
      </div>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }} className="glass-card rounded-2xl p-6">
        <h2 className="font-bold text-lg mb-4 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-primary" /> Market Info
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-sm">
          {[
            { label: "Trading Hours", value: "24/7" },
            { label: "Price Refresh", value: "Every 3s" },
            { label: "Execution", value: "Instant" },
            { label: "Min Trade", value: "100 KES" },
          ].map(({ label, value }) => (
            <div key={label}>
              <p className="text-muted-foreground text-xs mb-1">{label}</p>
              <p className="font-semibold">{value}</p>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
