import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Users, Search, SlidersHorizontal, Star, BadgeCheck, TrendingUp, TrendingDown, X, ChevronDown, Copy, Shield, AlertTriangle, Info, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { AreaChart, Area, ResponsiveContainer, Tooltip, XAxis } from "recharts";

/* ─── TRADER DATA ─────────────────────────────────────────────────── */
const FIRST_NAMES = ["James","John","Peter","David","Michael","Joseph","Samuel","Daniel","Stephen","Benjamin","Anthony","Charles","Paul","Patrick","Francis","Eric","Kevin","Alex","Brian","Dennis","Felix","Gilbert","Henry","Isaac","Kenneth","Leonard","Martin","Nathan","Oliver","Philip","Richard","Simon","Thomas","Victor","William","Alfred","Edward","Emmanuel","George","Bernard","Mary","Grace","Faith","Hope","Mercy","Anne","Jane","Sarah","Esther","Ruth","Lydia","Rebecca","Elizabeth","Catherine","Margaret","Agnes","Alice","Betty","Caroline","Diana","Florence","Gloria","Hannah","Irene","Janet","Karen","Lucy","Nancy","Patricia","Rachel","Sandra","Susan","Teresa","Wanjiku","Achieng","Chebet","Auma","Njeri","Wambui","Muthoni","Wangari","Amina","Zawadi"];
const LAST_NAMES = ["Kamau","Mwangi","Otieno","Karanja","Njoroge","Mutua","Wambua","Gitonga","Ochieng","Ndegwa","Njogu","Waweru","Mugo","Kibe","Korir","Rotich","Kiptoo","Ruto","Sang","Tanui","Bett","Ngetich","Ogola","Onyango","Owino","Omondi","Onyando","Wanyama","Baraza","Makokha","Simiyu","Wekesa","Masika","Adhiambo","Sifuna","Wesonga","Muthee","Kiprotich","Chepkorir","Langat","Kiplagat","Ndirangu","Gatheru","Njeru","Kimani","Maina","Gicheru","Wainaina","Mwenda","Ngugi"];
const ASSETS = [["EURUSD","GBPUSD","XAUUSD"],["BTCUSD","ETHUSD","XAUUSD"],["NASDAQ","S&P500","EURUSD"],["CRUDE OIL","XAUUSD","GBPUSD"],["EURUSD","USDJPY","GBPUSD"],["BTCUSD","SOLUSDT","ETHUSD"],["XAUUSD","SILVER","CRUDE OIL"],["EURUSD","GBPUSD","USDCHF"]];
const RISKS: ("Low"|"Medium"|"High")[] = ["Low","Low","Medium","Medium","High"];
const STRATEGIES = ["Trend Following","Scalping","Swing Trading","Price Action","Smart Money Concepts","Grid Trading","Breakout Trading","News Trading"];

function seeded(seed: number, max: number, min = 0) {
  const x = Math.sin(seed) * 10000;
  return min + ((x - Math.floor(x)) * (max - min));
}

function makeEquityCurve(seed: number, length = 12) {
  let v = 100;
  return Array.from({ length }, (_, i) => {
    v += (seeded(seed * 13 + i, 8, -3));
    return { m: i + 1, v: Math.max(60, Math.round(v * 10) / 10) };
  });
}

const TRADERS = Array.from({ length: 100 }, (_, i) => {
  const s = i + 7;
  const fn = FIRST_NAMES[i % FIRST_NAMES.length];
  const ln = LAST_NAMES[Math.floor(seeded(s * 3, LAST_NAMES.length))];
  const winRate = Math.round(seeded(s * 5, 89, 51));
  const monthlyRoi = Math.round(seeded(s * 7, 32, 2) * 10) / 10;
  const overallRoi = Math.round(seeded(s * 11, 420, 18) * 10) / 10;
  const drawdown = Math.round(seeded(s * 13, 28, 4) * 10) / 10;
  const followers = Math.floor(seeded(s * 17, 4800, 12));
  const copiers = Math.floor(seeded(s * 19, 340, 2));
  const copyFee = Math.floor(seeded(s * 23, 5, 0));
  const profitShare = Math.floor(seeded(s * 29, 30, 10));
  const risk = RISKS[Math.floor(seeded(s * 31, RISKS.length))];
  const assets = ASSETS[Math.floor(seeded(s * 37, ASSETS.length))];
  const strategy = STRATEGIES[Math.floor(seeded(s * 41, STRATEGIES.length))];
  const trades = Math.floor(seeded(s * 43, 4800, 120));
  const avgDuration = `${Math.floor(seeded(s * 47, 8, 1))}h ${Math.floor(seeded(s * 53, 59, 5))}m`;
  const lastActive = ["Just now","2 min ago","5 min ago","12 min ago","1 hr ago","3 hrs ago","Today","Yesterday"][Math.floor(seeded(s * 59, 8))];
  const verified = seeded(s * 61, 1) > 0.35;
  const equity = makeEquityCurve(s);
  const minCopy = [50,100,200,500][Math.floor(seeded(s * 67, 4))];
  const avatarColor = ["#6366f1","#8b5cf6","#ec4899","#f59e0b","#10b981","#3b82f6","#ef4444","#14b8a6"][Math.floor(seeded(s * 71, 8))];
  return { id: i + 1, name: `${fn} ${ln}`, winRate, monthlyRoi, overallRoi, drawdown, followers, copiers, copyFee, profitShare, risk, assets, strategy, trades, avgDuration, lastActive, verified, equity, minCopy, maxCopy: minCopy * 100, avatarColor, initials: `${fn[0]}${ln[0]}`, isFollowing: false };
});

