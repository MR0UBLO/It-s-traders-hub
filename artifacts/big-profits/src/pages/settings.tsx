import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Settings, User, Bell, Shield, Palette, Save, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";

const TABS = [
  { id: "profile", label: "Profile", icon: User },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "security", label: "Security", icon: Shield },
  { id: "appearance", label: "Appearance", icon: Palette },
] as const;

const NOTIFICATION_OPTIONS = [
  { id: "tradeConfirmations", label: "Trade confirmations", desc: "Get notified when trades open or close" },
  { id: "priceAlerts", label: "Price alerts", desc: "Alerts when a market hits your target price" },
  { id: "depositConfirmations", label: "Deposit confirmations", desc: "Get updates about deposit activity" },
  { id: "aiSignalAlerts", label: "AI signal alerts", desc: "Receive new AI signal notifications" },
] as const;
type NotificationId = typeof NOTIFICATION_OPTIONS[number]["id"];
type NotificationPrefs = Record<NotificationId, boolean>;
const DEFAULT_NOTIFICATIONS: NotificationPrefs = {
  tradeConfirmations: true, priceAlerts: true, depositConfirmations: true, aiSignalAlerts: true,
};
const readNotifications = (): NotificationPrefs => {
  try {
    const stored = localStorage.getItem("tradollar_notification_preferences");
    return stored ? { ...DEFAULT_NOTIFICATIONS, ...JSON.parse(stored) } : DEFAULT_NOTIFICATIONS;
  } catch { return DEFAULT_NOTIFICATIONS; }
};

