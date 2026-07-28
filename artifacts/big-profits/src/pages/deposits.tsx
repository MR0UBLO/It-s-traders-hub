import { useGetDeposits, getGetDepositsQueryKey } from "@workspace/api-client-react";
import { useAccountStore } from "@/store/account-store";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect, useRef } from "react";
import { format } from "date-fns";
import { Loader2, CheckCircle2, XCircle, Clock, Smartphone, RefreshCw, Search, Download, Filter, ChevronDown, Info } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { motion, AnimatePresence } from "framer-motion";

/* ─── PAYMENT METHODS ────────────────────────────────────────────── */
type PayMethod = {
  id: string; label: string; logo: string; color: string; min: number; max: number;
  fee: string; time: string; currency: string; type: "mobile"|"card"|"bank"|"crypto";
  sim?: boolean;
};

const USD_RATE = 130; // 1 USD = 130 KES

const METHODS: PayMethod[] = [
  { id: "mpesa",    label: "M-PESA",         logo: "M",  color: "#00a651", min: 10,  max: 1000, fee: "Free",  time: "Instant",    currency: "USD", type: "mobile" },
  { id: "airtel",   label: "Airtel Money",   logo: "A",  color: "#e40000", min: 10,  max: 1000, fee: "Free",  time: "Instant",    currency: "USD", type: "mobile" },
  { id: "visa",     label: "Visa",           logo: "V",  color: "#1a1f71", min: 10,  max: 5000, fee: "1.5%",  time: "Instant",    currency: "USD", type: "card"   },
  { id: "master",   label: "Mastercard",     logo: "MC", color: "#eb001b", min: 10,  max: 5000, fee: "1.5%",  time: "Instant",    currency: "USD", type: "card"   },
  { id: "bank",     label: "Bank Transfer",  logo: "B",  color: "#2563eb", min: 10,  max: 9999, fee: "Free",  time: "1-2 days",   currency: "USD", type: "bank"   },
  { id: "paypal",   label: "PayPal",         logo: "PP", color: "#003087", min: 10,  max: 1000, fee: "2%",    time: "Instant",    currency: "USD", type: "card"   },
  { id: "skrill",   label: "Skrill",         logo: "SK", color: "#862165", min: 10,  max: 1000, fee: "1%",    time: "Instant",    currency: "USD", type: "card"   },
  { id: "neteller", label: "Neteller",       logo: "NE", color: "#c89e1a", min: 10,  max: 1000, fee: "Free",  time: "Instant",    currency: "USD", type: "card"   },
  { id: "pm",       label: "Perfect Money",  logo: "PM", color: "#004f9f", min: 10,  max: 500,  fee: "0.5%",  time: "Instant",    currency: "USD", type: "card"   },
  { id: "btc",      label: "Bitcoin (BTC)",  logo: "₿",  color: "#f7931a", min: 10,  max: 9999, fee: "Free",  time: "10-60min",   currency: "USD", type: "crypto" },
  { id: "eth",      label: "Ethereum (ETH)", logo: "Ξ",  color: "#627eea", min: 10,  max: 9999, fee: "Free",  time: "5-15min",    currency: "USD", type: "crypto" },
  { id: "usdttrc",  label: "USDT (TRC20)",   logo: "T",  color: "#26a17b", min: 10,  max: 9999, fee: "Free",  time: "2-5min",     currency: "USD", type: "crypto" },
  { id: "usdterc",  label: "USDT (ERC20)",   logo: "T",  color: "#26a17b", min: 10,  max: 9999, fee: "Free",  time: "5-15min",    currency: "USD", type: "crypto" },
  { id: "usdc",     label: "USDC",           logo: "U",  color: "#2775ca", min: 10,  max: 9999, fee: "Free",  time: "2-5min",     currency: "USD", type: "crypto" },
  { id: "ltc",      label: "Litecoin (LTC)", logo: "Ł",  color: "#a6a9aa", min: 10,  max: 9999, fee: "Free",  time: "5-10min",    currency: "USD", type: "crypto" },
  { id: "sol",      label: "Solana (SOL)",   logo: "◎",  color: "#9945ff", min: 10,  max: 9999, fee: "Free",  time: "Under 1min", currency: "USD", type: "crypto" },
];