/* ─── MINI SPARK ─────────────────────────────────────────────────── */
function Spark({ data, color }: { data: { m: number; v: number }[]; color: string }) {
  return (
    <ResponsiveContainer width="100%" height={48}>
      <AreaChart data={data} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id={`sg${color.replace("#","")}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.35} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area type="monotone" dataKey="v" stroke={color} strokeWidth={1.5} fill={`url(#sg${color.replace("#","")})`} dot={false} />
        <Tooltip contentStyle={{ display: "none" }} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

/* ─── RISK BADGE ─────────────────────────────────────────────────── */
function RiskBadge({ risk }: { risk: "Low"|"Medium"|"High" }) {
  const cls = risk === "Low" ? "bg-green-500/10 text-green-400 border-green-500/20" : risk === "Medium" ? "bg-yellow-500/10 text-yellow-400 border-yellow-500/20" : "bg-red-500/10 text-red-400 border-red-500/20";
  return <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${cls}`}>{risk} Risk</span>;
}

/* ─── COPY DIALOG ────────────────────────────────────────────────── */
function CopyDialog({ trader, onClose }: { trader: typeof TRADERS[0]; onClose: () => void }) {
  const [amount, setAmount] = useState(String(trader.minCopy));
  const [riskPct, setRiskPct] = useState("2");
  const [lotType, setLotType] = useState<"proportional"|"fixed">("proportional");
  const [maxDD, setMaxDD] = useState("20");
  const [agreed, setAgreed] = useState(false);
  const [pausing, setPausing] = useState(false);
  const { toast } = useToast();
  const num = Number(amount);

  const handleCopy = () => {
    if (!agreed) { toast({ title: "Please accept the terms", variant: "destructive" }); return; }
    if (num < trader.minCopy) { toast({ title: `Minimum copy amount is $${trader.minCopy.toLocaleString()} USD`, variant: "destructive" }); return; }
    toast({ title: "Copy trading activated!", description: `You are now copying ${trader.name} with $${num.toLocaleString()} USD.` });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} onClick={e => e.stopPropagation()} className="w-full max-w-lg bg-card border border-border rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div>
            <h2 className="font-bold text-lg">Copy {trader.name}</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Configure your copy trading settings</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-accent transition-colors"><X className="w-4 h-4" /></button>
        </div>

        <div className="p-5 space-y-5">
          {/* Fee breakdown */}
          <div className="bg-muted/30 rounded-xl p-4 space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Fee Structure</p>
            {[
              { label: "Copy Fee", value: `${trader.copyFee}%` },
              { label: "Profit Sharing", value: `${trader.profitShare}%` },
              { label: "Management Fee", value: "0%" },
              { label: "Overnight Fee", value: "Variable (swap)" },
              { label: "Spread", value: "From 0.3 pips" },
            ].map(({ label, value }) => (
              <div key={label} className="flex justify-between text-sm">
                <span className="text-muted-foreground">{label}</span>
                <span className="font-semibold">{value}</span>
              </div>
            ))}
          </div>

          {/* Copy amount */}
          <div className="space-y-1.5">
            <Label className="text-sm">Copy Amount (USD)</Label>
            <Input type="number" value={amount} onChange={e => setAmount(e.target.value)} className="h-11 bg-background font-mono text-lg" />
            <p className="text-xs text-muted-foreground">Min: ${trader.minCopy.toLocaleString()} USD · Max: ${trader.maxCopy.toLocaleString()} USD</p>
          </div>

          {/* Risk % */}
          <div className="space-y-1.5">
            <Label className="text-sm">Risk Per Trade (%)</Label>
            <Input type="number" value={riskPct} onChange={e => setRiskPct(e.target.value)} min="0.1" max="10" className="h-11 bg-background font-mono" />
          </div>

          {/* Lot type */}
          <div className="space-y-1.5">
            <Label className="text-sm">Lot Size Mode</Label>
            <div className="grid grid-cols-2 gap-2">
              {(["proportional","fixed"] as const).map(t => (
                <button key={t} onClick={() => setLotType(t)} className={`py-2 rounded-xl border text-sm font-semibold transition-all ${lotType === t ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/40"}`}>
                  {t === "proportional" ? "Proportional" : "Fixed Lot"}
                </button>
              ))}
            </div>
          </div>

          {/* Max drawdown protection */}
          <div className="space-y-1.5">
            <Label className="text-sm">Max Drawdown Protection (%)</Label>
            <Input type="number" value={maxDD} onChange={e => setMaxDD(e.target.value)} min="1" max="100" className="h-11 bg-background font-mono" />
            <p className="text-xs text-muted-foreground">Copy stops automatically if drawdown exceeds this level</p>
          </div>

          {/* Controls */}
          <div className="flex gap-2">
            <button onClick={() => setPausing(!pausing)} className={`flex-1 py-2 rounded-xl border text-xs font-semibold transition-all ${pausing ? "border-yellow-500 bg-yellow-500/10 text-yellow-400" : "border-border text-muted-foreground hover:border-primary/40"}`}>
              {pausing ? "▶ Resume Copying" : "⏸ Pause Copying"}
            </button>
            <button className="flex-1 py-2 rounded-xl border border-red-500/30 text-xs font-semibold text-red-400 hover:bg-red-500/10 transition-all">
              ✕ Stop Copying
            </button>
          </div>

          {/* Estimated performance */}
          <div className="bg-primary/5 border border-primary/20 rounded-xl p-4">
            <p className="text-xs font-semibold text-primary mb-2">Estimated Monthly Performance</p>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div><p className="text-lg font-bold text-green-400">+${(num * trader.monthlyRoi / 100).toFixed(0)}</p><p className="text-[10px] text-muted-foreground">Est. Profit (USD)</p></div>
              <div><p className="text-lg font-bold">{trader.monthlyRoi}%</p><p className="text-[10px] text-muted-foreground">Monthly ROI</p></div>
              <div><p className="text-lg font-bold text-red-400">-{trader.drawdown}%</p><p className="text-[10px] text-muted-foreground">Max Drawdown</p></div>
            </div>
            <p className="text-[10px] text-muted-foreground mt-3 flex items-start gap-1"><AlertTriangle className="w-3 h-3 mt-0.5 flex-shrink-0" />Past performance does not guarantee future results.</p>
          </div>

          {/* Terms */}
          <label className="flex items-start gap-3 cursor-pointer">
            <input type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)} className="mt-1 accent-primary" />
            <span className="text-xs text-muted-foreground">I understand that copy trading involves risk. I accept the Copy Trading Agreement and Terms & Conditions.</span>
          </label>

          <Button onClick={handleCopy} className="w-full h-11 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold">
            <Copy className="w-4 h-4 mr-2" /> Start Copy Trading
          </Button>
        </div>
      </motion.div>
    </div>
  );
}

