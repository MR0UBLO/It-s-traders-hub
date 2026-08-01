*** Begin Patch
*** Update File: artifacts/api-server/src/routes/auth.ts
@@
 router.post("/login", async (req, res) => {
   try {
     const { email, password } = req.body;
+    logger.info({ email }, "Login attempt");
     if (!email || !password) {
       res.status(400).json({ error: "email and password are required" });
       return;
     }
 
     const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
+    logger.info({ email, userFound: !!user, userId: user?.id ?? null }, "Login DB lookup");
     if (!user) {
       res.status(401).json({ error: "Invalid email or password" });
       return;
     }
 
     const match = await bcrypt.compare(password, user.passwordHash);
+    logger.info({ email, userId: user.id, passwordMatch: match }, "Login password compare");
     if (!match) {
       res.status(401).json({ error: "Invalid email or password" });
       return;
     }
@@
-    const token = signToken(user.id, user.isAdmin);
+    logger.info({ userId: user.id }, "Signing JWT for user");
+    const token = signToken(user.id, user.isAdmin);
*** End Patch
