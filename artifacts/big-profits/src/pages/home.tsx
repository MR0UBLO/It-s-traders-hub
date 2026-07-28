import { Link } from "wouter";
import { motion, useInView } from "framer-motion";
import { useRef, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  TrendingUp, BarChart2, Users, Shield, Zap, Globe,
  ChevronDown, Bot, ArrowRight, Star,
} from "lucide-react";

/* ---------- animated counter ---------- */
function Counter({ to, prefix = "", suffix = "" }: { to: number; prefix?: string; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!inView) return;
    let start = 0;
    const step = to / 60;
    const id = setInterval(() => {
      start += step;
      if (start >= to) { setVal(to); clearInterval(id); }
      else setVal(Math.floor(start));
    }, 16);
    return () => clearInterval(id);
  }, [inView, to]);
  return <span ref={ref}>{prefix}{val.toLocaleString()}{suffix}</span>;
}

/* ---------- animated chart SVG ---------- */
function AnimatedChart({ color, delay = 0 }: { color: string; delay?: number }) {
  return (
    <motion.svg viewBox="0 0 200 60" className="w-full h-12 opacity-60" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 2, delay, ease: "easeOut" }}>
      <motion.path
        d="M0,50 L25,40 L50,45 L75,25 L100,30 L125,15 L150,20 L175,10 L200,5"
        fill="none" stroke={color} strokeWidth="2" strokeLinecap="round"
        initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
        transition={{ duration: 2.5, delay, ease: "easeOut" }}
      />
    </motion.svg>
  );
}

/* ---------- floating market card ---------- */
function MarketCard({ symbol, price, change, color, delay }: { symbol: string; price: string; change: string; color: string; positive: boolean; delay: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.6 }}
      className="glass-card rounded-2xl p-4 min-w-[160px]"
    >
      <div className="flex items-center gap-2 mb-2">
        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
        <span className="text-xs font-bold text-muted-foreground">{symbol}</span>
      </div>
      <p className="text-xl font-bold font-mono">{price}</p>
      <AnimatedChart color={color} delay={delay + 0.3} />
      <span className="text-xs font-semibold text-green-500">{change}</span>
    </motion.div>
  );
}

/* ---------- FAQ item ---------- */
function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-border last:border-0">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between py-4 text-left gap-4 group">
        <span className="font-medium group-hover:text-primary transition-colors">{q}</span>
        <motion.div animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" />
        </motion.div>
      </button>
      <motion.div
        initial={false}
        animate={{ height: open ? "auto" : 0, opacity: open ? 1 : 0 }}
        transition={{ duration: 0.25 }}
        className="overflow-hidden"
      >
        <p className="text-muted-foreground text-sm pb-4 leading-relaxed">{a}</p>
      </motion.div>
    </div>
  );
}

