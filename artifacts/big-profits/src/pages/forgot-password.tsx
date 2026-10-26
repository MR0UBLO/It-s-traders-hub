import { useState, type FormEvent } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { TrendingUp, Loader2, ArrowLeft } from "lucide-react";

export default function ForgotPassword() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [codeRequested, setCodeRequested] = useState(false);
  const [isPending, setIsPending] = useState(false);

  const requestCode = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsPending(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/auth/request-password-reset`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "Request failed", description: data.error || "Please try again.", variant: "destructive" });
        return;
      }
      setCodeRequested(true);
      toast({ title: "Check your email", description: "If a verified account exists, a reset code will be sent." });
    } catch {
      toast({ title: "Network error", description: "Please try again.", variant: "destructive" });
    } finally {
      setIsPending(false);
    }
  };

  const resetPassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsPending(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "Password reset failed", description: data.error || "Check the code and try again.", variant: "destructive" });
        return;
      }
      toast({ title: "Password updated", description: "You can now log in with your new password." });
      setLocation("/login");
    } catch {
      toast({ title: "Network error", description: "Please try again.", variant: "destructive" });
    } finally {
      setIsPending(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-6 py-12">
      <div className="w-full max-w-sm space-y-7">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded bg-primary flex items-center justify-center">
            <TrendingUp className="w-4 h-4 text-white" />
          </div>
          <span className="text-lg font-bold tracking-tight">Tradollar</span>
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Forgot password?</h1>
          <p className="text-sm text-muted-foreground mt-2">
            {codeRequested ? "Enter the reset code from your email and choose a new password." : "Enter the email address linked to your account to request a reset code."}
          </p>
        </div>
        {!codeRequested ? (
          <form onSubmit={requestCode} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="reset-email">Email address</Label>
              <Input id="reset-email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" className="h-11 bg-card border-border" />
            </div>
            <Button type="submit" className="w-full h-11" disabled={isPending}>
              {isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Sending...</> : "Send reset code"}
            </Button>
          </form>
        ) : (
          <form onSubmit={resetPassword} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="reset-email">Email address</Label>
              <Input id="reset-email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} className="h-11 bg-card border-border" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reset-code">Reset code</Label>
              <Input id="reset-code" inputMode="numeric" autoComplete="one-time-code" required minLength={6} maxLength={6} value={otp} onChange={(event) => setOtp(event.target.value)} placeholder="6-digit code" className="h-11 bg-card border-border" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-password">New password</Label>
              <Input id="new-password" type="password" autoComplete="new-password" required minLength={6} maxLength={128} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} placeholder="At least 6 characters" className="h-11 bg-card border-border" />
            </div>
            <Button type="submit" className="w-full h-11" disabled={isPending}>
              {isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Updating...</> : "Reset password"}
            </Button>
            <button type="button" className="w-full text-sm text-primary hover:underline" onClick={() => setCodeRequested(false)}>Request a new code</button>
          </form>
        )}
        <p className="text-center text-sm text-muted-foreground">
          <Link href="/login" className="inline-flex items-center gap-1 text-primary hover:underline font-medium"><ArrowLeft className="w-4 h-4" /> Back to login</Link>
        </p>
      </div>
    </div>
  );
}
