import { useState } from "react";
import { motion } from "framer-motion";
import { format } from "date-fns";
import {
  Briefcase, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight,
  Activity, Target, Percent, Wallet, Clock, Search, Filter, ChevronDown,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Link } from "wouter";
import {
  useGetDashboardSummary, getGetDashboardSummaryQueryKey,
  useGetOpenTrades, getGetOpenTradesQueryKey,
  useGetTrades, getGetTradesQueryKey,
} from "@workspace/api-client-react";
import { useAccountStore } from "@/store/account-store";

const n = (v: unknown) => { const x = Number(v); return isNaN(x) ? 0 : x; };
const usd = (v: unknown) => "$" + n(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function StatCard({ title, value, sub, icon: Icon, accent, trend, delay }: {
  title: string; value: string; sub?: string;
  icon: React.ElementType; accent: string; trend?: "up" | "down" | null; delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.3 }}
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
      {trend && (
        <div className={`flex items-center gap-1 text-xs font-semibold ${trend === "up" ? "text-green-500" : "text-red-500"}`}>
          {trend === "up" ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
          {trend === "up" ? "Positive performance" : "Negative performance"}
        </div>
      )}
    </motion.div>
  );
}

const DIR_COLORS: Record<string, string> = {
  buy: "text-green-500 bg-green-500/10",
  sell: "text-red-500 bg-red-500/10",
};

