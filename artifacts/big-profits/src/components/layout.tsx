import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useAppStore } from "@/store/app-store";
import { useAccountStore } from "@/store/account-store";
import {
  useGetWallet, getGetWalletQueryKey,
  useResetDemo,
} from "@workspace/api-client-react";
import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState, useRef, useCallback } from "react";
import {
  LayoutDashboard, LineChart, BarChart2, Bot, Wallet,
  Trophy, Settings,
  HelpCircle, Users, LogOut, TrendingUp, Menu, X,
  Bell, ChevronDown, Shield, RefreshCw, Cpu, Briefcase,
  MoreHorizontal, ChevronLeft, ChevronRight, Info,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

/* ─── Navigation structure ────────────────────────────────────────── */
const NAV_GROUPS = [
  {
    label: "Overview",
    items: [
      { href: "/dashboard",  label: "Dashboard",  icon: LayoutDashboard },
      { href: "/markets",    label: "Markets",    icon: BarChart2       },
    ],
  },
  {
    label: "Trading",
    items: [
      { href: "/trade",         label: "Trade",         icon: LineChart },
      { href: "/ai-signals",    label: "AI Signals",    icon: Bot       },
      { href: "/copy-trading",  label: "Copy Trading",  icon: Users     },
      { href: "/auto-trading",  label: "Auto Trading",  icon: Cpu       },
    ],
  },
  {
    label: "Portfolio",
    items: [
      { href: "/portfolio",   label: "Portfolio",   icon: Briefcase },
      { href: "/leaderboard", label: "Leaderboard", icon: Trophy    },
    ],
  },
  {
    label: "Wallet",
    items: [
      { href: "/wallet", label: "Wallet", icon: Wallet },
    ],
  },
];

const BOTTOM_ITEMS = [
  { href: "/settings", label: "Settings", icon: Settings   },
  { href: "/support",  label: "Support",  icon: HelpCircle },
];

/* Mobile bottom nav (5 primary tabs) */
const MOBILE_PRIMARY = [
  { href: "/dashboard", label: "Home",      icon: LayoutDashboard, primary: false },
  { href: "/markets",   label: "Markets",   icon: BarChart2,       primary: false },
  { href: "/trade",     label: "Trade",     icon: TrendingUp,      primary: true  },
  { href: "/wallet",    label: "Wallet",    icon: Wallet,          primary: false },
  { href: "__more__",   label: "More",      icon: MoreHorizontal,  primary: false },
];

/* Mobile "More" drawer — secondary features only */
const MOBILE_MORE = [
  { href: "/ai-signals",   label: "AI Signals",   icon: Bot         },
  { href: "/copy-trading", label: "Copy Trading", icon: Users       },
  { href: "/auto-trading", label: "Auto Trading", icon: Cpu         },
  { href: "/leaderboard",  label: "Leaderboard",  icon: Trophy      },
  { href: "/portfolio",    label: "Portfolio",    icon: Briefcase   },
  { href: "/settings",     label: "Settings",     icon: Settings    },
  { href: "/support",      label: "Support",      icon: HelpCircle  },
  { href: "/about",        label: "About",        icon: Info        },
];

/* ─── Helpers ─────────────────────────────────────────────────────── */
function isActive(location: string, href: string) {
  if (href === "/") return location === "/";
  return location === href || location.startsWith(href + "/");
}

/* ─── Live Clock ──────────────────────────────────────────────────── */
function LiveClock() {
  const [time, setTime] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <span className="font-mono text-xs text-muted-foreground tabular-nums hidden sm:inline">
      {time.toUTCString().slice(17, 25)} UTC
    </span>
  );
}

