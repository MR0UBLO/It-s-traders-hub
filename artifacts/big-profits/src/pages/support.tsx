import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { HelpCircle, ChevronDown, MessageCircle, Mail, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

const FAQS = [
  { q: "How do I make a deposit?", a: "Go to the Deposits page, enter your M-PESA phone number (format: 254XXXXXXXXX) and the amount. You'll receive an STK push prompt on your phone to authorise the payment. Funds reflect instantly." },
  { q: "How is profit and loss calculated?", a: "When you open a position, your entry price is locked at the live market rate. P/L moves in real time as the market moves. When you close, the net result — based on price movement and position size — is applied to your balance." },
  { q: "What is copy trading?", a: "Copy trading lets you automatically mirror the trades of top-performing traders on the platform. Navigate to Copy Trading, browse the leaderboard, and click Follow on any trader." },
  { q: "How long does an M-PESA deposit take?", a: "Funds reflect within 30 seconds of completing the STK push on your phone." },
  { q: "Why was my OTP code invalid?", a: "OTP codes expire after 10 minutes. If yours expired, click 'Resend code' on the verification screen to get a new one sent to your email." },
  { q: "Can I withdraw my balance?", a: "Navigate to the Withdraw page to request a withdrawal. Withdrawals are processed within 24 hours back to your registered M-PESA number." },
  { q: "What markets can I trade?", a: "TradersHub currently supports XAUUSD (Gold), EURUSD (Euro/Dollar), and BTCUSD (Bitcoin). More markets are coming soon." },
];

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-border last:border-0">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between py-4 text-left gap-3 hover:text-primary transition-colors"
      >
        <span className="font-medium text-sm">{q}</span>
        <motion.div animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronDown className="w-4 h-4 flex-shrink-0 text-muted-foreground" />
        </motion.div>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <p className="text-sm text-muted-foreground pb-4 leading-relaxed">{a}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function Support() {
  const { toast } = useToast();
  const [message, setMessage] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    toast({ title: "Message sent", description: "Our support team will respond within 24 hours." });
    setMessage("");
  };

  return (
    <div className="p-6 space-y-8 max-w-4xl mx-auto">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <HelpCircle className="w-7 h-7 text-primary" /> Support
        </h1>
        <p className="text-muted-foreground mt-1">We're here to help. Find answers or reach out.</p>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { icon: MessageCircle, label: "Live Chat", desc: "Chat with us now", value: "Online" },
          { icon: Mail, label: "Email", desc: "support@tradershub.com", value: "< 24h reply" },
          { icon: Phone, label: "WhatsApp", desc: "+254 700 000 000", value: "Mon–Fri 9am–6pm" },
        ].map(({ icon: Icon, label, desc, value }, i) => (
          <motion.div
            key={label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }}
            className="glass-card rounded-2xl p-5 flex items-center gap-4"
          >
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Icon className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="font-semibold text-sm">{label}</p>
              <p className="text-xs text-muted-foreground">{desc}</p>
              <p className="text-xs text-green-500 font-medium mt-0.5">{value}</p>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }} className="glass-card rounded-2xl p-6">
          <h2 className="font-bold text-lg mb-4">Frequently Asked Questions</h2>
          <div>
            {FAQS.map((faq) => <FaqItem key={faq.q} {...faq} />)}
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }} className="glass-card rounded-2xl p-6">
          <h2 className="font-bold text-lg mb-4">Send a Message</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-sm">Subject</Label>
              <Input placeholder="What do you need help with?" className="bg-background" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Message</Label>
              <textarea
                rows={6}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Describe your issue in detail..."
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <Button type="submit" className="w-full bg-primary hover:bg-primary/90 text-white">
              Send Message
            </Button>
          </form>
        </motion.div>
      </div>
    </div>
  );
}
