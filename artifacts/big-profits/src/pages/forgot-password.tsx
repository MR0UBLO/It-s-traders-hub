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
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isPending, setIsPending] = useState(false);

  const changePassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (newPassword !== confirmPassword) {
      toast({ title: "Passwords do not match", description: "Enter the same new password in both fields.", variant: "destructive" });
      return;
    }
    if (newPassword === currentPassword) {
      toast({ title: "Choose a new password", description: "Your new password must differ from your last remembered password.", variant: "destructive" });
      return;
    }
    setIsPending(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/auth/change-password-by-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, currentPassword, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "Password not changed", description: data.error || "Check your details and try again.", variant: "destructive" });
        return;
      }
      toast({ title: "Password changed", description: "You can now log in with your new password." });
      setLocation("/login");
    } catch {
      toast({ title: "Connection error", description: "Please try again.", variant: "destructive" });
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
          <h1 className="text-2xl font-bold tracking-tight">Change password</h1>
          <p className="text-sm text-muted-foreground mt-2">Enter your email, the last password you remember, and your new password.</p>
        </div>
        <form onSubmit={changePassword} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="reset-email">Email address</Label>
            <Input id="reset-email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" className="h-11 bg-card border-border" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="last-password">Last password remembered</Label>
            <Input id="last-password" type="password" autoComplete="current-password" required value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} placeholder="Enter the last password you remember" className="h-11 bg-card border-border" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-password">New password</Label>
            <Input id="new-password" type="password" autoComplete="new-password" required minLength={6} maxLength={128} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} placeholder="At least 6 characters" className="h-11 bg-card border-border" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm-password">Confirm new password</Label>
            <Input id="confirm-password" type="password" autoComplete="new-password" required minLength={6} maxLength={128} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="Re-enter new password" className="h-11 bg-card border-border" />
          </div>
          <Button type="submit" className="w-full h-11" disabled={isPending}>
            {isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Changing password...</> : "Change password"}
          </Button>
        </form>
        <p className="text-center text-sm text-muted-foreground">
          <Link href="/login" className="inline-flex items-center gap-1 text-primary hover:underline font-medium"><ArrowLeft className="w-4 h-4" /> Back to login</Link>
        </p>
      </div>
    </div>
  );
}
