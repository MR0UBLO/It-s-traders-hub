import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { TrendingUp, Loader2 } from "lucide-react";

const loginSchema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

type LoginValues = z.infer<typeof loginSchema>;

export default function Login() {
  const [, setLocation] = useLocation();
  const { setAuth } = useAuth();
  const { toast } = useToast();
  const [isPending, setIsPending] = useState(false);

  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = async (values: LoginValues) => {
    setIsPending(true);
    try {
      const res = await fetch(
  `${import.meta.env.VITE_API_URL}/auth/login`,
  {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(values),
  }
);

const data = await res.json();



      if (!res.ok) {
        if (data.requiresVerification) {
  toast({
    title: "Email not verified",
    description: data.devOtp
      ? "Use the verification code shown on the next screen."
      : "A new code has been sent to your email.",
  });

  setLocation(
    `/verify-otp?userId=${data.userId}&email=${encodeURIComponent(values.email)}&devOtp=${data.devOtp || ""}`
  );

  return;
}
        toast({ title: "Login failed", description: data.error || "Check your credentials.", variant: "destructive" });
        return;
      }

      setAuth(data.token, data.user);
      const lastRoute = localStorage.getItem("bp_last_route");
      const SAFE = ["/dashboard","/trade","/markets","/ai-signals","/leaderboard",
        "/copy-trading","/auto-trading","/deposits","/withdraw","/portfolio",
        "/settings","/support"];
      setLocation(lastRoute && SAFE.includes(lastRoute) ? lastRoute : "/dashboard");
    } catch {
      toast({ title: "Network error", description: "Please try again.", variant: "destructive" });
    } finally {
      setIsPending(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-background">
      {/* Left brand panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-card border-r border-border flex-col justify-between p-12">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded bg-primary flex items-center justify-center">
            <TrendingUp className="w-4 h-4 text-white" />
          </div>
          <span className="text-lg font-bold tracking-tight">TradersHub</span>
        </div>
        <div className="space-y-4">
          <h2 className="text-4xl font-bold tracking-tight leading-tight">
            Your professional<br />
            <span className="text-primary">trading terminal.</span>
          </h2>
          <p className="text-muted-foreground leading-relaxed max-w-sm">
            Trade XAUUSD, EURUSD, and BTCUSD in real-time. Deposit via M-PESA, copy top traders, and climb the leaderboard.
          </p>
        </div>
        <p className="text-xs text-muted-foreground">Professional trading platform. Not financial advice.</p>
      </div>

      {/* Right auth panel */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm space-y-8">
          <div className="lg:hidden flex items-center gap-2 mb-2">
            <div className="w-7 h-7 rounded bg-primary flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold tracking-tight">TradersHub</span>
          </div>

          <div>
            <h1 className="text-2xl font-bold tracking-tight">Welcome back</h1>
            <p className="text-muted-foreground text-sm mt-1.5">Log in to your trading account</p>
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <Label className="text-sm font-medium">Email address</Label>
                    <FormControl>
                      <Input placeholder="you@example.com" {...field} className="h-11 bg-card border-border" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <Label className="text-sm font-medium">Password</Label>
                    <FormControl>
                      <Input type="password" placeholder="••••••••" autoComplete="current-password" {...field} className="h-11 bg-card border-border" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full h-11 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold" disabled={isPending}>
                {isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Logging in...</> : "Log In"}
              </Button>
            </form>
          </Form>

          <p className="text-center text-sm text-muted-foreground">
            Don't have an account?{" "}
            <Link href="/register" className="text-primary hover:underline font-medium">Sign up free</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
