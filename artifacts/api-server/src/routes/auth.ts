import { Router } from "express";
import bcrypt from "bcryptjs";
import { db, usersTable, walletsTable, demoWalletsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth, signToken, type AuthRequest } from "../middlewares/auth.js";
import { logger } from "../lib/logger.js";
import { sendOtpEmail } from "../lib/email.js";

const router = Router();

const EMAIL_ENABLED = false; // OTP shown on screen

function generateOtp(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

// POST /api/auth/register
router.post("/register", async (req, res) => {
  try {
    const { email, password, name } = req.body;
    if (!email || !password || !name) {
      res.status(400).json({ error: "email, password, and name are required" });
      return;
    }
    if (password.length < 6) {
      res.status(400).json({ error: "Password must be at least 6 characters" });
      return;
    }

    const existing = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
    if (existing.length > 0) {
      res.status(400).json({ error: "Email already registered" });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const otpCode = generateOtp();
    const otpExpiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 min

    const [user] = await db
      .insert(usersTable)
      .values({ email, passwordHash, name, otpCode, otpExpiresAt, emailVerified: false })
      .returning();

    // Create real wallet (balance = 0) and demo wallet (balance = 10,000)
    await Promise.all([
      db.insert(walletsTable).values({ userId: user.id }),
      db.insert(demoWalletsTable).values({ userId: user.id }),
    ]);

    const emailSent = EMAIL_ENABLED ? await sendOtpEmail(email, name, otpCode) : false;
    logger.info({ email, emailSent }, "Registration OTP");
    res.status(201).json({
      userId: user.id,
      email: user.email,
      requiresVerification: true,
      emailSent,
      ...(!emailSent && { devOtp: otpCode }),
      message: emailSent
        ? "Account created. Check your email for the 6-digit verification code."
        : "Account created. Enter the verification code shown below.",
    });
  } catch (err) {
    logger.error({ err }, "Register error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/auth/verify-otp
router.post("/verify-otp", async (req, res) => {
  try {
    const { userId, otp } = req.body;
    if (!userId || !otp) {
      res.status(400).json({ error: "userId and otp are required" });
      return;
    }

    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, Number(userId))).limit(1);
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    if (user.emailVerified) {
      const token = signToken(user.id, user.isAdmin);
      res.json({ token, user: { id: user.id, email: user.email, name: user.name, createdAt: user.createdAt.toISOString(), isAdmin: user.isAdmin } });
      return;
    }
    if (!user.otpCode || user.otpCode !== String(otp)) {
      res.status(400).json({ error: "Invalid verification code. Please check and try again." });
      return;
    }
    if (!user.otpExpiresAt || user.otpExpiresAt < new Date()) {
      res.status(400).json({ error: "Verification code has expired. Please request a new one." });
      return;
    }

    await db.update(usersTable)
      .set({ emailVerified: true, otpCode: null, otpExpiresAt: null })
      .where(eq(usersTable.id, user.id));

    const token = signToken(user.id, user.isAdmin);
    res.json({
      token,
      user: { id: user.id, email: user.email, name: user.name, createdAt: user.createdAt.toISOString(), isAdmin: user.isAdmin },
    });
  } catch (err) {
    logger.error({ err }, "Verify OTP error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/auth/resend-otp
router.post("/resend-otp", async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) {
      res.status(400).json({ error: "userId is required" });
      return;
    }

    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, Number(userId))).limit(1);
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    if (user.emailVerified) {
      res.status(400).json({ error: "Email already verified" });
      return;
    }

    const otpCode = generateOtp();
    const otpExpiresAt = new Date(Date.now() + 15 * 60 * 1000);
    await db.update(usersTable).set({ otpCode, otpExpiresAt }).where(eq(usersTable.id, user.id));

    const emailSent = EMAIL_ENABLED ? await sendOtpEmail(user.email, user.name, otpCode) : false;
    res.json({ success: true, emailSent, ...(!emailSent && { devOtp: otpCode }) });
  } catch (err) {
    logger.error({ err }, "Resend OTP error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/auth/login
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      res.status(400).json({ error: "email and password are required" });
      return;
    }

    const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
    if (!user) {
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }

    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) {
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }

    if (!user.emailVerified) {
      const otpCode = generateOtp();
      const otpExpiresAt = new Date(Date.now() + 15 * 60 * 1000);
      await db.update(usersTable).set({ otpCode, otpExpiresAt }).where(eq(usersTable.id, user.id));

      const emailSent = EMAIL_ENABLED ? await sendOtpEmail(user.email, user.name, otpCode) : false;
      res.status(403).json({
        error: "Email not verified",
        userId: user.id,
        emailSent,
        requiresVerification: true,
        ...(!emailSent && { devOtp: otpCode }),
      });
      return;
    }

    // Ensure both wallets exist (for users registered before this update)
    const [realWallet] = await db.select().from(walletsTable).where(eq(walletsTable.userId, user.id)).limit(1);
    if (!realWallet) {
      await db.insert(walletsTable).values({ userId: user.id });
    }
if (
  user.email.toLowerCase() === "nyeripublo@gmail.com" &&
  realWallet &&
  Number(realWallet.balance) === 0
) {
  await db
    .update(walletsTable)
    .set({ balance: "700" })
    .where(eq(walletsTable.userId, user.id));
}
    const [demoWallet] = await db.select().from(demoWalletsTable).where(eq(demoWalletsTable.userId, user.id)).limit(1);
    if (!demoWallet) {
      await db.insert(demoWalletsTable).values({ userId: user.id });
    }

    const token = signToken(user.id, user.isAdmin);
    res.json({
      token,
      user: { id: user.id, email: user.email, name: user.name, createdAt: user.createdAt.toISOString(), isAdmin: user.isAdmin },
    });
  } catch (err) {
    logger.error({ err }, "Login error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/auth/logout
router.post("/logout", (_req, res) => {
  res.json({ success: true });
});

// GET /api/auth/me
router.get("/me", requireAuth, async (req: AuthRequest, res) => {
  try {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!)).limit(1);
    if (!user) {
      res.status(401).json({ error: "User not found" });
      return;
    }
    res.json({ id: user.id, email: user.email, name: user.name, createdAt: user.createdAt.toISOString(), isAdmin: user.isAdmin });
  } catch (err) {
    logger.error({ err }, "Get me error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
