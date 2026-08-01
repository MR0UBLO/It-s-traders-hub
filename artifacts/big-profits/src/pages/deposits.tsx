*** Begin Patch
*** Update File: artifacts/big-profits/src/pages/deposits.tsx
@@
   const startPolling = (cid: string) => {
@@
-    pollingRef.current = setInterval(async () => {
+    pollingRef.current = setInterval(async () => {
       try {
-        const res = await fetch(`/api/mpesa/status/${cid}`, { headers: { Authorization: `Bearer ${token}` } });
+        const API_URL = import.meta.env.VITE_API_URL;
+        const res = await fetch(`${API_URL}/mpesa/status/${cid}`, { headers: { Authorization: `Bearer ${token}` } });
         if (!res.ok) return;
         const data = await res.json();
@@
   const handleMpesaDeposit = async (e: React.FormEvent) => {
@@
-      const kesAmount = Math.round(numAmount * USD_RATE);
-      const res = await fetch("/api/mpesa/stkpush", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ phone, amount: kesAmount }) });
+      const kesAmount = Math.round(numAmount * USD_RATE);
+      const API_URL = import.meta.env.VITE_API_URL;
+      const res = await fetch(`${API_URL}/mpesa/stkpush`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ phone, amount: kesAmount }) });
*** End Patch
