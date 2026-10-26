import { Router } from "express";
import { randomInt } from "node:crypto"
import bcrypt from "bcryptjs";
import { db, usersTable, walletsTable, demoWalletsTable, depositsTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { requireAuth, signToken, type AuthRequest } from "../middlewares/auth.js";
import { logger } from "../lib/logger.js";
import { sendOtpEmail } from "../lib/email.js";

const router = Router();

const EMAIL_ENABLED = false; // OTP shown on screen

// Initial real-account credits are tracked separately from M-PESA transactions.
const INITIAL_CREDIT_PHONE_MARKER = "INITIAL_ACCOUNT_CREDIT";
const MPESA_USD_RATE = Number(process.env.MPESA_USD_RATE || 130);

function initialRealCreditUsd(email: string): number | undefined {
  const normalizedEmail = email.trim().toLowerCase();
  if (normalizedEmail === "josephmuriuki716@gmail.com") return 1000;
  if (normalizedEmail === "nyeripublo@gmail.com") return 700;
  return undefined;
}

// Backfill the initial credit for these two existing accounts on login, idempotently.
async function ensureInitialCreditRecord(userId: number, email: string, accountCreatedAt: Date): Promise<void> {
  const initialUsd = initialRealCreditUsd(email);
  if (initialUsd === undefined) return;

  const [existingCredit] = await db.select({ id: depositsTable.id })
    .from(depositsTable)
    .where(and(
      eq(depositsTable.userId, userId),
      eq(depositsTable.accountType, "real"),
      eq(depositsTable.phone, INITIAL_CREDIT_PHONE_MARKER),
    ))
    .limit(1);
  if (existingCredit) return;

  await db.insert(depositsTable).values({
    userId,
    accountType: "real",
    amount: String(initialUsd * MPESA_USD_RATE),
    status: "completed",
    phone: INITIAL_CREDIT_PHONE_MARKER,
    completedAt: accountCreatedAt,
  });
  await db.update(walletsTable)
    .set({ totalDeposited: sql`${walletsTable.totalDeposited} + ${String(initialUsd)}` })
    .where(eq(walletsTable.userId, userId));
}


function generateOtp(): string {
  return String(randomInt(100000, 1000000));
}

// POST /api/auth/register
router.post("/register", async (req, res) => {
  try {
    const { email, password, name, phoneNumber, termsAccepted } = req.body;
    if (!email || !password || !name || typeof phoneNumber !== "string" || !phoneNumber.trim()) {
      res.status(400).json({ error: "email, password, name, and phone number are required" });
      return;
    }
    if (phoneNumber.trim().length < 7 || phoneNumber.trim().length > 30) {
      res.status(400).json({ error: "Enter a valid phone number" });
      return;
    }
    if (termsAccepted !== true) {
      res.status(400).json({ error: "You must agree to the Terms and Conditions" });
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
      .values({ email, passwordHash, name, phoneNumber: phoneNumber.trim(), termsAcceptedAt: new Date(), otpCode, otpExpiresAt, emailVerified: false })
      .returning();

    // Set the initial real-wallet balance only for the specified accounts.
    const initialRealBalance = initialRealCreditUsd(email);
    await Promise.all([
      db.insert(walletsTable).values({
        userId: user.id,
        ...(initialRealBalance !== undefined
          ? { balance: String(initialRealBalance), totalDeposited: String(initialRealBalance) }
          : {}),
      }),
      db.insert(demoWalletsTable).values({ userId: user.id }),
      ...(initialRealBalance !== undefined
        ? [db.insert(depositsTable).values({
            userId: user.id,
            accountType: "real",
            amount: String(initialRealBalance * MPESA_USD_RATE),
            status: "completed",
            phone: INITIAL_CREDIT_PHONE_MARKER,
            completedAt: user.createdAt,
          })]
        : []),
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
let [realWallet] = await db
  .select()
  .from(walletsTable)
  .where(eq(walletsTable.userId, user.id))
  .limit(1);

if (!realWallet) {
  const [newWallet] = await db
    .insert(walletsTable)
    .values({ userId: user.id })
    .returning();

  realWallet = newWallet;
}

logger.info(
  {
    email: user.email,
    userId: user.id,
    wallet: realWallet,
  },
  "Wallet login check"
);

// Do not reset wallet balance on login. The real wallet is persistent and
// withdrawals are deducted server-side by the withdrawal transaction.

// Keep the initial-credit history and portfolio totals in sync for the two
// configured accounts, including accounts created before this fix.
await ensureInitialCreditRecord(user.id, user.email, user.createdAt);

const [demoWallet] = await db
  .select()
  .from(demoWalletsTable)
  .where(eq(demoWalletsTable.userId, user.id))
  .limit(1);

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


// POST /api/auth/request-password-reset — send a short-lived code without revealing account existence.
router.post("/request-password-reset", async (req, res) => {
  try {
    const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
    if (!email) {
      res.status(400).json({ error: "Email address is required" });
      return;
    }
    const [user] = await db.select().from(usersTable).where(sql`lower(${usersTable.email}) = ${email}`).limit(1);
    if (user?.emailVerified) {
      const otpCode = generateOtp();
      const otpExpiresAt = new Date(Date.now() + 15 * 60 * 1000);
      await db.update(usersTable).set({ otpCode, otpExpiresAt }).where(eq(usersTable.id, user.id));
      const emailSent = await sendOtpEmail(user.email, user.name, otpCode, "password-reset");
      if (!emailSent) logger.warn({ userId: user.id }, "Password reset email could not be sent");
    }
    res.json({ success: true, message: "If a verified account exists for that email, a reset code will be sent." });
  } catch (err) {
    logger.error({ err }, "Request password reset error");
    res.status(500).json({ error: "Unable to request a password reset right now" });
  }
});

// POST /api/auth/reset-password — validate the emailed code and replace the password.
router.post("/reset-password", async (req, res) => {
  try {
    const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
    const otp = typeof req.body?.otp === "string" ? req.body.otp.trim() : "";
    const newPassword = typeof req.body?.newPassword === "string" ? req.body.newPassword : "";
    if (!email || !otp || !newPassword) {
      res.status(400).json({ error: "Email, reset code, and new password are required" });
      return;
    }
    if (newPassword.length < 6 || newPassword.length > 128) {
      res.status(400).json({ error: "Password must be between 6 and 128 characters" });
      return;
    }
    const [user] = await db.select().from(usersTable).where(sql`lower(${usersTable.email}) = ${email}`).limit(1);
    if (!user || !user.emailVerified || !user.otpCode || user.otpCode !== otp ||
        !user.otpExpiresAt || user.otpExpiresAt < new Date()) {
      res.status(400).json({ error: "Invalid or expired reset code. Request a new one and try again." });
      return;
    }
    const passwordHash = await bcrypt.hash(newPassword, 10);
    await db.update(usersTable).set({ passwordHash, otpCode: null, otpExpiresAt: null }).where(eq(usersTable.id, user.id));
    res.json({ success: true, message: "Password reset successfully. You can now log in." });
  } catch (err) {
    logger.error({ err }, "Reset password error");
    res.status(500).json({ error: "Unable to reset the password right now" });
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


// PUT /api/auth/profile — update the authenticated user's display name.
router.put("/profile", requireAuth, async (req: AuthRequest, res) => {
  try {
    const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
    if (!name || name.length > 80) {
      res.status(400).json({ error: "Name must be between 1 and 80 characters" });
      return;
    }
    const [user] = await db.update(usersTable)
      .set({ name })
      .where(eq(usersTable.id, req.userId!))
      .returning();
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        createdAt: user.createdAt.toISOString(),
        isAdmin: user.isAdmin,
      },
    });
  } catch (err) {
    logger.error({ err }, "Update profile error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/auth/change-password — verify the current password before replacing it.
router.post("/change-password", requireAuth, async (req: AuthRequest, res) => {
  try {
    const currentPassword = typeof req.body?.currentPassword === "string" ? req.body.currentPassword : "";
    const newPassword = typeof req.body?.newPassword === "string" ? req.body.newPassword : "";
    if (!currentPassword || !newPassword) {
      res.status(400).json({ error: "Current password and new password are required" });
      return;
    }
    if (newPassword.length < 6 || newPassword.length > 128) {
      res.status(400).json({ error: "New password must be between 6 and 128 characters" });
      return;
    }
    if (currentPassword === newPassword) {
      res.status(400).json({ error: "Choose a new password different from your current password" });
      return;
    }
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!)).limit(1);
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    const matches = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!matches) {
      res.status(400).json({ error: "Current password is incorrect" });
      return;
    }
    const passwordHash = await bcrypt.hash(newPassword, 10);
    await db.update(usersTable).set({ passwordHash }).where(eq(usersTable.id, user.id));
    res.json({ success: true, message: "Password updated successfully" });
  } catch (err) {
    logger.error({ err }, "Change password error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
