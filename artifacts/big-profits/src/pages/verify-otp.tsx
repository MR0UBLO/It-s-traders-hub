import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { TrendingUp, Loader2, ShieldCheck, RefreshCw } from "lucide-react";

export default function VerifyOtp() {
  const [, setLocation] = useLocation();
  const { setAuth } = useAuth();
  const { toast } = useToast();

  const params = new URLSearchParams(window.location.search);
  const userId = params.get("userId");
  const email  = params.get("email") || "";

  const [otp,        setOtp]        = useState(params.get("devOtp") || "");
  const [devOtp,     setDevOtp]     = useState<string | null>(params.get("devOtp") || null);
  const [isPending,  setIsPending]  = useState(false);
  const [isResending,setIsResending]= useState(false);

  useEffect(() => { if (!userId) setLocation("/login"); }, [userId]);

  /* Auto-verify when code is pre-filled */
  useEffect(() => {
    if (otp.length === 6 && devOtp) {
      // small delay so user sees the filled code first
      const t = setTimeout(() => onVerify(otp), 800);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [devOtp]);

  const onVerify = async (code = otp) => {
    if (code.length !== 6) {
      toast({ title: "Invalid code", description: "Enter the 6-digit code.", variant: "destructive" });
      return;
    }
    setIsPending(true);
    try {
      const res = await fetch(`${API_URL}/auth/verify-otp`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    email,
    otp,
  }),
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
      const res  = await fetch("/api/auth/resend-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: Number(userId) }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "Failed to resend", description: data.error, variant: "destructive" });
        return;
      }
      const newCode = data.devOtp || null;
      setDevOtp(newCode);
      if (newCode) setOtp(newCode);
      toast({ title: "New code generated", description: "Your new verification code is shown below." });
    } catch {
      toast({ title: "Network error", variant: "destructive" });
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-8">

        {/* Logo */}
        <div className="flex items-center gap-2.5 justify-center">
          <div className="w-7 h-7 rounded bg-primary flex items-center justify-center">
            <TrendingUp className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold tracking-tight">TradersHub</span>
        </div>

        {/* Header */}
        <div className="text-center space-y-2">
          <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
            <ShieldCheck className="w-7 h-7 text-primary" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Verify your account</h1>
          <p className="text-sm text-muted-foreground">
            {email ? <>Verifying <span className="text-foreground font-medium">{email}</span></> : "Enter your verification code to continue."}
          </p>
        </div>

        {/* On-screen code display */}
        {devOtp && (
          <div className="rounded-2xl border border-primary/40 bg-primary/5 p-5 space-y-3 text-center">
            <p className="text-xs font-semibold text-primary uppercase tracking-widest">Your verification code</p>
            <p className="text-4xl font-bold font-mono tracking-[0.35em] text-foreground py-1 select-all">
              {devOtp}
            </p>
            <p className="text-xs text-muted-foreground">This code has been filled in automatically below</p>
          </div>
        )}

        {/* Input + button */}
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
            onClick={() => onVerify()}
            disabled={isPending || otp.length !== 6}
          >
            {isPending
              ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Verifying…</>
              : "Verify & Continue →"}
          </Button>
        </div>

        {/* Resend */}
        <p className="text-center text-sm text-muted-foreground">
          Need a new code?{" "}
          <button
            onClick={onResend}
            disabled={isResending}
            className="text-primary hover:underline font-medium disabled:opacity-50 inline-flex items-center gap-1"
          >
            {isResending
              ? <><RefreshCw className="w-3 h-3 animate-spin" />Generating…</>
              : "Generate new code"}
          </button>
        </p>
      </div>
    </div>
  );
}
