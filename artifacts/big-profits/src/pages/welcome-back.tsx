import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { ArrowRight, Hand } from "lucide-react";

export default function WelcomeBack() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const name = user?.name?.trim() || "Trader";

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 sm:p-8 shadow-lg text-center space-y-5">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Hand className="h-7 w-7" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight">Welcome Back, {name}!</h1>
          <p className="text-sm leading-6 text-muted-foreground">
            You’re signed in successfully. We’re glad to have you back at Tradollar.
          </p>
        </div>
        <Button className="w-full h-11 font-semibold" onClick={() => setLocation("/dashboard")}>
          Continue to Dashboard <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
