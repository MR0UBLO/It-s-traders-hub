*** Begin Patch
*** Update File: artifacts/big-profits/src/pages/login.tsx
@@
 import { TrendingUp, Loader2 } from "lucide-react";
+const API_URL = import.meta.env.VITE_API_URL;
@@
-    try {
-      const API_URL = import.meta.env.VITE_API_URL;
-      const res = await fetch(`${API_URL}/auth/login`, {
+    try {
+      const res = await fetch(`${API_URL}/auth/login`, {
         method: "POST",
         headers: { "Content-Type": "application/json" },
         body: JSON.stringify(values),
       });
*** End Patch
