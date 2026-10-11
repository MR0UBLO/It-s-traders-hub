import { useLocation } from "wouter";
import { Wallet, ArrowRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function FirstDeposit() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 sm:p-8 shadow-lg text-center space-y-5">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Wallet className="h-7 w-7" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight">Make Your First Deposit</h1>
          <p className="text-sm leading-6 text-muted-foreground">
            Your account is ready. Make a deposit to fund your real wallet and get started with live trading.
          </p>
        </div>
        <div className="space-y-3">
          <Button className="w-full h-11 font-semibold" onClick={() => setLocation("/deposits")}>
            Make First Deposit <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
          <Button variant="outline" className="w-full h-11" onClick={() => setLocation("/dashboard")}>
            <X className="mr-2 h-4 w-4" /> Cancel — Continue to Dashboard
          </Button>
        </div>
      </div>
    </div>
  );
}
