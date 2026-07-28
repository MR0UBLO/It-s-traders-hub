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
import { TrendingUp, Loader2, Mail, ArrowLeft, ShieldCheck } from "lucide-react";

const registerSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Enter a valid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

type RegisterValues = z.infer<typeof registerSchema>;

export default function Register() {
  const [, setLocation] = useLocation();
  const { setAuth } = useAuth();
  const { toast } = useToast();

  const [step, setStep] = useState<"register" | "verify">("register");
  const [userId, setUserId] = useState<number | null>(null);
  const [registeredEmail, setRegisteredEmail] = useState("");
  const [emailSent, setEmailSent] = useState(false);
  const [devOtp, setDevOtp] = useState<string | null>(null); // shown on screen when email not configured
  const [otp, setOtp] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [isResending, setIsResending] = useState(false);

  const form = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: "", email: "", password: "" },
  });

  const onRegister = async (values: RegisterValues) => {
    setIsPending(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = await res.json();

      if (!res.ok) {
        toast({ title: "Registration failed", description: data.error || "Please try again.", variant: "destructive" });
        return;
      }

      setUserId(data.userId);
      setRegisteredEmail(values.email);
      setEmailSent(data.emailSent === true);
      setDevOtp(data.devOtp || null);

      // If response includes a token, email was not required — log in directly
      if (data.token) {
        setAuth(data.token, data.user);
        setLocation("/dashboard");
        return;
      }

      setStep("verify");
      if (data.emailSent) {
        toast({ title: "Account created!", description: "Check your email for the 6-digit verification code." });
      } else {
        toast({ title: "Account created!", description: "Use the code shown below to verify your account." });
      }
    } catch {
      toast({ title: "Network error", description: "Please try again.", variant: "destructive" });
    } finally {
      setIsPending(false);
    }
  };

  const onVerify = async () => {
    if (otp.length !== 6) {
      toast({ title: "Invalid code", description: "Please enter the 6-digit code.", variant: "destructive" });
      return;
    }
    setIsPending(true);
    try {
      const res = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, otp }),
      });
      const data = await res.json();

      if (!res.ok) {
        toast({ title: "Verification failed", description: data.error || "Invalid or expired code.", variant: "destructive" });
        return;
      }

      setAuth(data.token, data.user);
      setLocation("/dashboard");
    } catch {
      toast({ title: "Network error", description: "Please try again.", variant: "destructive" });
    } finally {
      setIsPending(false);
    }
  };

  const onResend = async () => {
    setIsResending(true);
    try {
      const res = await fetch("/api/auth/resend-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "Failed to resend", description: data.error, variant: "destructive" });
        return;
      }
      setEmailSent(data.emailSent === true);
      setDevOtp(data.devOtp || null);
      if (data.emailSent) {
        toast({ title: "Code resent", description: "A new verification code has been sent to your email." });
      } else {
        toast({ title: "New code generated", description: "Use the code shown below." });
      }
    } catch {
      toast({ title: "Network error", variant: "destructive" });
    } finally {
      setIsResending(false);
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
            Join thousands of<br />
            <span className="text-primary">smart traders.</span>
          </h2>
          <p className="text-muted-foreground leading-relaxed max-w-sm">
            Create your verified account in under a minute and start trading live markets with M-PESA funding.
          </p>
        </div>
        <p className="text-xs text-muted-foreground">Professional trading platform. Not financial advice.</p>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm space-y-8">
          <div className="lg:hidden flex items-center gap-2 mb-2">
            <div className="w-7 h-7 rounded bg-primary flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold tracking-tight">TradersHub</span>
          </div>

          {step === "register" ? (
            <>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">Create your account</h1>
                <p className="text-muted-foreground text-sm mt-1.5">Free to join. Verified with OTP.</p>
              </div>

              <Form {...form}>
                <form onSubmit={form.handleSubmit(onRegister)} className="space-y-5">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <Label className="text-sm font-medium">Full name</Label>
                        <FormControl>
                          <Input placeholder="John Doe" {...field} className="h-11 bg-card border-border" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
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
                          <Input type="password" placeholder="Min. 6 characters" autoComplete="new-password" {...field} className="h-11 bg-card border-border" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" className="w-full h-11 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold" disabled={isPending}>
                    {isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Creating account...</> : "Create Account"}
                  </Button>
                </form>
              </Form>

              <p className="text-center text-sm text-muted-foreground">
                Already have an account?{" "}
                <Link href="/login" className="text-primary hover:underline font-medium">Log in</Link>
              </p>
            </>
          ) : (
            <>
              <div>
                <button
                  onClick={() => setStep("register")}
                  className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Back
                </button>
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                  <Mail className="w-6 h-6 text-primary" />
                </div>
                <h1 className="text-2xl font-bold tracking-tight">Verify your email</h1>
                <p className="text-muted-foreground text-sm mt-1.5">
                  {emailSent
                    ? <>We sent a 6-digit code to <span className="text-foreground font-medium">{registeredEmail}</span></>
                    : <>Enter the code below to verify your account.</>
                  }
                </p>
              </div>

              {/* On-screen OTP display when email is not configured */}
              {devOtp && (
                <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-2">
                  <div className="flex items-center gap-2 text-sm font-semibold text-primary">
                    <ShieldCheck className="w-4 h-4" />
                    Your verification code
                  </div>
                  <p className="text-3xl font-bold font-mono tracking-[0.3em] text-center text-foreground py-1">
                    {devOtp}
                  </p>
                  <p className="text-xs text-muted-foreground text-center">
                    Copy this code and paste it below
                  </p>
                </div>
              )}

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Verification code</Label>
                  <Input
                    placeholder="000000"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    maxLength={6}
                    className="h-14 bg-card border-border text-center text-2xl font-bold font-mono tracking-widest"
                  />
                </div>
                <Button
                  className="w-full h-11 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
                  onClick={onVerify}
                  disabled={isPending || otp.length !== 6}
                >
                  {isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Verifying...</> : "Verify & Continue"}
                </Button>
              </div>

              <p className="text-center text-sm text-muted-foreground">
                Didn't receive the code?{" "}
                <button
                  onClick={onResend}
                  disabled={isResending}
                  className="text-primary hover:underline font-medium disabled:opacity-50"
                >
                  {isResending ? "Sending..." : "Get a new code"}
                </button>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
