import { useState } from "react";
import { motion } from "framer-motion";
import { Settings, User, Bell, Shield, Palette, Save } from "lucide-react";
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
];

export default function SettingsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("profile");
  const [name, setName] = useState(user?.name || "");

  const handleSave = () => {
    toast({ title: "Settings saved", description: "Your changes have been saved." });
  };

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <Settings className="w-7 h-7 text-primary" /> Settings
        </h1>
        <p className="text-muted-foreground mt-1">Manage your account preferences.</p>
      </motion.div>

      <div className="flex gap-6">
        <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="w-48 space-y-1 flex-shrink-0">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left ${
                activeTab === id ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-accent"
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </motion.div>

        <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} className="flex-1 glass-card rounded-2xl p-6">
          {activeTab === "profile" && (
            <div className="space-y-5">
              <h2 className="font-semibold text-lg">Profile Information</h2>
              <div className="flex items-center gap-4 mb-6">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-2xl font-bold text-primary">
                  {user?.name?.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="font-semibold">{user?.name}</p>
                  <p className="text-sm text-muted-foreground">{user?.email}</p>
                  {user?.isAdmin && <span className="text-xs text-primary font-semibold">Admin</span>}
                </div>
              </div>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Full Name</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} className="bg-background" />
                </div>
                <div className="space-y-1.5">
                  <Label>Email Address</Label>
                  <Input value={user?.email || ""} disabled className="bg-background opacity-60" />
                  <p className="text-xs text-muted-foreground">Email cannot be changed.</p>
                </div>
              </div>
              <Button onClick={handleSave} className="bg-primary hover:bg-primary/90 text-white gap-2">
                <Save className="w-4 h-4" /> Save Changes
              </Button>
            </div>
          )}

          {activeTab === "notifications" && (
            <div className="space-y-5">
              <h2 className="font-semibold text-lg">Notification Preferences</h2>
              {[
                { label: "Trade confirmations", desc: "Get notified when trades open or close" },
                { label: "Price alerts", desc: "Alerts when a market hits your target price" },
                { label: "Deposit confirmations", desc: "Confirm M-PESA deposits via email" },
                { label: "AI signal alerts", desc: "Receive new AI signal notifications" },
              ].map(({ label, desc }) => (
                <div key={label} className="flex items-center justify-between py-3 border-b border-border last:border-0">
                  <div>
                    <p className="font-medium text-sm">{label}</p>
                    <p className="text-xs text-muted-foreground">{desc}</p>
                  </div>
                  <div className="w-10 h-5 bg-primary rounded-full cursor-pointer relative">
                    <div className="absolute right-0.5 top-0.5 w-4 h-4 bg-white rounded-full shadow" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === "security" && (
            <div className="space-y-5">
              <h2 className="font-semibold text-lg">Security Settings</h2>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Current Password</Label>
                  <Input type="password" placeholder="••••••••" className="bg-background" />
                </div>
                <div className="space-y-1.5">
                  <Label>New Password</Label>
                  <Input type="password" placeholder="••••••••" className="bg-background" />
                </div>
                <div className="space-y-1.5">
                  <Label>Confirm New Password</Label>
                  <Input type="password" placeholder="••••••••" className="bg-background" />
                </div>
              </div>
              <Button onClick={handleSave} className="bg-primary hover:bg-primary/90 text-white gap-2">
                <Save className="w-4 h-4" /> Update Password
              </Button>
              <div className="p-4 rounded-xl bg-green-500/5 border border-green-500/20 mt-4">
                <p className="text-sm font-semibold text-green-500">✓ Email Verified</p>
                <p className="text-xs text-muted-foreground mt-0.5">Your email address is verified and secure.</p>
              </div>
            </div>
          )}

          {activeTab === "appearance" && (
            <div className="space-y-5">
              <h2 className="font-semibold text-lg">Appearance</h2>
              <p className="text-sm text-muted-foreground">TradersHub uses a dark theme optimised for trading.</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-4 rounded-xl border-2 border-primary bg-card/60 cursor-pointer">
                  <div className="w-full h-16 rounded-lg bg-gradient-to-br from-gray-900 to-gray-800 mb-2" />
                  <p className="text-xs font-semibold text-center">Dark (Active)</p>
                </div>
                <div className="p-4 rounded-xl border-2 border-transparent hover:border-border cursor-pointer opacity-50">
                  <div className="w-full h-16 rounded-lg bg-gradient-to-br from-gray-100 to-gray-200 mb-2" />
                  <p className="text-xs font-semibold text-center text-gray-500">Light (Soon)</p>
                </div>
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
