*** Begin Patch
*** Update File: artifacts/big-profits/src/pages/verify-otp.tsx
@@
 import { TrendingUp, Loader2, ShieldCheck, RefreshCw } from "lucide-react";
+const API_URL = import.meta.env.VITE_API_URL;
@@
-      const res  = await fetch("/api/auth/resend-otp", {
+      const res  = await fetch(`${API_URL}/auth/resend-otp`, {
         method: "POST",
         headers: { "Content-Type": "application/json" },
         body: JSON.stringify({ userId: Number(userId) }),
       });
*** End Patch
