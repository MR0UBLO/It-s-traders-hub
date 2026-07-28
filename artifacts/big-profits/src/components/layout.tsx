import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useAppStore } from "@/store/app-store";
import { useAccountStore } from "@/store/account-store";
import { useGetWallet, useResetDemo, getGetWalletQueryKey } from "@workspace/api-client-react";
import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";
import {
  LayoutDashboard, LineChart, BarChart2, Bot, Wallet,
  ArrowDownToLine, ArrowUpFromLine, Trophy, Settings,
  HelpCircle, Users, LogOut, TrendingUp, Menu, X,
  Bell, ChevronDown, Shield, RefreshCw, Cpu,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

const NAV_ITEMS_REAL = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/trade", label: "Trade", icon: LineChart },
  { href: "/markets", label: "Markets", icon: BarChart2 },
  { href: "/ai-signals", label: "AI Signals", icon: Bot },
  { href: "/copy-trading", label: "Copy Trading", icon: Users },
  { href: "/auto-trading", label: "Auto Trading", icon: Cpu },
  { href: "/deposits", label: "Deposit", icon: ArrowDownToLine },
  { href: "/withdraw", label: "Withdraw", icon: ArrowUpFromLine },
  { href: "/leaderboard", label: "Leaderboard", icon: Trophy },
];

const NAV_ITEMS_DEMO = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/trade", label: "Trade", icon: LineChart },
  { href: "/markets", label: "Markets", icon: BarChart2 },
  { href: "/ai-signals", label: "AI Signals", icon: Bot },
  { href: "/auto-trading", label: "Auto Trading", icon: Cpu },
  { href: "/leaderboard", label: "Leaderboard", icon: Trophy },
];

const BOTTOM_ITEMS = [
  { href: "/settings", label: "Settings", icon: Settings },
  { href: "/support", label: "Support", icon: HelpCircle },
];

function LiveClock() {
  const [time, setTime] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <span className="font-mono text-xs text-muted-foreground tabular-nums">
      {time.toUTCString().slice(17, 25)} UTC
    </span>
  );
}

