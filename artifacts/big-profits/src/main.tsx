*** Begin Patch
*** Update File: artifacts/big-profits/src/main.tsx
@@
 import "./index.css";
 import { setBaseUrl } from "@workspace/api-client-react";
-
-setBaseUrl(import.meta.env.VITE_API_URL);
+
+// Use configured VITE_API_URL in production; fallback to "/api" for local dev
+setBaseUrl(import.meta.env.VITE_API_URL ?? "/api");
*** End Patch
