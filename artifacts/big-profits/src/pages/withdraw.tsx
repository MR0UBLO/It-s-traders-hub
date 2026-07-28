import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowUpFromLine, Phone, Banknote, Clock, CheckCircle, Search, Download, Info, RefreshCw, AlertTriangle, Loader2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useGetWallet } from "@workspace/api-client-react";
import { format } from "date-fns";

/* ─── PAYMENT METHODS ────────────────────────────────────────────── */
type WMethod = { id: string; label: string; logo: string; color: string; min: number; max: number; fee: string; time: string; currency: string; type: string };

const USD_RATE = 130; // 1 USD = 130 KES

const WMETHODS: WMethod[] = [
  { id: "mpesa",    label: "M-PESA",         logo: "M",  color: "#00a651", min: 10,  max: 1000, fee: "Free",       time: "Up to 24hrs", currency: "USD", type: "mobile" },
  { id: "airtel",   label: "Airtel Money",   logo: "A",  color: "#e40000", min: 10,  max: 1000, fee: "Free",       time: "Up to 24hrs", currency: "USD", type: "mobile" },
  { id: "visa",     label: "Visa",           logo: "V",  color: "#1a1f71", min: 10,  max: 5000, fee: "1.5%",       time: "3-5 days",    currency: "USD", type: "card"   },
  { id: "master",   label: "Mastercard",     logo: "MC", color: "#eb001b", min: 10,  max: 5000, fee: "1.5%",       time: "3-5 days",    currency: "USD", type: "card"   },
  { id: "bank",     label: "Bank Transfer",  logo: "B",  color: "#2563eb", min: 10,  max: 9999, fee: "Free",       time: "2-5 days",    currency: "USD", type: "bank"   },
  { id: "paypal",   label: "PayPal",         logo: "PP", color: "#003087", min: 10,  max: 1000, fee: "2%",         time: "1-3 days",    currency: "USD", type: "ewallet"},
  { id: "skrill",   label: "Skrill",         logo: "SK", color: "#862165", min: 10,  max: 1000, fee: "1%",         time: "1-3 days",    currency: "USD", type: "ewallet"},
  { id: "neteller", label: "Neteller",       logo: "NE", color: "#c89e1a", min: 10,  max: 1000, fee: "Free",       time: "Instant",     currency: "USD", type: "ewallet"},
  { id: "btc",      label: "Bitcoin (BTC)",  logo: "₿",  color: "#f7931a", min: 10,  max: 9999, fee: "Network fee",time: "10-60min",    currency: "USD", type: "crypto" },
  { id: "eth",      label: "Ethereum (ETH)", logo: "Ξ",  color: "#627eea", min: 10,  max: 9999, fee: "Network fee",time: "5-15min",     currency: "USD", type: "crypto" },
  { id: "usdt",     label: "USDT (TRC20)",   logo: "T",  color: "#26a17b", min: 10,  max: 9999, fee: "Free",       time: "2-5min",      currency: "USD", type: "crypto" },
  { id: "usdc",     label: "USDC",           logo: "U",  color: "#2775ca", min: 10,  max: 9999, fee: "Free",       time: "2-5min",      currency: "USD", type: "crypto" },
  { id: "ltc",      label: "Litecoin (LTC)", logo: "Ł",  color: "#a6a9aa", min: 10,  max: 9999, fee: "Network fee",time: "5-10min",     currency: "USD", type: "crypto" },
  { id: "sol",      label: "Solana (SOL)",   logo: "◎",  color: "#9945ff", min: 10,  max: 9999, fee: "Free",       time: "Under 1min",  currency: "USD", type: "crypto" },
];

type HistItem = { id: string; method: string; amount: number; currency: string; status: "completed"|"pending"|"cancelled"|"failed"; date: Date; txId: string };

function seeded(seed: number, max: number, min = 0) {
  const x = Math.sin(seed + 1) * 43758.5453;
  return min + ((x - Math.floor(x)) * (max - min));
}

const HISTORY: HistItem[] = Array.from({ length: 15 }, (_, i) => {
  const s = i + 1;
  const method = WMETHODS[i % WMETHODS.length].label;
  const amount = Math.round(seeded(s * 7, 50000, 500));
  const cur = WMETHODS[i % WMETHODS.length].currency;
  const statuses: HistItem["status"][] = ["completed","completed","completed","pending","cancelled","failed"];
  const status = statuses[Math.floor(seeded(s * 11, 6))];
  const date = new Date(Date.now() - seeded(s * 13, 86400000 * 30));
  const txId = `WDR${Math.random().toString(36).slice(2,10).toUpperCase()}`;
  return { id: String(s), method, amount, currency: cur, status, date, txId };
});