const FAQS = [
  { q: "Is TradersHub free to use?", a: "Yes. Creating an account is completely free. You deposit real funds via M-PESA and start trading instantly." },
  { q: "How does profit and loss work?", a: "When you open a position, your entry price is locked in at the live market rate. P/L is calculated in real time as the market moves. When you close, the net result is applied to your balance." },
  { q: "How do I deposit funds?", a: "Go to the Deposit page, enter your M-PESA phone and amount. You'll receive an STK push on your phone. Funds credit instantly." },
  { q: "What is copy trading?", a: "Copy trading automatically mirrors the trades of top-ranked traders. Navigate to Copy Trading, find a trader, and click Follow." },
  { q: "Is my money safe?", a: "Your wallet balance is stored securely and only modified server-side. All accounts are OTP-verified. Withdrawals are processed within 24 hours." },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col overflow-x-hidden">
      {/* ── NAV ── */}
      <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-white" />
            </div>
            <span className="text-lg font-bold tracking-tight">TradersHub</span>
          </div>
          <nav className="hidden md:flex items-center gap-6 text-sm text-muted-foreground">
            {["Features", "Markets", "AI Signals", "FAQ"].map((item) => (
              <a key={item} href={`#${item.toLowerCase().replace(" ", "-")}`} className="hover:text-foreground transition-colors">{item}</a>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            <Link href="/login"><Button variant="ghost" size="sm" className="text-muted-foreground">Log In</Button></Link>
            <Link href="/register"><Button size="sm" className="bg-primary hover:bg-primary/90 text-white font-semibold px-5">Get Started</Button></Link>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* ── HERO ── */}
        <section className="relative min-h-[90vh] flex items-center overflow-hidden">
          {/* Background glow */}
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-primary/5 rounded-full blur-[120px] pointer-events-none" />
          <div className="absolute top-1/3 left-1/4 w-[300px] h-[300px] bg-blue-500/5 rounded-full blur-[80px] pointer-events-none" />

          <div className="container mx-auto px-6 py-20 relative z-10">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <div className="space-y-7">
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
                  <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 text-primary text-xs font-semibold px-3 py-1.5 rounded-full mb-6">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                    AI-Powered Trading Signals — Live Now
                  </div>
                  <h1 className="text-5xl md:text-6xl font-bold tracking-tight leading-[1.1]">
                    Trade like a<br />
                    <span className="text-primary">professional.</span>
                  </h1>
                </motion.div>
                <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15, duration: 0.5 }} className="text-lg text-muted-foreground leading-relaxed max-w-lg">
                  TradersHub gives you a professional trading terminal, real-time AI signals, M-PESA deposits, and copy trading — all in one platform.
                </motion.p>
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25, duration: 0.5 }} className="flex flex-wrap gap-3">
                  <Link href="/register">
                    <Button size="lg" className="bg-primary hover:bg-primary/90 text-white font-semibold px-8 h-12 gap-2">
                      Start Trading Free <ArrowRight className="w-4 h-4" />
                    </Button>
                  </Link>
                  <Link href="/login">
                    <Button size="lg" variant="outline" className="px-8 h-12 border-border hover:bg-accent">
                      View Dashboard
                    </Button>
                  </Link>
                </motion.div>
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }} className="flex items-center gap-1 text-xs text-muted-foreground">
                  {[...Array(5)].map((_, i) => <Star key={i} className="w-3.5 h-3.5 fill-yellow-500 text-yellow-500" />)}
                  <span className="ml-1.5">Trusted by 50,000+ traders</span>
                </motion.div>
              </div>

              {/* Floating market cards */}
              <div className="hidden lg:grid grid-cols-2 gap-4">
                <MarketCard symbol="XAUUSD" price="2,847.50" change="+1.24%" color="#F59E0B" positive={true} delay={0.3} />
                <MarketCard symbol="BTCUSD" price="97,420" change="+2.87%" color="#F97316" positive={true} delay={0.5} />
                <MarketCard symbol="EURUSD" price="1.0842" change="+0.31%" color="#6366F1" positive={true} delay={0.7} />
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.9 }} className="glass-card rounded-2xl p-4 flex flex-col items-center justify-center gap-2">
                  <Bot className="w-8 h-8 text-primary" />
                  <p className="text-sm font-semibold">AI Signal</p>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/10 text-green-500 font-bold">BUY XAUUSD ↑87%</span>
                </motion.div>
              </div>
            </div>
          </div>
        </section>

        {/* ── STATS ── */}
        <section className="border-y border-border bg-card/30 py-12">
          <div className="container mx-auto px-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
              {[
                { to: 50000, suffix: "+", label: "Active Traders" },
                { to: 2400000000, prefix: "KES ", suffix: "+", label: "Volume Traded" },
                { to: 99, suffix: ".9%", label: "Uptime" },
                { to: 3, suffix: " Markets", label: "Live Assets" },
              ].map(({ to, prefix, suffix, label }) => (
                <div key={label}>
                  <p className="text-3xl font-bold text-primary mb-1">
                    <Counter to={to} prefix={prefix} suffix={suffix} />
                  </p>
                  <p className="text-sm text-muted-foreground">{label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── FEATURES ── */}
        <section id="features" className="py-24 px-6">
          <div className="container mx-auto max-w-6xl">
            <div className="text-center mb-14">
              <h2 className="text-3xl font-bold tracking-tight">Everything you need to trade</h2>
              <p className="text-muted-foreground mt-3 max-w-xl mx-auto">A complete fintech ecosystem built for modern traders.</p>
            </div>
            <div className="grid md:grid-cols-3 gap-5">
              {[
                { icon: BarChart2, title: "Real-time Charts", desc: "TradingView-powered charts with XAUUSD, EURUSD & BTCUSD live prices refreshing every 3 seconds.", color: "text-blue-400" },
                { icon: Bot, title: "AI Trading Signals", desc: "Machine-learning signals with confidence scores, entry, target and stop-loss levels.", color: "text-primary" },
                { icon: Users, title: "Copy Trading", desc: "Browse the leaderboard and automatically mirror trades of top-ranked traders.", color: "text-purple-400" },
                { icon: Globe, title: "M-PESA Deposits", desc: "Fund your account instantly via Safaricom M-PESA STK Push — no bank account needed.", color: "text-green-500" },
                { icon: Shield, title: "OTP Verified Accounts", desc: "Every account is email-verified with a 6-digit OTP. Your funds are always protected.", color: "text-yellow-500" },
                { icon: Zap, title: "Instant Execution", desc: "Zero-latency execution. Open and close positions in milliseconds.", color: "text-orange-400" },
              ].map(({ icon: Icon, title, desc, color }, i) => (
                <motion.div
                  key={title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.07 }}
                  className="glass-card p-6 rounded-2xl group hover:border-primary/20 transition-all duration-300"
                >
                  <div className={`w-10 h-10 rounded-xl bg-current/10 flex items-center justify-center mb-4 ${color}`} style={{ backgroundColor: "rgba(255,255,255,0.04)" }}>
                    <Icon className={`w-5 h-5 ${color}`} />
                  </div>
                  <h3 className="font-semibold mb-2">{title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ── AI SECTION ── */}
        <section id="ai-signals" className="py-20 px-6 border-y border-border bg-card/20">
          <div className="container mx-auto max-w-5xl">
            <div className="grid md:grid-cols-2 gap-12 items-center">
              <div className="space-y-5">
                <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 text-primary text-xs font-semibold px-3 py-1.5 rounded-full">
                  <Bot className="w-3.5 h-3.5" /> Powered by Machine Learning
                </div>
                <h2 className="text-3xl font-bold tracking-tight">AI signals that give you the edge</h2>
                <p className="text-muted-foreground leading-relaxed">Our AI analyses price patterns, volume, and momentum across all markets to generate high-confidence buy/sell signals — updated in real time.</p>
                <ul className="space-y-3 text-sm">
                  {["Confidence score (0–100%) for each signal", "Entry, target & stop-loss levels included", "1H, 4H and 1D timeframe signals", "63% historical win rate over 30 days"].map((item) => (
                    <li key={item} className="flex items-center gap-2 text-muted-foreground">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                      {item}
                    </li>
                  ))}
                </ul>
                <Link href="/register">
                  <Button className="bg-primary hover:bg-primary/90 text-white gap-2">
                    Try AI Signals <ArrowRight className="w-4 h-4" />
                  </Button>
                </Link>
              </div>
              <div className="glass-card rounded-2xl p-6 space-y-4">
                {[
                  { symbol: "XAUUSD", dir: "BUY", conf: 87, color: "text-green-500" },
                  { symbol: "BTCUSD", dir: "BUY", conf: 74, color: "text-green-500" },
                  { symbol: "EURUSD", dir: "SELL", conf: 68, color: "text-red-500" },
                ].map(({ symbol, dir, conf, color }) => (
                  <div key={symbol} className="flex items-center justify-between bg-background/40 rounded-xl p-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg ${dir === "BUY" ? "bg-green-500/10" : "bg-red-500/10"} flex items-center justify-center`}>
                        <TrendingUp className={`w-4 h-4 ${color}`} />
                      </div>
                      <div>
                        <p className="font-bold text-sm">{symbol}</p>
                        <p className={`text-xs font-semibold ${color}`}>{dir}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground mb-1">Confidence</p>
                      <div className="flex items-center gap-2">
                        <div className="w-20 h-1.5 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-primary rounded-full" style={{ width: `${conf}%` }} />
                        </div>
                        <span className="text-xs font-bold">{conf}%</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── FAQ ── */}
        <section id="faq" className="py-24 px-6">
          <div className="container mx-auto max-w-2xl">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold tracking-tight">Frequently Asked Questions</h2>
            </div>
            <div className="glass-card rounded-2xl p-6">
              {FAQS.map((faq) => <FaqItem key={faq.q} {...faq} />)}
            </div>
          </div>
        </section>

        {/* ── CTA ── */}
        <section className="py-20 px-6 border-t border-border relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent pointer-events-none" />
          <div className="container mx-auto max-w-2xl text-center space-y-6 relative z-10">
            <h2 className="text-4xl font-bold tracking-tight">Ready to start trading?</h2>
            <p className="text-muted-foreground text-lg">Create your verified account in 60 seconds.</p>
            <Link href="/register">
              <Button size="lg" className="bg-primary hover:bg-primary/90 text-white font-semibold px-12 h-13 gap-2 text-base">
                Create Free Account <ArrowRight className="w-5 h-5" />
              </Button>
            </Link>
          </div>
        </section>
      </main>

      {/* ── FOOTER ── */}
      <footer className="border-t border-border bg-card/30 py-10 px-6">
        <div className="container mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-6 h-6 rounded bg-primary flex items-center justify-center">
                  <TrendingUp className="w-3 h-3 text-white" />
                </div>
                <span className="font-bold">TradersHub</span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">Professional trading platform for serious traders.</p>
            </div>
            {[
              { title: "Platform", links: ["Dashboard", "Trade", "Markets", "AI Signals"] },
              { title: "Account", links: ["Register", "Log In", "Deposits", "Withdraw"] },
              { title: "Company", links: ["Support", "Leaderboard", "Copy Trading", "Settings"] },
            ].map(({ title, links }) => (
              <div key={title}>
                <p className="text-xs font-semibold uppercase tracking-widest mb-3 text-muted-foreground">{title}</p>
                <ul className="space-y-2">
                  {links.map((link) => (
                    <li key={link}>
                      <Link href={`/${link.toLowerCase().replace(" ", "-")}`}>
                        <span className="text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer">{link}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="border-t border-border pt-6 flex flex-col md:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
            <p>© 2026 TradersHub. All rights reserved.</p>
            <p>Trading involves substantial risk of loss. Not financial advice.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