export default function Portfolio() {
  const { mode } = useAccountStore();
  const [activeTab, setActiveTab] = useState<"positions" | "history">("positions");
  const [search, setSearch] = useState("");
  const [filterDir, setFilterDir] = useState<"all" | "buy" | "sell">("all");

  const { data: summary, isLoading: loadingSummary } = useGetDashboardSummary(
    { account: mode },
    { query: { queryKey: getGetDashboardSummaryQueryKey({ account: mode }) } },
  );
  const { data: openTrades = [], isLoading: loadingOpen } = useGetOpenTrades(
    { account: mode },
    { query: { queryKey: getGetOpenTradesQueryKey({ account: mode }), refetchInterval: 3000 } },
  );
  const { data: allTrades = [], isLoading: loadingHistory } = useGetTrades(
    { account: mode },
    { query: { queryKey: getGetTradesQueryKey({ account: mode }) } },
  );

  const closedTrades = Array.isArray(allTrades) ? allTrades.filter((t: any) => t.status === "closed") : [];

  const filteredHistory = closedTrades.filter((t: any) => {
    const matchSearch = !search || t.symbol?.toLowerCase().includes(search.toLowerCase());
    const matchDir = filterDir === "all" || t.direction === filterDir;
    return matchSearch && matchDir;
  });

  const filteredOpen = Array.isArray(openTrades) ? openTrades.filter((t: any) => {
    return !search || t.symbol?.toLowerCase().includes(search.toLowerCase());
  }) : [];

  return (
    <div className="p-4 sm:p-5 space-y-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Portfolio</h1>
          <p className="text-sm text-muted-foreground">Your trading positions & history</p>
        </div>
        <Link href="/trade">
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors"
          >
            <TrendingUp className="w-4 h-4" /> New Trade
          </motion.button>
        </Link>
      </motion.div>

      {/* Stats */}
      {loadingSummary ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Total Balance"
            value={usd(n(summary?.balance ?? 0))}
            sub={`Deposited: ${usd(n(summary?.totalDeposited ?? 0))}`}
            icon={Wallet}
            accent="bg-primary/10 text-primary"
            delay={0}
          />
          <StatCard
            title="Total P/L"
            value={`${n(summary?.totalProfit ?? 0) >= 0 ? "+" : ""}${usd(n(summary?.totalProfit ?? 0))}`}
            icon={n(summary?.totalProfit ?? 0) >= 0 ? ArrowUpRight : ArrowDownRight}
            accent={n(summary?.totalProfit ?? 0) >= 0 ? "bg-green-500/10 text-green-500" : "bg-red-500/10 text-red-500"}
            trend={n(summary?.totalProfit ?? 0) >= 0 ? "up" : "down"}
            delay={0.05}
          />
          <StatCard
            title="Open Positions"
            value={String(summary?.openTrades ?? 0)}
            sub="Active trades"
            icon={Activity}
            accent="bg-blue-500/10 text-blue-500"
            delay={0.1}
          />
          <StatCard
            title="Win Rate"
            value={`${n(summary?.winRate ?? 0).toFixed(1)}%`}
            sub={`From ${summary?.totalTrades ?? 0} closed trades`}
            icon={Target}
            accent="bg-amber-500/10 text-amber-500"
            delay={0.15}
          />
        </div>
      )}

      {/* Tabs + Search */}
      <div className="glass-card rounded-2xl overflow-hidden">
        {/* Tab bar */}
        <div className="flex items-center justify-between px-4 pt-4 pb-0 gap-3 flex-wrap">
          <div className="flex items-center gap-1 bg-background/50 rounded-xl p-1">
            {(["positions", "history"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`relative px-4 py-1.5 text-sm font-semibold rounded-lg transition-colors capitalize ${
                  activeTab === tab
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {activeTab === tab && (
                  <motion.span
                    layoutId="portfolio-tab-bg"
                    className="absolute inset-0 bg-primary/10 rounded-lg"
                  />
                )}
                <span className="relative">
                  {tab === "positions" ? `Open (${filteredOpen.length})` : `History (${closedTrades.length})`}
                </span>
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search symbol…"
                className="pl-8 h-8 text-xs w-36"
              />
            </div>
            {activeTab === "history" && (
              <div className="relative">
                <select
                  value={filterDir}
                  onChange={(e) => setFilterDir(e.target.value as any)}
                  className="appearance-none pl-3 pr-7 h-8 text-xs rounded-lg border border-border bg-background text-foreground cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="all">All</option>
                  <option value="buy">Buy</option>
                  <option value="sell">Sell</option>
                </select>
                <ChevronDown className="w-3 h-3 absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              </div>
            )}
          </div>
        </div>

        {/* Open Positions */}
        {activeTab === "positions" && (
          <div className="overflow-x-auto">
            {loadingOpen ? (
              <div className="p-4 space-y-2">{[1,2,3].map(i=><Skeleton key={i} className="h-12 rounded-xl"/>)}</div>
            ) : filteredOpen.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Activity className="w-10 h-10 text-muted-foreground/30 mb-3" />
                <p className="font-semibold text-muted-foreground">No open positions</p>
                <p className="text-sm text-muted-foreground/60 mt-1">Your active trades will appear here</p>
                <Link href="/trade">
                  <button className="mt-4 px-4 py-2 text-sm font-semibold bg-primary/10 text-primary rounded-xl hover:bg-primary/20 transition-colors">
                    Start Trading
                  </button>
                </Link>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Symbol</TableHead>
                    <TableHead>Direction</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="text-right">Entry</TableHead>
                    <TableHead className="text-right">P/L</TableHead>
                    <TableHead className="text-right hidden sm:table-cell">Opened</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(filteredOpen as any[]).map((t) => {
                    const pl = n(t.profitLoss);
                    const isUp = pl >= 0;
                    return (
                      <TableRow key={t.id}>
                        <TableCell className="font-mono font-bold text-sm">{t.symbol}</TableCell>
                        <TableCell>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-bold capitalize ${DIR_COLORS[t.direction] ?? ""}`}>
                            {t.direction}
                          </span>
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">{usd(n(t.amount))}</TableCell>
                        <TableCell className="text-right font-mono text-sm">{n(t.entryPrice).toFixed(4)}</TableCell>
                        <TableCell className={`text-right font-mono font-bold text-sm ${isUp ? "text-green-500" : "text-red-500"}`}>
                          {isUp ? "+" : ""}{usd(pl)}
                        </TableCell>
                        <TableCell className="text-right text-xs text-muted-foreground hidden sm:table-cell">
                          {format(new Date(t.createdAt), "MMM d, HH:mm")}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </div>
        )}

        {/* Trade History */}
        {activeTab === "history" && (
          <div className="overflow-x-auto">
            {loadingHistory ? (
              <div className="p-4 space-y-2">{[1,2,3].map(i=><Skeleton key={i} className="h-12 rounded-xl"/>)}</div>
            ) : filteredHistory.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Clock className="w-10 h-10 text-muted-foreground/30 mb-3" />
                <p className="font-semibold text-muted-foreground">No trade history</p>
                <p className="text-sm text-muted-foreground/60 mt-1">Closed trades will appear here</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Symbol</TableHead>
                    <TableHead>Direction</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="text-right hidden sm:table-cell">Entry</TableHead>
                    <TableHead className="text-right hidden sm:table-cell">Close</TableHead>
                    <TableHead className="text-right">P/L</TableHead>
                    <TableHead className="text-right hidden md:table-cell">Closed</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(filteredHistory as any[]).map((t) => {
                    const pl = n(t.profitLoss);
                    const isUp = pl >= 0;
                    return (
                      <TableRow key={t.id}>
                        <TableCell className="font-mono font-bold text-sm">{t.symbol}</TableCell>
                        <TableCell>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-bold capitalize ${DIR_COLORS[t.direction] ?? ""}`}>
                            {t.direction}
                          </span>
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">{usd(n(t.amount))}</TableCell>
                        <TableCell className="text-right font-mono text-sm hidden sm:table-cell">{n(t.entryPrice).toFixed(4)}</TableCell>
                        <TableCell className="text-right font-mono text-sm hidden sm:table-cell">
                          {t.closePrice != null ? n(t.closePrice).toFixed(4) : "—"}
                        </TableCell>
                        <TableCell className={`text-right font-mono font-bold text-sm ${isUp ? "text-green-500" : "text-red-500"}`}>
                          {isUp ? "+" : ""}{usd(pl)}
                        </TableCell>
                        <TableCell className="text-right text-xs text-muted-foreground hidden md:table-cell">
                          {t.closedAt ? format(new Date(t.closedAt), "MMM d, HH:mm") : "—"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
