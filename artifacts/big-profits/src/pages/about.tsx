import { motion } from "framer-motion";
import {
  Activity,
  ArrowRight,
  BookOpen,
  ChartNoAxesCombined,
  ShieldCheck,
  Target,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { Link } from "wouter";

const FEATURES = [
  {
    icon: Activity,
    title: "Market awareness",
    description:
      "Explore selected forex, precious-metal and cryptocurrency markets, with price information presented in one place.",
  },
  {
    icon: ChartNoAxesCombined,
    title: "Chart-based trading",
    description:
      "Use market charts and drawing tools to study price movement, identify levels and plan your own approach.",
  },
  {
    icon: BookOpen,
    title: "Learn as you go",
    description:
      "Build your understanding of market terminology, risk and trading decisions. Start with demo funds while learning the platform.",
  },
  {
    icon: Wallet,
    title: "Account visibility",
    description:
      "Keep track of the account mode you selected and review the balance and activity shown in your account.",
  },
];

export default function About() {
  return (
    <div className="mx-auto max-w-6xl space-y-8 p-4 sm:p-6 lg:p-8">
      <motion.section
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-primary/15 via-card to-card p-6 sm:p-10"
      >
        <div className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-primary/10 blur-3xl" />
        <div className="relative max-w-3xl">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary">
            <TrendingUp className="h-4 w-4" />
            ABOUT TRADOLLAR
          </div>
          <h1 className="text-3xl font-bold tracking-tight sm:text-5xl">
            A clearer way to explore the markets.
          </h1>
          <p className="mt-5 max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">
            Tradollar is a trading-platform interface designed to bring market
            information, chart tools and account activity together in one
            workspace. Our aim is to make the tools easier to navigate so users
            can explore markets, practise their process and make more informed
            decisions.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link href="/markets">
              <span className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90">
                Explore markets <ArrowRight className="h-4 w-4" />
              </span>
            </Link>
            <Link href="/trade">
              <span className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-border bg-background/70 px-5 py-3 text-sm font-semibold transition-colors hover:bg-accent">
                Open trading workspace
              </span>
            </Link>
          </div>
        </div>
      </motion.section>

      <section className="grid gap-4 sm:grid-cols-2">
        {FEATURES.map(({ icon: Icon, title, description }, index) => (
          <motion.article
            key={title}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.07 }}
            className="glass-card rounded-2xl p-5 sm:p-6"
          >
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Icon className="h-5 w-5" />
            </div>
            <h2 className="text-lg font-semibold">{title}</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {description}
            </p>
          </motion.article>
        ))}
      </section>

      <section className="glass-card rounded-2xl p-6 sm:p-8">
        <div className="flex items-start gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold">Responsible trading comes first</h2>
            <p className="mt-3 text-sm leading-7 text-muted-foreground">
              Financial markets involve risk, and losses are possible. Market
              information, signals and automated tools are not guarantees of
              future results or personal financial advice. Only trade with
              money you can afford to lose, understand the product you are
              using, and check whether the service is suitable and authorised
              for your location.
            </p>
            <p className="mt-3 text-sm leading-7 text-muted-foreground">
              Demo balances are virtual and do not represent withdrawable
              money. Before making a deposit or placing a real-money trade,
              review the applicable fees, execution details, and account terms.
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card/50 p-6 sm:p-8">
        <div className="flex items-start gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Target className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold">Our approach</h2>
            <p className="mt-3 text-sm leading-7 text-muted-foreground">
              We believe a useful trading workspace should be understandable,
              transparent about risk and practical on both mobile and desktop.
              Tradollar brings key tools into one interface while leaving
              trading decisions and risk management in the user's hands.
            </p>
          </div>
        </div>
      </section>

      <p className="px-1 text-center text-xs leading-5 text-muted-foreground">
        Tradollar is a platform interface, not a promise of profits. Features
        and available markets may vary by account and location.
      </p>
    </div>
  );
}
