import Wallet from "@/pages/wallet";
import { Switch, Route, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";

import Home from "@/pages/home";
import Login from "@/pages/login";
import Register from "@/pages/register";
import VerifyOtp from "@/pages/verify-otp";
import Dashboard from "@/pages/dashboard";
import Trade from "@/pages/trade";
import Markets from "@/pages/markets";
import AiSignals from "@/pages/ai-signals";
import Leaderboard from "@/pages/leaderboard";
import CopyTrading from "@/pages/copy-trading";
import AutoTrading from "@/pages/auto-trading";
import Deposits from "@/pages/deposits";

import Withdraw from "@/pages/withdraw";
import Portfolio from "@/pages/portfolio";
import Admin from "@/pages/admin";
import SettingsPage from "@/pages/settings";
import Support from "@/pages/support";
import NotFound from "@/pages/not-found";

import { AppLayout } from "@/components/layout";
import { useAuth } from "@/hooks/use-auth";
import { useEffect } from "react";
import { getSocket } from "@/lib/socket";
import { toast } from "@/hooks/use-toast";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
});

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) {
    window.location.href = "/login";
    return null;
  }
  return <AppLayout><Component /></AppLayout>;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />
      <Route path="/verify-otp" component={VerifyOtp} />

      <Route path="/dashboard"><ProtectedRoute component={Dashboard} /></Route>
      <Route path="/trade"><ProtectedRoute component={Trade} /></Route>
      <Route path="/markets"><ProtectedRoute component={Markets} /></Route>
      <Route path="/ai-signals"><ProtectedRoute component={AiSignals} /></Route>
      <Route path="/leaderboard"><ProtectedRoute component={Leaderboard} /></Route>
      <Route path="/copy-trading"><ProtectedRoute component={CopyTrading} /></Route>
      <Route path="/auto-trading"><ProtectedRoute component={AutoTrading} /></Route>
<Route path="/wallet">
  <ProtectedRoute component={Wallet} />
</Route>
      <Route path="/deposits"><ProtectedRoute component={Deposits} /></Route>
      <Route path="/withdraw"><ProtectedRoute component={Withdraw} /></Route>
      <Route path="/portfolio"><ProtectedRoute component={Portfolio} /></Route>
      <Route path="/admin"><ProtectedRoute component={Admin} /></Route>
      <Route path="/settings"><ProtectedRoute component={SettingsPage} /></Route>
      <Route path="/support"><ProtectedRoute component={Support} /></Route>

      <Route component={NotFound} />
    </Switch>
  );
}

export default function App() {
 useEffect(() => {
  const socket = getSocket();

  socket.on("notification", (data: any) => {
    toast({
      title: data.title,
      description: data.message,
    });
  });

  return () => {
    socket.off("notification");
  };
}, []); return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Router />
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}
