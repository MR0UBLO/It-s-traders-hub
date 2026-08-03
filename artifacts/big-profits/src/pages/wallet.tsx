import { Link } from "wouter";
import { motion } from "framer-motion";
import { Wallet, ArrowDownCircle, ArrowUpCircle } from "lucide-react";

export default function WalletPage() {
  return (
    <div className="p-5 max-w-xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Wallet className="w-8 h-8 text-primary" />
          Wallet
        </h1>
        <p className="text-muted-foreground mt-2">
          Deposit or withdraw funds from your trading account.
        </p>
      </div>

      <div className="space-y-4">
        <Link href="/deposits">
          <motion.div
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="glass-card rounded-2xl p-6 cursor-pointer border border-border hover:border-primary transition"
          >
            <div className="flex items-center gap-4">
              <ArrowDownCircle className="w-10 h-10 text-green-500" />
              <div>
                <h2 className="text-xl font-bold">Deposit</h2>
                <p className="text-sm text-muted-foreground">
                  Add funds to your trading account.
                </p>
              </div>
            </div>
          </motion.div>
        </Link>

        <Link href="/withdraw">
          <motion.div
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="glass-card rounded-2xl p-6 cursor-pointer border border-border hover:border-primary transition"
          >
            <div className="flex items-center gap-4">
              <ArrowUpCircle className="w-10 h-10 text-red-500" />
              <div>
                <h2 className="text-xl font-bold">Withdraw</h2>
                <p className="text-sm text-muted-foreground">
                  Withdraw your available balance.
                </p>
              </div>
            </div>
          </motion.div>
        </Link>
      </div>
    </div>
  );
}