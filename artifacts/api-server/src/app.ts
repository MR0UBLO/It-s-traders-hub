*** Begin Patch
*** Update File: artifacts/api-server/src/app.ts
@@
-// ── CORS ──────────────────────────────────────────────────────────────────────
-app.use(cors({ origin: "*", methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"] }));
+// ── CORS ──────────────────────────────────────────────────────────────────────
+const FRONTEND_URL = process.env.FRONTEND_URL || "*";
+const corsOptions: any = {
+  origin: FRONTEND_URL,
+  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
+};
+if (FRONTEND_URL !== "*") {
+  corsOptions.credentials = true;
+}
+app.use(cors(corsOptions));
*** End Patch