/* ─── Sidebar nav item ────────────────────────────────────────────── */
function SideNavItem({
  href, label, icon: Icon, active, collapsed,
}: {
  href: string; label: string; icon: React.ElementType;
  active: boolean; collapsed: boolean;
}) {
  return (
    <Link href={href}>
      <div
        title={collapsed ? label : undefined}
        className={`relative flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-all duration-150 group select-none ${
          active
            ? "bg-primary/10 text-primary"
            : "text-muted-foreground hover:text-foreground hover:bg-white/5"
        }`}
      >
        {active && (
          <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-primary rounded-full" />
        )}
        <Icon className={`w-4 h-4 flex-shrink-0 transition-colors ${active ? "text-primary" : ""}`} />
        {!collapsed && (
          <span className="text-sm font-medium whitespace-nowrap overflow-hidden">{label}</span>
        )}
      </div>
    </Link>
  );
}

/* ─── Account Switcher ────────────────────────────────────────────── */
function AccountSwitcher({ collapsed }: { collapsed: boolean }) {
  const { mode, setMode } = useAccountStore();
  const isDemo = mode === "demo";
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const resetDemo = useResetDemo();

  /* Switch mode AND invalidate every cached query so all pages update instantly */
  const handleSetMode = useCallback((next: "real" | "demo") => {
    if (next === mode) return;
    setMode(next);
    // Invalidate everything — each page's hooks will refetch with the new account param
    queryClient.invalidateQueries();
  }, [mode, setMode, queryClient]);

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

  if (collapsed) {
    return (
      <div className="flex flex-col items-center gap-1 px-2 pb-2">
        <button
          onClick={() => handleSetMode(isDemo ? "real" : "demo")}
          title={isDemo ? "Switch to Real" : "Switch to Demo"}
          className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold border transition-colors ${
            isDemo
              ? "bg-amber-500/20 text-amber-400 border-amber-500/30"
              : "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
          }`}
        >
          {isDemo ? "D" : "R"}
        </button>
      </div>
    );
  }

  return (
    <div className="px-2 pb-3 space-y-1.5">
      <p className="text-[10px] text-muted-foreground uppercase tracking-widest px-1 font-semibold">Account</p>
      <div className="grid grid-cols-2 gap-1 bg-background/50 rounded-xl p-1">
        <button
          onClick={() => handleSetMode("real")}
          className={`py-1.5 rounded-lg text-xs font-bold transition-all ${!isDemo ? "bg-emerald-500 text-white shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
        >
          Real
        </button>
        <button
          onClick={() => handleSetMode("demo")}
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
            <div className="bg-amber-500/8 border border-amber-500/20 rounded-xl p-2 space-y-1.5">
              <span className="text-[10px] text-amber-400/70 uppercase tracking-wide font-semibold block">
                Demo Mode — Virtual Funds
              </span>
              <button
                onClick={handleResetDemo}
                disabled={resetDemo.isPending}
                className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold bg-amber-500/15 text-amber-400 hover:bg-amber-500/25 border border-amber-500/20 transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-3 h-3 ${resetDemo.isPending ? "animate-spin" : ""}`} />
                Reset Demo
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─── Desktop Sidebar ─────────────────────────────────────────────── */
function Sidebar() {
  const [location] = useLocation();
  const { logout, user } = useAuth();
  const { sidebarOpen: expanded, toggleSidebar } = useAppStore();
  const W = expanded ? 240 : 64;

  return (
    <motion.aside
      animate={{ width: W }}
      transition={{ duration: 0.22, ease: "easeInOut" }}
      className="hidden md:flex flex-col flex-shrink-0 bg-sidebar border-r border-border overflow-hidden z-30 h-screen"
      style={{ width: W }}
    >
      {/* Logo + Toggle */}
      <div className="h-14 flex items-center justify-between px-3 border-b border-border flex-shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center flex-shrink-0">
            <TrendingUp className="w-4 h-4 text-white" />
          </div>
          {expanded && (
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15, delay: 0.05 }}
              className="font-bold text-sm whitespace-nowrap"
            >
              TradersHub
            </motion.span>
          )}
        </div>
        <button
          onClick={toggleSidebar}
          className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition-colors flex-shrink-0"
        >
          {expanded ? <ChevronLeft className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Account Switcher */}
      <div className="border-b border-border py-2">
        <AccountSwitcher collapsed={!expanded} />
      </div>

      {/* Navigation groups */}
      <nav className="flex-1 py-3 px-2 overflow-y-auto overflow-x-hidden scrollbar-none space-y-0">
        {NAV_GROUPS.map((group) => (
          <div key={group.label} className="mb-1">
            {expanded && (
              <p className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-widest px-3 pt-3 pb-1.5">
                {group.label}
              </p>
            )}
            {!expanded && <div className="h-2" />}
            <div className="space-y-0.5">
              {group.items.map((item) => (
                <SideNavItem
                  key={item.href}
                  {...item}
                  active={isActive(location, item.href)}
                  collapsed={!expanded}
                />
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* Bottom: Settings, Support, Admin, Logout */}
      <div className="border-t border-border py-2 px-2 space-y-0.5">
        {BOTTOM_ITEMS.map((item) => (
          <SideNavItem
            key={item.href}
            {...item}
            active={isActive(location, item.href)}
            collapsed={!expanded}
          />
        ))}
        {user && (user as any).isAdmin && (
          <SideNavItem
            href="/admin"
            label="Admin"
            icon={Shield}
            active={isActive(location, "/admin")}
            collapsed={!expanded}
          />
        )}
        <button
          onClick={logout}
          title={!expanded ? "Logout" : undefined}
          className="relative flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-colors w-full text-left text-muted-foreground hover:text-destructive hover:bg-destructive/5"
        >
          <LogOut className="w-4 h-4 flex-shrink-0" />
          {expanded && <span className="text-sm font-medium whitespace-nowrap">Logout</span>}
        </button>
      </div>
    </motion.aside>
  );
}

/* ─── Mobile Bottom Nav ───────────────────────────────────────────── */
function BottomNav({ onMore }: { onMore: () => void }) {
  const [location] = useLocation();

  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-sidebar/95 backdrop-blur-md border-t border-border safe-bottom">
      <div className="flex items-end justify-around h-16 px-2">
        {MOBILE_PRIMARY.map((item) => {
          const Icon = item.icon;
          const active = item.href !== "__more__" && isActive(location, item.href);

          if (item.primary) {
            return (
              <Link key={item.href} href={item.href}>
                <div className="flex flex-col items-center -mt-5">
                  <div
                    className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg transition-transform active:scale-95 ${
                      active
                        ? "bg-primary shadow-primary/30"
                        : "bg-primary/90 hover:bg-primary"
                    }`}
                  >
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                  <span className="text-[10px] font-medium mt-1 text-primary">{item.label}</span>
                </div>
              </Link>
            );
          }

          if (item.href === "__more__") {
            return (
              <button key="more" onClick={onMore} className="flex flex-col items-center gap-1 py-2 px-3 min-w-[52px]">
                <div className={`w-6 h-6 flex items-center justify-center`}>
                  <Icon className="w-5 h-5 text-muted-foreground" />
                </div>
                <span className="text-[10px] font-medium text-muted-foreground">{item.label}</span>
              </button>
            );
          }

          return (
            <Link key={item.href} href={item.href}>
              <div className="flex flex-col items-center gap-1 py-2 px-3 min-w-[52px]">
                <div className={`w-6 h-6 flex items-center justify-center relative`}>
                  <Icon className={`w-5 h-5 transition-colors ${active ? "text-primary" : "text-muted-foreground"}`} />
                  {active && (
                    <motion.span
                      layoutId="bottom-nav-dot"
                      className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary"
                    />
                  )}
                </div>
                <span className={`text-[10px] font-medium transition-colors ${active ? "text-primary" : "text-muted-foreground"}`}>
                  {item.label}
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

/* ─── Mobile "More" Drawer ────────────────────────────────────────── */
function MoreDrawer({
  open, onClose, isAdmin,
}: {
  open: boolean; onClose: () => void; isAdmin?: boolean;
}) {
  const [location] = useLocation();
  const drawerRef = useRef<HTMLDivElement>(null);
  const { mode, setMode } = useAccountStore();
  const queryClient = useQueryClient();
  const isDemo = mode === "demo";

  const handleSetMode = useCallback((next: "real" | "demo") => {
    if (next === mode) return;
    setMode(next);
    queryClient.invalidateQueries();
  }, [mode, setMode, queryClient]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (drawerRef.current && !drawerRef.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open, onClose]);

  const items = isAdmin
    ? [...MOBILE_MORE, { href: "/admin", label: "Admin", icon: Shield }]
    : MOBILE_MORE;

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="md:hidden fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
          />
          {/* Sheet */}
          <motion.div
            key="sheet"
            ref={drawerRef}
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 300 }}
            className="md:hidden fixed bottom-0 inset-x-0 z-50 bg-sidebar rounded-t-2xl border-t border-border max-h-[85vh] overflow-y-auto"
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-2">
              <div className="w-10 h-1 rounded-full bg-border" />
            </div>

            {/* Account switcher inside drawer */}
            <div className="px-4 pb-3">
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold mb-2">Account</p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => handleSetMode("real")}
                  className={`py-2 rounded-xl text-sm font-bold transition-all border ${!isDemo ? "bg-emerald-500 text-white border-emerald-500" : "border-border text-muted-foreground hover:text-foreground"}`}
                >
                  Real Account
                </button>
                <button
                  onClick={() => handleSetMode("demo")}
                  className={`py-2 rounded-xl text-sm font-bold transition-all border ${isDemo ? "bg-amber-500 text-white border-amber-500" : "border-border text-muted-foreground hover:text-foreground"}`}
                >
                  Demo Account
                </button>
              </div>
              {isDemo && (
                <p className="text-[10px] text-amber-400 mt-1.5 text-center">
                  You are trading with virtual funds
                </p>
              )}
            </div>

            <div className="flex items-center justify-between px-5 pb-3 border-t border-border pt-3">
              <h3 className="font-bold text-base">More</h3>
              <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-accent text-muted-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-4 gap-2 px-4 pb-6">
              {items.map((item) => {
                const Icon = item.icon;
                const active = isActive(location, item.href);
                return (
                  <Link key={item.href} href={item.href}>
                    <div
                      onClick={onClose}
                      className={`flex flex-col items-center gap-2 p-3 rounded-2xl transition-colors cursor-pointer ${
                        active ? "bg-primary/10" : "hover:bg-accent"
                      }`}
                    >
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                        active ? "bg-primary/15" : "bg-accent"
                      }`}>
                        <Icon className={`w-5 h-5 ${active ? "text-primary" : "text-muted-foreground"}`} />
                      </div>
                      <span className={`text-[10px] font-medium text-center leading-tight ${active ? "text-primary" : "text-muted-foreground"}`}>
                        {item.label}
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

/* ─── Main Header ─────────────────────────────────────────────────── */
function AppHeader({ onMenuToggle }: { onMenuToggle: () => void }) {
  const { logout, user } = useAuth();
  const { mode } = useAccountStore();
  const isDemo = mode === "demo";
  const { data: wallet } = useGetWallet(
    { account: mode },
    { query: { queryKey: getGetWalletQueryKey({ account: mode }), refetchInterval: 5000 } },
  );
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!profileOpen) return;
    const handler = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [profileOpen]);

  return (
    <header className="h-14 flex items-center justify-between px-4 border-b border-border flex-shrink-0 bg-sidebar/50 backdrop-blur-sm">
      <div className="flex items-center gap-3">
        {/* Mobile: Logo; Desktop: Menu toggle */}
        <div className="md:hidden flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
            <TrendingUp className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="font-bold text-sm">TradersHub</span>
        </div>
        <button
          onClick={onMenuToggle}
          className="hidden md:flex w-8 h-8 rounded-lg items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
        >
          <Menu className="w-4 h-4" />
        </button>
        <LiveClock />
      </div>

      <div className="flex items-center gap-2">
        {/* Balance */}
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-sm ${
          isDemo ? "border-amber-500/20 bg-amber-500/5" : "border-border bg-card/50"
        }`}>
          <Wallet className="w-3.5 h-3.5 text-muted-foreground hidden sm:block" />
          <span className="font-mono font-bold tabular-nums text-xs sm:text-sm">
            ${(Number(wallet?.balance ?? 0)).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
            isDemo
              ? "bg-amber-500/15 text-amber-400 border border-amber-500/20"
              : "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20"
          }`}>
            {isDemo ? "DEMO" : "REAL"}
          </span>
        </div>

        {/* Notifications */}
        <button className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition-colors relative">
          <Bell className="w-4 h-4" />
        </button>

        {/* Profile dropdown */}
        <div className="relative" ref={profileRef}>
          <button
            onClick={() => setProfileOpen((v) => !v)}
            className="flex items-center gap-2 px-2 py-1.5 rounded-xl hover:bg-accent transition-colors"
          >
            <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
              <span className="text-xs font-bold text-primary">{user?.name?.[0]?.toUpperCase() ?? "U"}</span>
            </div>
            <span className="hidden sm:block text-xs font-medium max-w-[80px] truncate">{user?.name}</span>
            <ChevronDown className="w-3 h-3 text-muted-foreground" />
          </button>
          <AnimatePresence>
            {profileOpen && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: -5 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -5 }}
                transition={{ duration: 0.15 }}
                className="absolute right-0 top-full mt-2 w-52 bg-card border border-border rounded-xl p-2 shadow-xl z-50"
              >
                <div className="px-3 py-2 border-b border-border mb-1">
                  <p className="text-sm font-semibold truncate">{user?.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
                  <span className={`mt-1 inline-block text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    isDemo
                      ? "bg-amber-500/15 text-amber-400"
                      : "bg-emerald-500/15 text-emerald-400"
                  }`}>
                    {isDemo ? "DEMO Account" : "REAL Account"}
                  </span>
                </div>
                <Link href="/settings" onClick={() => setProfileOpen(false)}>
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-accent text-sm cursor-pointer transition-colors">
                    <Settings className="w-3.5 h-3.5" /> Settings
                  </div>
                </Link>
                {(user as any)?.isAdmin && (
                  <Link href="/admin" onClick={() => setProfileOpen(false)}>
                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-accent text-sm cursor-pointer transition-colors">
                      <Shield className="w-3.5 h-3.5" /> Admin
                    </div>
                  </Link>
                )}
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
  );
}

/* ─── App Layout ──────────────────────────────────────────────────── */
export function AppLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { toggleSidebar } = useAppStore();
  const { user } = useAuth();
  const [moreOpen, setMoreOpen] = useState(false);

  // Remember last route for post-login redirect
  useEffect(() => {
    const SKIP = ["/", "/login", "/register", "/verify-otp"];
    if (!SKIP.includes(location)) {
      localStorage.setItem("bp_last_route", location);
    }
  }, [location]);

  // Close more drawer on navigation
  useEffect(() => {
    setMoreOpen(false);
  }, [location]);

  return (
    <div className="flex h-[100dvh] w-full bg-background overflow-hidden">
      {/* Desktop Sidebar */}
      <Sidebar />

      {/* Main column */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <AppHeader onMenuToggle={toggleSidebar} />

        {/* Page content */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden pb-16 md:pb-0">
          <motion.div
            key={location}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="h-full"
          >
            {children}
          </motion.div>
        </main>
      </div>

      {/* Mobile Bottom Nav */}
      <BottomNav onMore={() => setMoreOpen(true)} />

      {/* Mobile More Drawer */}
      <MoreDrawer
        open={moreOpen}
        onClose={() => setMoreOpen(false)}
        isAdmin={!!(user as any)?.isAdmin}
      />
    </div>
  );
}