function StatusBadge({ status }: { status: HistItem["status"] }) {
  const cls = {
    completed: "bg-green-500/10 text-green-400 border-green-500/20",
    pending: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
    cancelled: "bg-muted text-muted-foreground border-border",
    failed: "bg-red-500/10 text-red-400 border-red-500/20",
  }[status];
  return <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${cls}`}>{status}</span>;
}

function MethodCard({ m, selected, onClick }: { m: WMethod; selected: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className={`flex items-center gap-2 p-2.5 rounded-xl border text-left transition-all ${selected ? "border-primary bg-primary/5 shadow-sm" : "border-border bg-card hover:border-primary/40"}`}>
      <div className="w-7 h-7 rounded-lg flex items-center justify-center font-bold text-[10px] text-white flex-shrink-0" style={{ backgroundColor: m.color }}>{m.logo}</div>
      <div className="min-w-0">
        <p className="text-xs font-semibold leading-tight truncate">{m.label}</p>
        <p className="text-[9px] text-muted-foreground">{m.fee} · {m.time}</p>
      </div>
    </button>
  );
}

export default function Withdraw() {
  const { toast } = useToast();
  const { data: wallet } = useGetWallet();
  const [method, setMethod] = useState(WMETHODS[0]);
  const [phone, setPhone]   = useState("254");
  const [amount, setAmount] = useState("");
  const [address, setAddress] = useState("");
  const [account, setAccount] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState("all");

  const balanceKes = wallet ? Number(wallet.balance) : 0;
  const balance = balanceKes / USD_RATE;

  const handleWithdraw = async (e: React.FormEvent) => {
    e.preventDefault();
    const num = Number(amount);
    if (isNaN(num) || num < method.min) { toast({ title: "Invalid amount", description: `Minimum withdrawal is $${method.min} USD${(method.id === "mpesa" || method.id === "airtel") ? ` (KES ${(method.min * USD_RATE).toLocaleString()})` : ""}`, variant: "destructive" }); return; }
    if (method.id === "mpesa") {
      if (!phone.startsWith("254") || phone.length < 12) { toast({ title: "Invalid phone", description: "Format: 254XXXXXXXXX", variant: "destructive" }); return; }
      if (num > balance) { toast({ title: "Insufficient balance", variant: "destructive" }); return; }
    }
    setIsPending(true);
    await new Promise(r => setTimeout(r, 1500));
    setIsPending(false);
    setSubmitted(true);
    toast({ title: "Withdrawal requested!", description: "Your withdrawal is being processed." });
  };

  const filteredHistory = HISTORY.filter(h => {
    const matchSearch = !search || h.method.toLowerCase().includes(search.toLowerCase()) || h.txId.includes(search.toUpperCase());
    const matchStatus = statusFilter === "all" || h.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2"><ArrowUpFromLine className="w-7 h-7 text-primary" />Withdraw</h1>
        <p className="text-muted-foreground mt-1 text-sm">Withdraw your earnings to your preferred payment method.</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
        {/* Left panel */}
        <div className="xl:col-span-2 space-y-4">
          {/* Balance */}
          <div className="glass-card rounded-2xl p-5">
            <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Available Balance</p>
            <p className="text-3xl font-bold font-mono mt-1">${balance.toFixed(2)} <span className="text-lg text-muted-foreground font-normal">USD</span></p>
          </div>

          {/* Method type filter */}
          <div className="flex gap-1 bg-muted/30 rounded-xl p-1">
            {[["all","All"],["mobile","Mobile"],["card","Card"],["bank","Bank"],["ewallet","E-wallet"],["crypto","Crypto"]].map(([v, l]) => (
              <button key={v} onClick={() => setTypeFilter(v)} className={`flex-1 py-1 rounded-lg text-[9px] font-bold transition-all ${typeFilter === v ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}>{l}</button>
            ))}
          </div>

          {/* Methods */}
          <div className="grid grid-cols-2 gap-2">
            {WMETHODS.filter(m => typeFilter === "all" || m.type === typeFilter).map(m => (
              <MethodCard key={m.id} m={m} selected={method.id === m.id} onClick={() => { setMethod(m); setSubmitted(false); setAmount(""); setAddress(""); setAccount(""); }} />
            ))}
          </div>


          {/* Form */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-card rounded-2xl p-5">
            {submitted ? (
              <div className="text-center py-6 space-y-4">
                <div className="w-14 h-14 rounded-full bg-green-500/10 flex items-center justify-center mx-auto"><CheckCircle className="w-7 h-7 text-green-500" /></div>
                <div>
                  <p className="font-bold text-green-500">Withdrawal Requested!</p>
                  <p className="text-muted-foreground text-sm mt-1"><strong>${Number(amount).toLocaleString()} USD</strong> via {method.label}</p>
                  <p className="text-xs text-muted-foreground mt-1">Processing: {method.time}</p>
                </div>
                <Button onClick={() => { setSubmitted(false); setAmount(""); }} variant="outline" className="w-full">New Withdrawal</Button>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs text-white" style={{ backgroundColor: method.color }}>{method.logo}</div>
                  <div>
                    <p className="font-semibold text-sm">{method.label}</p>
                    <p className="text-[10px] text-muted-foreground">Min: ${method.min} USD · Fee: {method.fee}</p>
                  </div>
                </div>

                <form onSubmit={handleWithdraw} className="space-y-4">
                  {/* M-PESA / Airtel */}
                  {(method.id === "mpesa" || method.id === "airtel") && (
                    <div className="space-y-1.5">
                      <Label className="text-sm">{method.id === "mpesa" ? "Safaricom" : "Airtel"} Phone</Label>
                      <Input placeholder={method.id === "mpesa" ? "254712345678" : "0730XXXXXX"} value={phone} onChange={e => setPhone(e.target.value)} className="h-11 bg-background font-mono" />
                    </div>
                  )}

                  {/* Card */}
                  {(method.id === "visa" || method.id === "master") && (
                    <div className="space-y-1.5">
                      <Label className="text-sm">Card Number (Last 4)</Label>
                      <Input placeholder="XXXX" maxLength={4} className="h-11 bg-background font-mono" />
                    </div>
                  )}

                  {/* E-wallets */}
                  {["paypal","skrill","neteller"].includes(method.id) && (
                    <div className="space-y-1.5">
                      <Label className="text-sm">{method.label} Account Email</Label>
                      <Input type="email" placeholder="account@email.com" value={account} onChange={e => setAccount(e.target.value)} className="h-11 bg-background" />
                    </div>
                  )}

                  {/* Bank */}
                  {method.id === "bank" && (
                    <div className="space-y-3">
                      <div className="space-y-1.5"><Label className="text-sm">Bank Name</Label><Input placeholder="Equity Bank" className="h-11 bg-background" /></div>
                      <div className="space-y-1.5"><Label className="text-sm">Account Number</Label><Input placeholder="0123456789" className="h-11 bg-background font-mono" /></div>
                    </div>
                  )}

                  {/* Crypto */}
                  {method.type === "crypto" && (
                    <div className="space-y-1.5">
                      <Label className="text-sm">{method.currency} Wallet Address</Label>
                      <Input placeholder="Enter your wallet address" value={address} onChange={e => setAddress(e.target.value)} className="h-11 bg-background font-mono text-xs" />
                    </div>
                  )}

                  {/* Amount */}
                  <div className="space-y-1.5">
                    <Label className="text-sm flex items-center justify-between">
                      <span>Amount (USD)</span>
                      {method.id === "mpesa" && <button type="button" onClick={() => setAmount(String(Math.min(balance, method.max).toFixed(2)))} className="text-[10px] text-primary hover:underline">Max (${balance.toFixed(2)} USD)</button>}
                    </Label>
                    <Input type="number" placeholder={`Minimum $${method.min}`} value={amount} onChange={e => setAmount(e.target.value)} className="h-11 bg-background font-mono text-lg" />
                    {(method.id === "mpesa" || method.id === "airtel") && amount && Number(amount) > 0 && (
                      <div className="bg-primary/5 border border-primary/20 rounded-lg px-3 py-2 space-y-0.5">
                        <p className="text-xs text-muted-foreground">Equivalent: <span className="font-bold text-foreground">KES {Math.round(Number(amount) * USD_RATE).toLocaleString()}</span></p>
                        <p className="text-[10px] text-muted-foreground">Exchange Rate: 1 USD = {USD_RATE} KES</p>
                      </div>
                    )}
                    {(method.id === "mpesa" || method.id === "airtel") && (!amount || Number(amount) < 10) && (
                      <p className="text-[10px] text-yellow-400">Minimum Withdrawal: $10 USD (KES {(10 * USD_RATE).toLocaleString()})</p>
                    )}
                    <div className="flex gap-2 flex-wrap">
                      {[10, 25, 50, 100].map(a => (
                        <button type="button" key={a} onClick={() => setAmount(String(a))} className="px-3 py-1 text-xs rounded-lg border border-border hover:border-primary/40 hover:text-primary transition-colors">${a}</button>
                      ))}
                    </div>
                  </div>

                  {/* Risk warning */}
                  <div className="flex items-start gap-2 text-[10px] text-muted-foreground bg-muted/20 rounded-lg p-2.5">
                    <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-yellow-400" />
                    Withdrawals are subject to review. Processing time: {method.time}.
                  </div>

                  <Button type="submit" className="w-full h-12 font-semibold text-white text-base" style={{ backgroundColor: method.color }} disabled={isPending}>
                    {isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Processing…</> : `Withdraw via ${method.label}`}
                  </Button>
                </form>
              </>
            )}
          </motion.div>
        </div>

        {/* Right: History */}
        <div className="xl:col-span-3 space-y-4">
          {/* Summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: "Completed", value: HISTORY.filter(h => h.status === "completed").length, color: "text-green-400" },
              { label: "Pending", value: HISTORY.filter(h => h.status === "pending").length, color: "text-yellow-400" },
              { label: "Cancelled", value: HISTORY.filter(h => h.status === "cancelled").length, color: "text-muted-foreground" },
              { label: "Failed", value: HISTORY.filter(h => h.status === "failed").length, color: "text-red-400" },
            ].map(({ label, value, color }) => (
              <div key={label} className="glass-card rounded-2xl p-4 text-center">
                <p className={`text-2xl font-bold ${color}`}>{value}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
              </div>
            ))}
          </div>

          <div className="glass-card rounded-2xl overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 p-4 border-b border-border">
              <p className="font-semibold text-sm">Withdrawal History</p>
              <div className="flex gap-2 flex-wrap">
                {(["all","completed","pending","cancelled","failed"] as const).map(s => (
                  <button key={s} onClick={() => setStatusFilter(s)} className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-all capitalize ${statusFilter === s ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/30"}`}>{s}</button>
                ))}
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
                  <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search…" className="pl-6 pr-3 py-1 h-7 text-[10px] bg-background border border-border rounded-lg outline-none focus:border-primary/50 w-28" />
                </div>
                <button onClick={() => toast({ title: "PDF export coming soon" })} className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition-colors" title="Download PDF"><Download className="w-3.5 h-3.5" /></button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-border/50">
                  {["Date","Method","Amount","Status","Transaction ID"].map(h => <th key={h} className="text-left p-3 text-xs text-muted-foreground font-semibold">{h}</th>)}
                </tr></thead>
                <tbody>
                  {filteredHistory.length === 0 ? (
                    <tr><td colSpan={5} className="text-center py-10 text-muted-foreground text-sm">No withdrawals found</td></tr>
                  ) : filteredHistory.map(h => (
                    <tr key={h.id} className="border-b border-border/40 hover:bg-muted/10 transition-colors">
                      <td className="p-3 text-xs text-muted-foreground">{format(h.date, "MMM d, yy HH:mm")}</td>
                      <td className="p-3 text-xs font-semibold">{h.method}</td>
                      <td className="p-3 font-mono font-bold text-sm">${h.amount.toLocaleString()} <span className="text-muted-foreground font-normal text-xs">USD</span></td>
                      <td className="p-3"><StatusBadge status={h.status} /></td>
                      <td className="p-3 font-mono text-xs text-muted-foreground">{h.txId}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="glass-card rounded-2xl p-4">
            <p className="text-sm font-semibold mb-3">Withdrawal Info</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              {[
                { icon: Clock, label: "Processing Time", value: method.time },
                { icon: Banknote, label: "Minimum Amount", value: `$${method.min} USD${(method.id === "mpesa" || method.id === "airtel") ? ` (KES ${(method.min * USD_RATE).toLocaleString()})` : ""}` },
                { icon: Phone, label: "Method", value: method.label },
                { icon: Info, label: "Fee", value: method.fee },
              ].map(({ icon: Icon, label, value }) => (
                <div key={label} className="flex items-center gap-2 p-2.5 bg-muted/20 rounded-xl">
                  <Icon className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  <span className="text-muted-foreground">{label}:</span>
                  <span className="font-semibold">{value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
