*** Begin Patch
*** Update File: artifacts/big-profits/src/pages/trade.tsx
@@
 function TvChart({ symbol, timeframe, indicators }: TvChartProps) {
-  const containerRef    = useRef<HTMLDivElement>(null);
+  const containerRef    = useRef<HTMLDivElement>(null);
+  const API_URL = import.meta.env.VITE_API_URL;
@@
-      const [candleRes, priceRes] = await Promise.all([
-        fetch(`https://it-s-traders-hub.onrender.com/api/market/candles/${symbol}/${timeframe}?limit=300`),
-        fetch(`/api/market/prices`),
-      ]);
+      const [candleRes, priceRes] = await Promise.all([
+        fetch(`${API_URL}/market/candles/${symbol}/${timeframe}?limit=300`),
+        fetch(`${API_URL}/market/prices`),
+      ]);
*** End Patch