export default function SettingsPage() {
  const { user, token, setAuth } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<(typeof TABS)[number]["id"]>("profile");
  const [name, setName] = useState(user?.name || "");
  const [notifications, setNotifications] = useState<NotificationPrefs>(readNotifications);
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    try { return localStorage.getItem("tradollar_theme") === "dark" ? "dark" : "light"; }
    catch { return "light"; }
  });
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    try { localStorage.setItem("tradollar_theme", theme); } catch { /* storage may be disabled */ }
  }, [theme]);

  const saveProfile = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      toast({ title: "Name required", description: "Enter your full name before saving.", variant: "destructive" });
      return;
    }
    if (!token) {
      toast({ title: "Session expired", description: "Please log in again to update your profile.", variant: "destructive" });
      return;
    }
    setSavingProfile(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/auth/profile`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: trimmedName }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not update profile.");
      setAuth(token, data.user);
      setName(data.user.name);
      toast({ title: "Profile updated", description: "Your name has been saved to your account." });
    } catch (error) {
      toast({ title: "Profile not saved", description: error instanceof Error ? error.message : "Check your connection and try again.", variant: "destructive" });
    } finally { setSavingProfile(false); }
  };

  const saveNotifications = (id: NotificationId, enabled: boolean) => {
    const next = { ...notifications, [id]: enabled };
    setNotifications(next);
    try { localStorage.setItem("tradollar_notification_preferences", JSON.stringify(next)); } catch { /* state still works for this session */ }
    toast({ title: "Notification preference updated", description: "This preference is saved on this device." });
  };

  const savePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast({ title: "Complete all fields", description: "Enter your current password and the new password twice.", variant: "destructive" });
      return;
    }
    if (newPassword.length < 6) {
      toast({ title: "Password too short", description: "Your new password must contain at least 6 characters.", variant: "destructive" });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: "Passwords do not match", description: "Make sure both new password fields are identical.", variant: "destructive" });
      return;
    }
    if (!token) {
      toast({ title: "Session expired", description: "Please log in again to change your password.", variant: "destructive" });
      return;
    }
    setSavingPassword(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/auth/change-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not update password.");
      setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
      toast({ title: "Password updated", description: "Your account password has been changed." });
    } catch (error) {
      toast({ title: "Password not changed", description: error instanceof Error ? error.message : "Check your connection and try again.", variant: "destructive" });
    } finally { setSavingPassword(false); }
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-4xl mx-auto">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <Settings className="w-7 h-7 text-primary" /> Settings
        </h1>
        <p className="text-muted-foreground mt-1">Manage your account preferences.</p>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-[12rem_minmax(0,1fr)] gap-4 md:gap-6">
        <motion.nav initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="grid grid-cols-2 md:grid-cols-1 gap-1 content-start">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button key={id} type="button" aria-current={activeTab === id ? "page" : undefined}
              onClick={() => setActiveTab(id)}
              className={`w-full flex items-center gap-2.5 px-3 py-3 rounded-lg text-sm font-medium transition-colors text-left ${activeTab === id ? "bg-primary/10 text-primary ring-1 ring-primary/20" : "text-muted-foreground hover:text-foreground hover:bg-accent"}`}>
              <Icon className="w-4 h-4" />{label}
            </button>
          ))}
        </motion.nav>

        <motion.section key={activeTab} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} className="min-w-0 glass-card rounded-2xl p-4 sm:p-6">
          {activeTab === "profile" && (
            <div className="space-y-5">
              <h2 className="font-semibold text-lg">Profile Information</h2>
              <div className="flex items-center gap-4 mb-6">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-2xl font-bold text-primary">{(name || user?.name || "?").charAt(0).toUpperCase()}</div>
                <div className="min-w-0">
                  <p className="font-semibold break-words">{user?.name}</p>
                  <p className="text-sm text-muted-foreground break-all">{user?.email}</p>
                  {user?.isAdmin && <span className="text-xs text-primary font-semibold">Admin</span>}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="settings-full-name">Full Name</Label>
                <Input id="settings-full-name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} className="bg-background" maxLength={80} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="settings-email">Email Address</Label>
                <Input id="settings-email" value={user?.email || ""} disabled className="bg-background opacity-60" />
                <p className="text-xs text-muted-foreground">Email cannot be changed here.</p>
              </div>
              <Button onClick={saveProfile} disabled={savingProfile} className="gap-2">
                {savingProfile ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save Changes
              </Button>
            </div>
          )}

          {activeTab === "notifications" && (
            <div className="space-y-5">
              <h2 className="font-semibold text-lg">Notification Preferences</h2>
              <p className="text-sm text-muted-foreground">Choose which notification types you want enabled on this device.</p>
              {NOTIFICATION_OPTIONS.map(({ id, label, desc }) => (
                <div key={id} className="flex items-center justify-between gap-4 py-3 border-b border-border last:border-0">
                  <div className="min-w-0"><p className="font-medium text-sm">{label}</p><p className="text-xs text-muted-foreground mt-1">{desc}</p></div>
                  <button type="button" role="switch" aria-checked={notifications[id]} aria-label={label} onClick={() => saveNotifications(id, !notifications[id])}
                    className={`relative shrink-0 w-11 h-6 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${notifications[id] ? "bg-primary" : "bg-muted"}`}>
                    <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all ${notifications[id] ? "left-6" : "left-1"}`} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {activeTab === "security" && (
            <div className="space-y-5">
              <h2 className="font-semibold text-lg">Security Settings</h2>
              <p className="text-sm text-muted-foreground">Change your password using your current password for verification.</p>
              <div className="space-y-1.5"><Label htmlFor="current-password">Current Password</Label><Input id="current-password" type="password" autoComplete="current-password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} className="bg-background" /></div>
              <div className="space-y-1.5"><Label htmlFor="new-password">New Password</Label><Input id="new-password" type="password" autoComplete="new-password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="bg-background" /></div>
              <div className="space-y-1.5"><Label htmlFor="confirm-password">Confirm New Password</Label><Input id="confirm-password" type="password" autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="bg-background" /></div>
              <Button onClick={savePassword} disabled={savingPassword} className="gap-2">
                {savingPassword ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />} Update Password
              </Button>
              <div className="p-4 rounded-xl bg-green-500/5 border border-green-500/20">
                <p className="text-sm font-semibold text-green-500 flex items-center gap-2"><Check className="w-4 h-4" /> Account security</p>
                <p className="text-xs text-muted-foreground mt-1">Your password is verified securely by the server. Never share it with anyone.</p>
              </div>
            </div>
          )}

          {activeTab === "appearance" && (
            <div className="space-y-5">
              <h2 className="font-semibold text-lg">Appearance</h2>
              <p className="text-sm text-muted-foreground">Choose a theme for the app. Your choice is remembered on this device.</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {(["dark", "light"] as const).map((value) => (
                  <button key={value} type="button" aria-pressed={theme === value} onClick={() => setTheme(value)}
                    className={`p-4 rounded-xl border-2 text-left transition-colors ${theme === value ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"}`}>
                    <div className={`w-full h-16 rounded-lg mb-3 ${value === "dark" ? "bg-gradient-to-br from-gray-950 to-gray-700" : "bg-gradient-to-br from-gray-100 to-white border border-gray-200"}`} />
                    <p className="text-sm font-semibold capitalize">{value} theme {theme === value ? "(Active)" : ""}</p>
                    <p className="text-xs text-muted-foreground mt-1">{value === "dark" ? "Low-light trading view" : "Bright, high-contrast view"}</p>
                  </button>
                ))}
              </div>
            </div>
          )}
        </motion.section>
      </div>
    </div>
  );
}