/* ─── TRADER PROFILE MODAL ──────────────────────────────────────── */
function TraderProfile({ trader, onClose, onCopy }: { trader: typeof TRADERS[0]; onClose: () => void; onCopy: () => void }) {
  const monthly = trader.equity.map((e, i) => ({ name: ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][i], roi: Math.round((Math.random() * 16 - 3) * 10) / 10 }));
  const recentTrades = Array.from({ length: 6 }, (_, i) => {
    const s = trader.id * 100 + i;
    const sym = trader.assets[i % trader.assets.length];
    const dir = seeded(s, 1) > 0.4 ? "BUY" : "SELL";
    const pnl = Math.round(seeded(s * 3, 320, -80) * 10) / 10;
    const date = new Date(Date.now() - seeded(s * 7, 86400000 * 14)).toLocaleDateString("en-KE", { day: "2-digit", month: "short" });
    return { sym, dir, pnl, date };
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }} onClick={e => e.stopPropagation()} className="w-full max-w-2xl bg-card border border-border rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="relative p-6 border-b border-border bg-gradient-to-r from-primary/5 to-transparent">
          <button onClick={onClose} className="absolute top-4 right-4 w-8 h-8 rounded-lg flex items-center justify-center hover:bg-accent transition-colors"><X className="w-4 h-4" /></button>
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-bold text-white flex-shrink-0" style={{ backgroundColor: trader.avatarColor }}>{trader.initials}</div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl font-bold">{trader.name}</h2>
                {trader.verified && <BadgeCheck className="w-5 h-5 text-primary" />}
                <RiskBadge risk={trader.risk} />
              </div>
              <p className="text-sm text-muted-foreground mt-0.5">{trader.strategy} · {trader.assets.join(", ")}</p>
              <p className="text-xs text-muted-foreground mt-1">Last active: {trader.lastActive}</p>
            </div>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-4 gap-3 mt-5">
            {[
              { label: "Win Rate", value: `${trader.winRate}%`, color: "text-green-400" },
              { label: "Monthly ROI", value: `+${trader.monthlyRoi}%`, color: "text-primary" },
              { label: "Overall ROI", value: `+${trader.overallRoi}%`, color: "text-primary" },
              { label: "Max Drawdown", value: `-${trader.drawdown}%`, color: "text-red-400" },
            ].map(({ label, value, color }) => (
              <div key={label} className="bg-background/60 rounded-xl p-3 text-center">
                <p className={`text-lg font-bold font-mono ${color}`}>{value}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{label}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Equity curve */}
          <div>
            <p className="text-sm font-semibold mb-3">Historical Equity Curve</p>
            <div className="h-32">
              <Spark data={trader.equity} color={trader.avatarColor} />
            </div>
          </div>

          {/* Additional stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: "Total Trades", value: trader.trades.toLocaleString() },
              { label: "Avg Duration", value: trader.avgDuration },
              { label: "Followers", value: trader.followers.toLocaleString() },
              { label: "Copiers", value: trader.copiers.toLocaleString() },
            ].map(({ label, value }) => (
              <div key={label} className="bg-muted/30 rounded-xl p-3 text-center">
                <p className="font-bold text-sm">{value}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{label}</p>
              </div>
            ))}
          </div>

          {/* Portfolio allocation */}
          <div>
            <p className="text-sm font-semibold mb-3">Assets Traded</p>
            <div className="flex flex-wrap gap-2">
              {trader.assets.map(a => (
                <span key={a} className="px-3 py-1.5 bg-primary/10 text-primary border border-primary/20 rounded-lg text-xs font-semibold">{a}</span>
              ))}
            </div>
          </div>

          {/* Recent trades */}
          <div>
            <p className="text-sm font-semibold mb-3">Recent Trades</p>
            <div className="space-y-2">
              {recentTrades.map((t, i) => (
                <div key={i} className="flex items-center justify-between py-2 px-3 bg-muted/20 rounded-xl">
                  <div className="flex items-center gap-3">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${t.dir === "BUY" ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"}`}>{t.dir}</span>
                    <span className="text-sm font-semibold">{t.sym}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className={`text-sm font-mono font-bold ${t.pnl >= 0 ? "text-green-400" : "text-red-400"}`}>{t.pnl >= 0 ? "+" : ""}{t.pnl} USD</span>
                    <span className="text-xs text-muted-foreground">{t.date}</span>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-muted-foreground mt-2 flex items-center gap-1"><Info className="w-3 h-3" />Past performance does not guarantee future results.</p>
          </div>

          <Button onClick={onCopy} className="w-full h-12 bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-base">
            <Copy className="w-4 h-4 mr-2" /> Copy This Trader
          </Button>
        </div>
      </motion.div>
    </div>
  );
}

/* ─── TRADER CARD ────────────────────────────────────────────────── */
function TraderCard({ trader, onView, onCopy, isFav, onToggleFav }: { trader: typeof TRADERS[0]; onView: () => void; onCopy: () => void; isFav: boolean; onToggleFav: () => void }) {
  const sparkColor = trader.monthlyRoi >= 0 ? "#10b981" : "#ef4444";
  return (
    <motion.div whileHover={{ y: -3 }} transition={{ duration: 0.2 }} className="glass-card rounded-2xl p-5 flex flex-col gap-4 cursor-pointer group border border-transparent hover:border-primary/20 transition-all" onClick={onView}>
      {/* Top row */}
      <div className="flex items-start gap-3">
        <div className="w-12 h-12 rounded-xl flex items-center justify-center text-lg font-bold text-white flex-shrink-0" style={{ backgroundColor: trader.avatarColor }}>{trader.initials}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <p className="font-bold text-sm truncate">{trader.name}</p>
            {trader.verified && <BadgeCheck className="w-3.5 h-3.5 text-primary flex-shrink-0" />}
          </div>
          <p className="text-[10px] text-muted-foreground mt-0.5">{trader.strategy}</p>
          <div className="flex items-center gap-1.5 mt-1">
            <RiskBadge risk={trader.risk} />
          </div>
        </div>
        <button onClick={e => { e.stopPropagation(); onToggleFav(); }} className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${isFav ? "text-yellow-400" : "text-muted-foreground hover:text-yellow-400"}`}>
          <Star className={`w-4 h-4 ${isFav ? "fill-yellow-400" : ""}`} />
        </button>
      </div>

      {/* Sparkline */}
      <div className="-mx-1">
        <Spark data={trader.equity} color={sparkColor} />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div>
          <p className="text-xs font-bold text-green-400">{trader.winRate}%</p>
          <p className="text-[10px] text-muted-foreground">Win Rate</p>
        </div>
        <div>
          <p className="text-xs font-bold text-primary">+{trader.monthlyRoi}%</p>
          <p className="text-[10px] text-muted-foreground">Monthly</p>
        </div>
        <div>
          <p className="text-xs font-bold text-red-400">-{trader.drawdown}%</p>
          <p className="text-[10px] text-muted-foreground">Max DD</p>
        </div>
      </div>

      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
        <span><Users className="w-3 h-3 inline mr-1" />{trader.followers.toLocaleString()} followers</span>
        <span className="flex items-center gap-1"><span className={`w-1.5 h-1.5 rounded-full ${trader.lastActive.includes("now") || trader.lastActive.includes("min") ? "bg-green-400 animate-pulse" : "bg-muted-foreground"}`} />{trader.lastActive}</span>
      </div>

      <Button onClick={e => { e.stopPropagation(); onCopy(); }} className="w-full h-9 bg-primary/90 hover:bg-primary text-primary-foreground font-semibold text-sm" size="sm">
        <Copy className="w-3.5 h-3.5 mr-1.5" /> Copy Trade
      </Button>
    </motion.div>
  );
}

/* ─── MAIN PAGE ──────────────────────────────────────────────────── */
type SortKey = "monthlyRoi"|"winRate"|"followers"|"drawdown"|"overallRoi";

export default function CopyTrading() {
  const [search, setSearch]           = useState("");
  const [riskFilter, setRiskFilter]   = useState<string>("All");
  const [sortKey, setSortKey]         = useState<SortKey>("monthlyRoi");
  const [sortDesc, setSortDesc]       = useState(true);
  const [favs, setFavs]               = useState<Set<number>>(new Set());
  const [showFavsOnly, setShowFavsOnly] = useState(false);
  const [profileId, setProfileId]     = useState<number | null>(null);
  const [copyId, setCopyId]           = useState<number | null>(null);
  const [assetFilter, setAssetFilter] = useState("All");
  const [showFilters, setShowFilters] = useState(false);

  const profile = TRADERS.find(t => t.id === profileId) ?? null;
  const copyTrader = TRADERS.find(t => t.id === copyId) ?? null;

  const ASSET_OPTIONS = ["All","EURUSD","GBPUSD","XAUUSD","BTCUSD","ETHUSD","NASDAQ","CRUDE OIL"];

  const filtered = useMemo(() => {
    let list = [...TRADERS];
    if (search) list = list.filter(t => t.name.toLowerCase().includes(search.toLowerCase()) || t.assets.some(a => a.toLowerCase().includes(search.toLowerCase())));
    if (riskFilter !== "All") list = list.filter(t => t.risk === riskFilter);
    if (assetFilter !== "All") list = list.filter(t => t.assets.includes(assetFilter));
    if (showFavsOnly) list = list.filter(t => favs.has(t.id));
    list.sort((a, b) => (sortDesc ? b[sortKey] - a[sortKey] : a[sortKey] - b[sortKey]));
    return list;
  }, [search, riskFilter, assetFilter, sortKey, sortDesc, showFavsOnly, favs]);

  const toggleFav = (id: number) => setFavs(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2"><Users className="w-7 h-7 text-primary" />Copy Trading</h1>
        <p className="text-muted-foreground text-sm">Mirror top Kenyan traders automatically.</p>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Expert Traders", value: "100+", sub: "Verified profiles", icon: Users, color: "text-primary" },
          { label: "Avg Monthly ROI", value: "+14.2%", sub: "Across all traders", icon: TrendingUp, color: "text-green-400" },
          { label: "Avg Win Rate", value: "69.8%", sub: "Last 30 days", icon: Zap, color: "text-yellow-400" },
          { label: "Total Copiers", value: "12,400+", sub: "Active copy traders", icon: Copy, color: "text-blue-400" },
        ].map(({ label, value, sub, icon: Icon, color }) => (
          <div key={label} className="glass-card rounded-2xl p-4">
            <Icon className={`w-5 h-5 ${color} mb-2`} />
            <p className="text-xl font-bold">{value}</p>
            <p className="text-xs font-medium text-foreground">{label}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>
          </div>
        ))}
      </div>

      {/* Search & Filters */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search traders or assets..." className="pl-9 h-10 bg-card border-border" />
          </div>
          <div className="flex gap-2">
            <button onClick={() => setShowFavsOnly(!showFavsOnly)} className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-sm font-medium transition-all ${showFavsOnly ? "border-yellow-500 bg-yellow-500/10 text-yellow-400" : "border-border text-muted-foreground hover:border-primary/40"}`}>
              <Star className={`w-3.5 h-3.5 ${showFavsOnly ? "fill-yellow-400" : ""}`} />Favorites
            </button>
            <button onClick={() => setShowFilters(!showFilters)} className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-sm font-medium transition-all ${showFilters ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/40"}`}>
              <SlidersHorizontal className="w-3.5 h-3.5" />Filters
            </button>
          </div>
        </div>

        <AnimatePresence>
          {showFilters && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
              <div className="flex flex-wrap gap-3 p-4 bg-muted/20 rounded-xl border border-border">
                <div className="flex flex-col gap-1">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Risk Level</p>
                  <div className="flex gap-1.5">
                    {["All","Low","Medium","High"].map(r => (
                      <button key={r} onClick={() => setRiskFilter(r)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${riskFilter === r ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/40"}`}>{r}</button>
                    ))}
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Asset</p>
                  <div className="flex flex-wrap gap-1.5">
                    {ASSET_OPTIONS.map(a => (
                      <button key={a} onClick={() => setAssetFilter(a)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${assetFilter === a ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/40"}`}>{a}</button>
                    ))}
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Sort By</p>
                  <div className="flex gap-1.5 flex-wrap">
                    {([["monthlyRoi","Monthly ROI"],["overallRoi","Overall ROI"],["winRate","Win Rate"],["followers","Followers"],["drawdown","Drawdown"]] as [SortKey,string][]).map(([k, label]) => (
                      <button key={k} onClick={() => { if (sortKey === k) setSortDesc(!sortDesc); else { setSortKey(k); setSortDesc(true); } }} className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${sortKey === k ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/40"}`}>
                        {label}{sortKey === k && (sortDesc ? <TrendingDown className="w-3 h-3" /> : <TrendingUp className="w-3 h-3" />)}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>Showing <span className="font-semibold text-foreground">{filtered.length}</span> traders</span>
          <span className="text-[10px] bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded-full font-semibold">LIVE LEADERBOARD</span>
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
        {filtered.map((t, i) => (
          <motion.div key={t.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
            <TraderCard trader={t} onView={() => setProfileId(t.id)} onCopy={() => setCopyId(t.id)} isFav={favs.has(t.id)} onToggleFav={() => toggleFav(t.id)} />
          </motion.div>
        ))}
        {filtered.length === 0 && (
          <div className="col-span-full text-center py-16 text-muted-foreground">
            <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No traders found</p>
            <p className="text-sm mt-1">Try adjusting your filters</p>
          </div>
        )}
      </div>

      {/* Modals */}
      <AnimatePresence>
        {profile && !copyId && <TraderProfile trader={profile} onClose={() => setProfileId(null)} onCopy={() => { setCopyId(profile.id); setProfileId(null); }} />}
        {copyTrader && <CopyDialog trader={copyTrader} onClose={() => setCopyId(null)} />}
      </AnimatePresence>

      <div className="glass-card rounded-2xl p-4 flex items-start gap-2 text-xs text-muted-foreground">
        <Shield className="w-4 h-4 flex-shrink-0 mt-0.5 text-primary/50" />
        Copy trading involves substantial risk of loss. Past performance does not guarantee future results. This is not financial advice.
      </div>
    </div>
  );
}