const QUICK_AMOUNTS = [10, 25, 50, 100, 250, 500];

type DepositState = "idle"|"pending"|"completed"|"failed";

/* ─── METHOD CARD ────────────────────────────────────────────────── */
function MethodCard({ m, selected, onClick }: { m: PayMethod; selected: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className={`flex flex-col gap-1 p-3 rounded-xl border text-left transition-all ${selected ? "border-primary bg-primary/5 shadow-sm" : "border-border bg-card hover:border-primary/40"}`}>
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs text-white flex-shrink-0" style={{ backgroundColor: m.color }}>{m.logo}</div>
        <p className="text-xs font-semibold leading-tight">{m.label}</p>
      </div>
      <div className="text-[9px] text-muted-foreground space-y-0.5 pl-0.5">
        <p>Fee: {m.fee} · {m.time}</p>
        <p>Min: {m.min} {m.currency}</p>
      </div>
    </button>
  );
}

/* ─── CRYPTO ADDRESS DISPLAY ─────────────────────────────────────── */
const CRYPTO_ADDRESSES: Record<string, string> = {
  btc:     "1A1zP1eP5QGefi2DMPTfTL5SLmv7Divf8N",
  eth:     "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
  usdttrc: "TQn9Y2khEsLJW1ChVWFMSMeRDow5KcbLSE",
  usdterc: "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
  usdc:    "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
  ltc:     "LQ3Kng1eLGMmLuSTqRmhwKMqHcSmMXSGX8",
  sol:     "9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin",
};

