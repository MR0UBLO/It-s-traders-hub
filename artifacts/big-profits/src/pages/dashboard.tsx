import { setBaseUrl } from "@workspace/api-client-react";
import {
  useGetDashboardSummary, useGetTrades, useGetMarketPrices,
  getGetDashboardSummaryQueryKey, getGetTradesQueryKey, getGetMarketPricesQueryKey,
} from "@workspace/api-client-react";
import { useAccountStore } from "@/store/account-store";
import { motion } from "framer-motion";
import { format } from "date-fns";
import {
  ArrowUpRight, ArrowDownRight, Wallet, Activity,
  Target, Percent, TrendingUp, TrendingDown, Bot, Zap,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Link } from "wouter";

function StatCard({ title, value, sub, icon: Icon, accent, delay }: {
  title: string; value: string; sub?: string;
  icon: React.ElementType; accent: string; delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.35 }}
      className="glass-card rounded-2xl p-5 flex flex-col gap-3"
    >
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground font-medium">{title}</p>
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${accent}`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <div>
        <p className="text-2xl font-bold tracking-tight">{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </div>
    </motion.div>
  );
}

function MarketTicker({ symbol, price, change }: { symbol: string; price: number; change: number }) {
  const up = change >= 0;
  return (
    <div className="flex items-center justify-between py-3 border-b border-border/50 last:border-0">
      <div className="flex items-center gap-2">
        <div className={`w-1.5 h-8 rounded-full ${up ? "bg-green-500" : "bg-red-500"}`} />
        <div>
          <p className="text-sm font-bold">{symbol}</p>
          <p className="text-xs text-muted-foreground font-mono">{price.toFixed(2)}</p>
        </div>
      </div>
      <span className={`flex items-center gap-0.5 text-xs font-semibold ${up ? "text-green-500" : "text-red-500"}`}>
        {up ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
        {Math.abs(change).toFixed(2)}%
      </span>
    </div>
  );
}

const AI_INSIGHTS = [
  { text: "XAUUSD showing strong support at 2,840. Bullish momentum expected.", confidence: 84 },
  { text: "BTCUSD consolidating — breakout above 98k could trigger a +5% move.", confidence: 71 },
  { text: "EURUSD bearish sentiment due to USD strength. Watch 1.080 support.", confidence: 66 },
];

export default function Dashboard() {
  const { mode } = useAccountStore();
  const { data: summary, isLoading: loadingSummary } = useGetDashboardSummary({ account: mode }, { query: { queryKey: getGetDashboardSummaryQueryKey({ account: mode }) } });
  const { data: trades, isLoading: loadingTrades } = useGetTrades({ account: mode }, { query: { queryKey: getGetTradesQueryKey({ account: mode }) } });
  const { data: prices } = useGetMarketPrices({ query: { queryKey: getGetMarketPricesQueryKey(), refetchInterval: 5000 } });

  const recentTrades = trades?.slice(0, 6) || [];

  return (
    <div className="p-5 space-y-6 max-w-[1400px] mx-auto">
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">{format(new Date(), "EEEE, MMMM do yyyy")}</p>
        </div>
        <Link href="/trade">
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors"
          >
            <Zap className="w-4 h-4" /> New Trade
          </motion.button>
        </Link>
      </motion.div>

      {/* Stat Cards */}
      {loadingSummary ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}
        </div>
      ) : summary ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard title="Total Balance" value={`$${summary.balance.toLocaleString("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})} USD`} sub={`Deposited: $${summary.totalDeposited.toLocaleString("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})} USD`} icon={Wallet} accent="bg-primary/10 text-primary" delay={0} />
          <StatCard
            title="Total Profit / Loss"
            value={`${summary.totalProfit >= 0 ? "+" : ""}$${Math.abs(summary.totalProfit).toLocaleString("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})} USD`}
            icon={summary.totalProfit >= 0 ? ArrowUpRight : ArrowDownRight}
            accent={summary.totalProfit >= 0 ? "bg-green-500/10 text-green-500" : "bg-red-500/10 text-red-500"}
            delay={0.08}
          />
          <StatCard title="Win Rate" value={`${summary.winRate.toFixed(1)}%`} sub={`${summary.totalTrades} total trades`} icon={Percent} accent="bg-blue-500/10 text-blue-400" delay={0.16} />
          <StatCard title="Open Positions" value={String(summary.openTrades)} sub="Active now" icon={Target} accent="bg-orange-500/10 text-orange-400" delay={0.24} />
        </div>
      ) : null}

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Recent trades - 2/3 width */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="lg:col-span-2 glass-card rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold flex items-center gap-2">
              <Activity className="w-4 h-4 text-primary" /> Recent Activity
            </h2>
            <Link href="/trade"><span className="text-xs text-primary hover:underline cursor-pointer">View all →</span></Link>
          </div>
          {loadingTrades ? (
            <div className="space-y-2">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 rounded-xl" />)}</div>
          ) : recentTrades.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow className="border-border/50">
                  <TableHead>Symbol</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">P/L</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentTrades.map((trade) => (
                  <TableRow key={trade.id} className="border-border/30">
                    <TableCell className="font-bold text-sm">{trade.symbol}</TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${trade.direction === "buy" ? "bg-green-500/10 text-green-500" : "bg-red-500/10 text-red-500"}`}>
                        {trade.direction === "buy" ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                        {trade.direction.toUpperCase()}
                      </span>
                    </TableCell>
                    <TableCell className="font-mono text-sm">${(trade.amount / 130).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD</TableCell>
                    <TableCell>
                      <span className={`text-xs capitalize px-2 py-0.5 rounded-full ${trade.status === "open" ? "bg-blue-500/10 text-blue-400" : "text-muted-foreground"}`}>
                        {trade.status}
                      </span>
                    </TableCell>
                    <TableCell className="font-mono text-sm">
  ${trade.amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} USD
</TableCell>
                        </span>
                      ) : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-10 text-muted-foreground">
              <Activity className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No trades yet.</p>
              <Link href="/trade"><span className="text-xs text-primary hover:underline cursor-pointer mt-1 block">Open your first trade →</span></Link>
            </div>
          )}
        </motion.div>

        {/* Right column */}
        <div className="space-y-5">
          {/* Market overview */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }} className="glass-card rounded-2xl p-5">
            <h2 className="font-bold mb-3 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" /> Live Markets
            </h2>
            {prices?.map((p) => (
              <MarketTicker key={p.symbol} symbol={p.symbol} price={p.bid} change={p.changePercent24h} />
            )) ?? <div className="text-xs text-muted-foreground text-center py-4">Loading...</div>}
          </motion.div>

          {/* AI Insights */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }} className="glass-card rounded-2xl p-5">
            <h2 className="font-bold mb-3 flex items-center gap-2">
              <Bot className="w-4 h-4 text-primary" /> AI Insights
            </h2>
            <div className="space-y-3">
              {AI_INSIGHTS.map(({ text, confidence }) => (
                <div key={text} className="bg-background/40 rounded-xl p-3 space-y-2">
                  <p className="text-xs text-muted-foreground leading-relaxed">{text}</p>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-primary rounded-full" style={{ width: `${confidence}%` }} />
                    </div>
                    <span className="text-xs font-bold text-primary">{confidence}%</span>
                  </div>
                </div>
              ))}
            </div>
            <Link href="/ai-signals"><span className="text-xs text-primary hover:underline cursor-pointer mt-3 block">All AI signals →</span></Link>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
