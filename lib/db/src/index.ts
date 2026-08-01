*** Begin Patch
*** Update File: lib/db/src/index.ts
@@
-export const pool = new Pool({ connectionString: process.env.DATABASE_URL });
+export const pool = new Pool({
+  connectionString: process.env.DATABASE_URL,
+  // Supabase requires SSL. In hosted environments (Render) TLS verification
+  // can fail unless we explicitly allow the client to connect. This is the
+  // common setting used to make connections reliable from managed hosts.
+  ssl: { rejectUnauthorized: false },
+});
*** End Patch