/* ─── MAIN ─────────────────────────────────────────────────────────── */
export default function Deposits() {
  const { mode } = useAccountStore();
  const { data: deposits, isLoading, refetch: refetchDeposits } = useGetDeposits({ account: mode }, { query: { queryKey: [] } });
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { token } = useAuth();

  const [method, setMethod]       = useState<PayMethod>(METHODS[0]);
  const [phone, setPhone]         = useState("254");
  const [amount, setAmount]       = useState("");
  const [isSending, setIsSending] = useState(false);
  const [depositState, setDepositState] = useState<DepositState>("idle");
  const [checkoutRequestId, setCheckoutRequestId] = useState<string | null>(null);
  const [pendingAmount, setPendingAmount] = useState(0);
  const [receipt, setReceipt]     = useState<string | null>(null);
  const [search, setSearch]       = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = () => { if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; } };
  useEffect(() => () => stopPolling(), []);

  const startPolling = (cid: string) => {
    stopPolling();
    pollingRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/mpesa/status/${cid}`, { headers: { Authorization: `Bearer ${token}` } });
        if (!res.ok) return;
        const data = await res.json();
        if (data.status === "completed") {
          stopPolling(); setDepositState("completed"); setReceipt(data.mpesaReceiptNumber || null);
          queryClient.invalidateQueries({ queryKey: getGetDepositsQueryKey({ account: mode }) }); refetchDeposits();
          toast({ title: "Payment confirmed!", description: `$${(Number(data.amount) / USD_RATE).toFixed(2)} USD added to your wallet.` });
        } else if (data.status === "failed") {
          stopPolling(); setDepositState("failed");
          toast({ title: "Payment failed", description: "The M-PESA transaction was cancelled or failed.", variant: "destructive" });
        }
      } catch {}
    }, 3000);
  };

  const handlePhoneChange = (val: string) => {
    const digits = val.replace(/\D/g, "");
    if (!digits.startsWith("254")) setPhone("254" + digits.replace(/^254/, ""));
    else setPhone(digits);
  };

  const handleMpesaDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = Number(amount);
    if (isNaN(numAmount) || numAmount < 10) { toast({ title: "Invalid amount", description: "Minimum deposit is $10 USD (KES 1,300)", variant: "destructive" }); return; }
    if (phone.length < 12) { toast({ title: "Invalid phone", description: "Enter a valid Safaricom number", variant: "destructive" }); return; }
    setIsSending(true);
    try {
      const kesAmount = Math.round(numAmount * USD_RATE);
      const res = await fetch("/api/mpesa/stkpush", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ phone, amount: kesAmount }) });
      const data = await res.json();
      if (!res.ok) { toast({ title: "Deposit failed", description: data.error || "Please try again.", variant: "destructive" }); return; }
      setPendingAmount(numAmount); setCheckoutRequestId(data.checkoutRequestId);
      setDepositState("pending"); startPolling(data.checkoutRequestId);
      toast({ title: "Check your phone!", description: data.message });
      setAmount("");
    } catch { toast({ title: "Network error", description: "Please check your connection and try again.", variant: "destructive" }); }
    finally { setIsSending(false); }
  };

  const handleSimDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = Number(amount);
    if (isNaN(numAmount) || numAmount < method.min) { toast({ title: "Invalid amount", description: `Minimum deposit is $${method.min} USD${(method.id === "mpesa" || method.id === "airtel") ? ` (KES ${(method.min * USD_RATE).toLocaleString()})` : ""}`, variant: "destructive" }); return; }
    setIsSending(true);
    await new Promise(r => setTimeout(r, 1500));
    setPendingAmount(numAmount); setDepositState("completed");
    toast({ title: "Request received!", description: `Your $${numAmount} USD deposit request has been submitted.` });
    setAmount(""); setIsSending(false);
  };

  const handleReset = () => { stopPolling(); setDepositState("idle"); setCheckoutRequestId(null); setReceipt(null); };

  const isCrypto = method.type === "crypto";
  const cryptoAddr = CRYPTO_ADDRESSES[method.id];

  const filteredDeposits = deposits?.filter(d => {
    if (!search) return true;
    return d.mpesaReceiptNumber?.includes(search) || String(d.amount).includes(search);
  });

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Deposit</h1>
        <p className="text-muted-foreground mt-1 text-sm">Fund your wallet using your preferred payment method.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Left: method picker + form */}
        <div className="lg:col-span-2 space-y-4">
          {/* Method type filter */}
          <div className="flex gap-1 bg-muted/30 rounded-xl p-1">
            {[["all","All"],["mobile","Mobile"],["card","Card/E-wallet"],["bank","Bank"],["crypto","Crypto"]].map(([v, l]) => (
              <button key={v} onClick={() => setTypeFilter(v)} className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold transition-all ${typeFilter === v ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}>{l}</button>
            ))}
          </div>

          {/* Method grid */}
          <div className="grid grid-cols-2 gap-2">
            {METHODS.filter(m => typeFilter === "all" || m.type === typeFilter).map(m => (
              <MethodCard key={m.id} m={m} selected={method.id === m.id} onClick={() => { setMethod(m); setDepositState("idle"); setAmount(""); }} />
            ))}
          </div>

          {method.sim && (
            <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/30 border border-border rounded-xl p-3">
              <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
              <span>{method.label} deposits are processed manually. Contact support after submitting.</span>
            </div>
          )}

          {/* Form */}
          <Card className="border-border">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs text-white" style={{ backgroundColor: method.color }}>{method.logo}</div>
                <div>
                  <CardTitle className="text-base">{method.label} Deposit</CardTitle>
                  <CardDescription className="text-xs">Min: {method.min} {method.currency} · Fee: {method.fee}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {depositState === "idle" && (
                <>
                  {/* M-PESA */}
                  {method.id === "mpesa" && (
                    <form onSubmit={handleMpesaDeposit} className="space-y-4">
                      <div className="space-y-1.5">
                        <Label className="text-sm">Safaricom Phone</Label>
                        <Input placeholder="0712 345 678" value={phone} onChange={e => handlePhoneChange(e.target.value)} maxLength={13} className="h-11 bg-card border-border font-mono" />
                        <p className="text-xs text-muted-foreground">07XX or 254 prefix</p>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-sm">Deposit Amount (USD)</Label>
                        <Input type="number" placeholder="10" value={amount} onChange={e => setAmount(e.target.value)} min={10} className="h-11 bg-card border-border font-mono text-lg" />
                        {amount && Number(amount) > 0 && (
                          <div className="bg-green-500/5 border border-green-500/20 rounded-lg px-3 py-2 space-y-0.5">
                            <p className="text-xs text-muted-foreground">Equivalent: <span className="font-bold text-foreground">KES {(Number(amount) * USD_RATE).toLocaleString()}</span></p>
                            <p className="text-[10px] text-muted-foreground">Exchange Rate: 1 USD = {USD_RATE} KES</p>
                          </div>
                        )}
                        {(!amount || Number(amount) < 10) && (
                          <p className="text-[10px] text-yellow-400">Minimum Deposit: $10 USD (KES {(10 * USD_RATE).toLocaleString()})</p>
                        )}
                        <div className="grid grid-cols-3 gap-1.5 pt-1">
                          {QUICK_AMOUNTS.map(q => (
                            <button key={q} type="button" onClick={() => setAmount(String(q))} className={`text-xs py-1.5 rounded border transition-colors ${amount === String(q) ? "border-green-500 bg-green-500/10 text-green-500 font-semibold" : "border-border bg-card text-muted-foreground hover:border-green-500/50"}`}>${q}</button>
                          ))}
                        </div>
                      </div>
                      <Button type="submit" className="w-full h-11 bg-green-600 hover:bg-green-700 text-white font-semibold" disabled={isSending || !amount || Number(amount) < 10}>
                        {isSending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Sending…</> : "Pay with M-PESA"}
                      </Button>
                    </form>
                  )}

                  {/* Crypto */}
                  {isCrypto && (
                    <div className="space-y-4">
                      <div className="bg-muted/30 rounded-xl p-4 text-center space-y-3">
                        <p className="text-xs text-muted-foreground">Send {method.currency} to this address</p>
                        <div className="w-24 h-24 bg-white rounded-xl mx-auto flex items-center justify-center text-4xl font-bold" style={{ color: method.color }}>{method.logo}</div>
                        <div className="bg-background border border-border rounded-lg p-2">
                          <p className="font-mono text-[10px] break-all text-foreground">{cryptoAddr}</p>
                        </div>
                        <button onClick={() => { navigator.clipboard.writeText(cryptoAddr); toast({ title: "Address copied!" }); }} className="text-xs text-primary hover:underline">Copy Address</button>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-sm">Amount ({method.currency})</Label>
                        <Input type="number" placeholder={`Min ${method.min}`} value={amount} onChange={e => setAmount(e.target.value)} className="h-11 bg-card font-mono" />
                      </div>
                      <Button onClick={handleSimDeposit as any} className="w-full h-11 font-semibold" style={{ backgroundColor: method.color }} disabled={isSending}>
                        {isSending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Processing…</> : `Confirm ${method.label} Deposit`}
                      </Button>
                      <p className="text-[10px] text-muted-foreground text-center flex items-center justify-center gap-1"><Info className="w-3 h-3" />Processing: {method.time}</p>
                    </div>
                  )}

                  {/* All other methods */}
                  {!isCrypto && method.id !== "mpesa" && (
                    <form onSubmit={handleSimDeposit} className="space-y-4">
                      {(method.type === "card" || method.id === "paypal" || method.id === "skrill" || method.id === "neteller" || method.id === "pm") && (
                        <div className="space-y-3">
                          {method.type === "card" && <>
                            <div className="space-y-1.5">
                              <Label className="text-sm">Card Number</Label>
                              <Input placeholder="1234 5678 9012 3456" className="h-11 bg-card font-mono" />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              <div className="space-y-1.5"><Label className="text-sm">Expiry</Label><Input placeholder="MM/YY" className="h-11 bg-card font-mono" /></div>
                              <div className="space-y-1.5"><Label className="text-sm">CVV</Label><Input placeholder="123" className="h-11 bg-card font-mono" /></div>
                            </div>
                          </>}
                          {["paypal","skrill","neteller","pm","airtel"].includes(method.id) && (
                            <div className="space-y-1.5">
                              <Label className="text-sm">{method.id === "airtel" ? "Airtel Phone" : "Account Email/ID"}</Label>
                              <Input placeholder={method.id === "airtel" ? "0730XXXXXX" : "account@email.com"} className="h-11 bg-card font-mono" />
                            </div>
                          )}
                        </div>
                      )}
                      {method.id === "bank" && (
                        <div className="bg-muted/30 rounded-xl p-4 space-y-2 text-sm">
                          <p className="font-semibold">Bank Transfer Details</p>
                          {[["Bank","Equity Bank Kenya"],["Account Name","TradersHub Limited"],["Account No.","0123456789"],["Branch","Westlands"],["Swift Code","EQBLKENA"]].map(([l,v]) => (
                            <div key={l} className="flex justify-between text-xs"><span className="text-muted-foreground">{l}</span><span className="font-semibold">{v}</span>
                          </div>))}
                        </div>
                      )}
                      <div className="space-y-1.5">
                        <Label className="text-sm">Deposit Amount (USD)</Label>
                        <Input type="number" placeholder={`Min $${method.min}`} value={amount} onChange={e => setAmount(e.target.value)} className="h-11 bg-card font-mono text-lg" />
                        {(method.id === "airtel") && amount && Number(amount) > 0 && (
                          <div className="bg-primary/5 border border-primary/20 rounded-lg px-3 py-2 space-y-0.5">
                            <p className="text-xs text-muted-foreground">Equivalent: <span className="font-bold text-foreground">KES {(Number(amount) * USD_RATE).toLocaleString()}</span></p>
                            <p className="text-[10px] text-muted-foreground">Exchange Rate: 1 USD = {USD_RATE} KES</p>
                          </div>
                        )}
                        {(method.id === "airtel") && (!amount || Number(amount) < 10) && (
                          <p className="text-[10px] text-yellow-400">Minimum Deposit: $10 USD (KES {(10 * USD_RATE).toLocaleString()})</p>
                        )}
                      </div>
                      <Button type="submit" className="w-full h-11 font-semibold text-white" style={{ backgroundColor: method.color }} disabled={isSending || !amount || Number(amount) < method.min}>
                        {isSending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Processing…</> : `Deposit via ${method.label}`}
                      </Button>
                    </form>
                  )}
                </>
              )}

              {/* M-PESA pending */}
              {depositState === "pending" && (
                <div className="text-center space-y-5 py-4">
                  <div className="w-16 h-16 rounded-full bg-yellow-500/10 border-2 border-yellow-500/30 flex items-center justify-center mx-auto"><Smartphone className="w-7 h-7 text-yellow-500 animate-pulse" /></div>
                  <div><p className="font-semibold">Check your phone</p><p className="text-muted-foreground text-sm mt-1">STK push sent to <span className="font-mono font-medium">{phone}</span></p></div>
                  <div className="bg-card border border-border rounded-lg p-4 space-y-1"><p className="text-xs text-muted-foreground">Amount</p><p className="text-2xl font-bold font-mono">${pendingAmount.toLocaleString()} USD</p><p className="text-xs text-muted-foreground">≈ KES {(pendingAmount * USD_RATE).toLocaleString()}</p></div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground justify-center"><Loader2 className="w-3.5 h-3.5 animate-spin" />Waiting for confirmation…</div>
                  <button onClick={handleReset} className="text-xs text-muted-foreground hover:text-foreground underline">Cancel</button>
                </div>
              )}

              {/* Completed */}
              {depositState === "completed" && (
                <div className="text-center space-y-5 py-4">
                  <div className="w-16 h-16 rounded-full bg-green-500/10 border-2 border-green-500/30 flex items-center justify-center mx-auto"><CheckCircle2 className="w-8 h-8 text-green-500" /></div>
                  <div><p className="font-semibold text-green-500">Payment Confirmed!</p><p className="text-muted-foreground text-sm mt-1"><span className="font-bold text-foreground">{pendingAmount} {method.currency}</span> added to your wallet.</p></div>
                  {receipt && <div className="bg-card border border-border rounded-lg p-3"><p className="text-xs text-muted-foreground">Receipt</p><p className="font-mono font-bold text-sm">{receipt}</p></div>}
                  <Button onClick={handleReset} variant="outline" className="w-full">Make another deposit</Button>
                </div>
              )}

              {/* Failed */}
              {depositState === "failed" && (
                <div className="text-center space-y-5 py-4">
                  <div className="w-16 h-16 rounded-full bg-red-500/10 border-2 border-red-500/30 flex items-center justify-center mx-auto"><XCircle className="w-8 h-8 text-red-500" /></div>
                  <div><p className="font-semibold text-red-500">Payment Failed</p><p className="text-muted-foreground text-sm mt-1">Transaction was cancelled or timed out.</p></div>
                  <Button onClick={handleReset} variant="outline" className="w-full">Try again</Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right: History */}
        <div className="lg:col-span-3 space-y-4">
          {/* Summary */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Total Deposits", value: deposits ? deposits.filter(d => d.status === "completed").length : 0, sub: "Completed" },
              { label: "Total Amount", value: deposits ? `$${(deposits.filter(d => d.status === "completed").reduce((a, d) => a + Number(d.amount), 0) / USD_RATE).toFixed(2)} USD` : "—", sub: "Deposited" },
              { label: "Pending", value: deposits ? deposits.filter(d => d.status === "pending").length : 0, sub: "In progress" },
            ].map(({ label, value, sub }) => (
              <div key={label} className="glass-card rounded-2xl p-4 text-center">
                <p className="text-xl font-bold">{value}</p>
                <p className="text-xs font-medium text-foreground">{label}</p>
                <p className="text-[10px] text-muted-foreground">{sub}</p>
              </div>
            ))}
          </div>

          <Card className="border-border">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <CardTitle className="text-base">Transaction History</CardTitle>
                <div className="flex gap-2">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                    <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search…" className="pl-8 pr-3 py-1.5 h-8 text-xs bg-background border border-border rounded-lg outline-none focus:border-primary/50 w-36" />
                  </div>
                  <button onClick={() => refetchDeposits()} className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition-colors" title="Refresh"><RefreshCw className="w-3.5 h-3.5" /></button>
                  <button onClick={() => toast({ title: "Receipt download coming soon" })} className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition-colors" title="Download"><Download className="w-3.5 h-3.5" /></button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="border-border">
                    <TableHead className="pl-6 text-xs">Date</TableHead>
                    <TableHead className="text-xs">Amount</TableHead>
                    <TableHead className="text-xs">Method</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                    <TableHead className="pr-6 text-xs">Reference</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-8"><Loader2 className="w-4 h-4 animate-spin mx-auto" /></TableCell></TableRow>
                  ) : filteredDeposits && filteredDeposits.length > 0 ? (
                    filteredDeposits.map(dep => (
                      <TableRow key={dep.id} className="border-border hover:bg-muted/20 transition-colors">
                        <TableCell className="pl-6 text-muted-foreground text-xs">{format(new Date(dep.createdAt), "MMM d, yy HH:mm")}</TableCell>
                        <TableCell className="font-mono font-bold text-sm">${(Number(dep.amount) / USD_RATE).toFixed(2)} <span className="text-muted-foreground font-normal text-xs">USD</span></TableCell>
                        <TableCell className="text-xs text-muted-foreground">M-PESA</TableCell>
                        <TableCell>
                          <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${dep.status === "completed" ? "bg-green-500/10 text-green-500" : dep.status === "failed" ? "bg-red-500/10 text-red-500" : "bg-yellow-500/10 text-yellow-500"}`}>
                            {dep.status === "completed" && <CheckCircle2 className="w-3 h-3" />}
                            {dep.status === "failed" && <XCircle className="w-3 h-3" />}
                            {dep.status === "pending" && <Clock className="w-3 h-3" />}
                            {dep.status}
                          </span>
                        </TableCell>
                        <TableCell className="pr-6 font-mono text-xs text-muted-foreground">{dep.mpesaReceiptNumber || "—"}</TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow><TableCell colSpan={5} className="text-center py-12 text-muted-foreground text-sm">No deposit history yet.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