function NavItem({
  href, label, icon: Icon, isActive, open,
}: {
  href: string; label: string; icon: React.ElementType; isActive: boolean; open: boolean;
}) {
  return (
    <Link href={href}>
      <motion.div
        className={`relative flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-colors group ${
          isActive
            ? "bg-primary/10 text-primary"
            : "text-muted-foreground hover:text-foreground hover:bg-white/5"
        }`}
        whileHover={{ x: 2 }}
        transition={{ duration: 0.15 }}
      >
        {isActive && (
          <motion.div
            layoutId="nav-indicator"
            className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-primary rounded-full"
          />
        )}
        <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? "text-primary" : ""}`} />
        <AnimatePresence>
          {open && (
            <motion.span
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: "auto" }}
              exit={{ opacity: 0, width: 0 }}
              transition={{ duration: 0.2 }}
              className="text-sm font-medium whitespace-nowrap overflow-hidden"
            >
              {label}
            </motion.span>
          )}
        </AnimatePresence>
      </motion.div>
    </Link>
  );
}

function AccountSwitcher({ sidebarOpen }: { sidebarOpen: boolean }) {
  const { mode, setMode } = useAccountStore();
  const isDemo = mode === "demo";
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const resetDemo = useResetDemo();

  const handleSwitch = (newMode: "real" | "demo") => {
    setMode(newMode);
  };

  const handleResetDemo = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await resetDemo.mutateAsync();
      queryClient.invalidateQueries({ queryKey: getGetWalletQueryKey({ account: "demo" }) });
      toast({ title: "Demo account reset", description: "Balance restored to $10,000" });
    } catch {
      toast({ title: "Reset failed", variant: "destructive" });
    }
  };

  return (
    <div className="px-2 pb-2">
      {sidebarOpen ? (
        <div className="space-y-1.5">
          <p className="text-[10px] text-muted-foreground uppercase tracking-widest px-1 font-semibold">Account</p>
          <div className="grid grid-cols-2 gap-1 bg-background/50 rounded-xl p-1">
            <button
              onClick={() => handleSwitch("real")}
              className={`py-1.5 rounded-lg text-xs font-bold transition-all ${!isDemo ? "bg-emerald-500 text-white shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            >
              Real
            </button>
            <button
              onClick={() => handleSwitch("demo")}
              className={`py-1.5 rounded-lg text-xs font-bold transition-all ${isDemo ? "bg-amber-500 text-white shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            >
              Demo
            </button>
          </div>
          <AnimatePresence>
            {isDemo && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="bg-amber-500/8 border border-amber-500/20 rounded-xl p-2.5 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-amber-400/70 uppercase tracking-wide font-semibold">Demo Account</span>
                    <span className="flex items-center gap-1 text-[10px] text-amber-400 font-bold px-1.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20">
                      DEMO
                    </span>
                  </div>
                  <button
                    onClick={handleResetDemo}
                    disabled={resetDemo.isPending}
                    className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold bg-amber-500/15 text-amber-400 hover:bg-amber-500/25 border border-amber-500/20 transition-colors disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3 h-3 ${resetDemo.isPending ? "animate-spin" : ""}`} />
                    Reset Demo Account
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-1">
          <button
            onClick={() => handleSwitch(isDemo ? "real" : "demo")}
            title={isDemo ? "Switch to Real" : "Switch to Demo"}
            className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold border transition-colors ${isDemo ? "bg-amber-500/20 text-amber-400 border-amber-500/30" : "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"}`}
          >
            {isDemo ? "D" : "R"}
          </button>
        </div>
      )}
    </div>
  );
}

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { logout, user } = useAuth();
  const [location] = useLocation();
  const { sidebarOpen, toggleSidebar } = useAppStore();
  const { mode } = useAccountStore();
  const isDemo = mode === "demo";
  const { data: wallet } = useGetWallet({ account: mode }, { query: { queryKey: [], refetchInterval: 5000 } });
  const [profileOpen, setProfileOpen] = useState(false);
  const queryClient = useQueryClient();

  const SIDEBAR_W = sidebarOpen ? 240 : 64;
  const navItems = isDemo ? NAV_ITEMS_DEMO : NAV_ITEMS_REAL;

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden">
      {/* Sidebar */}
      <motion.aside
        animate={{ width: SIDEBAR_W }}
        transition={{ duration: 0.25, ease: "easeInOut" }}
        className="flex-shrink-0 flex flex-col bg-sidebar border-r border-border overflow-hidden z-30"
        style={{ width: SIDEBAR_W }}
      >
        {/* Logo */}
        <div className="h-14 flex items-center px-3 border-b border-border flex-shrink-0 gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center flex-shrink-0">
            <TrendingUp className="w-4 h-4 text-white" />
          </div>
          <AnimatePresence>
            {sidebarOpen && (
              <motion.span
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: "auto" }}
                exit={{ opacity: 0, width: 0 }}
                transition={{ duration: 0.2 }}
                className="font-bold text-sm whitespace-nowrap overflow-hidden"
              >
                TradersHub
              </motion.span>
            )}
          </AnimatePresence>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto scrollbar-none">
          {navItems.map((item) => (
            <NavItem
              key={item.href}
              href={item.href}
              label={item.label}
              icon={item.icon}
              isActive={location === item.href || (item.href !== "/" && location.startsWith(item.href))}
              open={sidebarOpen}
            />
          ))}
        </nav>

        {/* Account Switcher */}
        <AccountSwitcher sidebarOpen={sidebarOpen} />

        {/* Bottom items */}
        <div className="border-t border-border py-2 px-2 space-y-0.5">
          {BOTTOM_ITEMS.map((item) => (
            <NavItem
              key={item.href}
              href={item.href}
              label={item.label}
              icon={item.icon}
              isActive={location === item.href}
              open={sidebarOpen}
            />
          ))}
          <motion.button
            onClick={() => logout()}
            className="relative flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-colors w-full text-left text-muted-foreground hover:text-destructive hover:bg-destructive/5"
            whileHover={{ x: 2 }}
            transition={{ duration: 0.15 }}
          >
            <LogOut className="w-4 h-4 flex-shrink-0" />
            <AnimatePresence>
              {sidebarOpen && (
                <motion.span
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: "auto" }}
                  exit={{ opacity: 0, width: 0 }}
                  transition={{ duration: 0.2 }}
                  className="text-sm font-medium whitespace-nowrap overflow-hidden"
                >
                  Logout
                </motion.span>
              )}
            </AnimatePresence>
          </motion.button>
        </div>
      </motion.aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <header className="h-14 flex items-center justify-between px-4 border-b border-border flex-shrink-0 gap-3">
          <div className="flex items-center gap-3">
            <button
              onClick={toggleSidebar}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            >
              {sidebarOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </button>
            <LiveClock />
          </div>

          <div className="flex items-center gap-2">
            {/* Balance display */}
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-sm ${isDemo ? "border-amber-500/20 bg-amber-500/5" : "border-border bg-card/50"}`}>
              <Wallet className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="font-mono font-bold">
                ${(wallet?.balance ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
              </span>
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${isDemo ? "bg-amber-500/15 text-amber-400 border border-amber-500/20" : "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20"}`}>
                {isDemo ? "DEMO" : "REAL"}
              </span>
            </div>

            {/* Notifications */}
            <button className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition-colors relative">
              <Bell className="w-4 h-4" />
            </button>

            {/* Profile */}
            <div className="relative">
              <button
                onClick={() => setProfileOpen(!profileOpen)}
                className="flex items-center gap-2 px-2 py-1.5 rounded-xl hover:bg-accent transition-colors"
              >
                <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-bold text-primary">{user?.name?.[0]?.toUpperCase() ?? "U"}</span>
                </div>
                <span className="hidden sm:block text-xs font-medium max-w-[100px] truncate">{user?.name}</span>
                <ChevronDown className="w-3 h-3 text-muted-foreground" />
              </button>
              <AnimatePresence>
                {profileOpen && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: -5 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: -5 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 top-full mt-2 w-52 glass-card rounded-xl p-2 shadow-xl z-50"
                  >
                    <div className="px-3 py-2 border-b border-border mb-1">
                      <p className="text-sm font-semibold truncate">{user?.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
                    </div>
                    <Link href="/settings" onClick={() => setProfileOpen(false)}>
                      <div className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-accent text-sm cursor-pointer transition-colors">
                        <Settings className="w-3.5 h-3.5" /> Settings
                      </div>
                    </Link>
                    <button
                      onClick={() => { setProfileOpen(false); logout(); }}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-destructive/10 text-destructive text-sm transition-colors"
                    >
                      <LogOut className="w-3.5 h-3.5" /> Logout
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto">
          <motion.div
            key={`${location}-${mode}`}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            className="h-full"
          >
            {children}
          </motion.div>
        </main>
      </div>
    </div>
  );
}
