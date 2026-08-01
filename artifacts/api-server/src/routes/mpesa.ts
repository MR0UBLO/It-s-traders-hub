import { Router } from "express";
import { db, depositsTable, walletsTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../middlewares/auth.js";
import { logger } from "../lib/logger.js";
import { sql } from "drizzle-orm";

const router = Router();

const MPESA_CONSUMER_KEY = process.env.MPESA_CONSUMER_KEY || "";
const MPESA_CONSUMER_SECRET = process.env.MPESA_CONSUMER_SECRET || "";
const MPESA_PASSKEY = process.env.MPESA_PASSKEY || "";
const MPESA_SHORTCODE = process.env.MPESA_SHORTCODE || "174379";
const MPESA_ENV = process.env.MPESA_ENV || "sandbox";

const BASE_URL = MPESA_ENV === "production"
  ? "https://api.safaricom.co.ke"
  : "https://sandbox.safaricom.co.ke";

const LIVE_CREDENTIALS = !!(MPESA_CONSUMER_KEY && MPESA_CONSUMER_SECRET && MPESA_PASSKEY);

async function getMpesaToken(): Promise<string> {
  const credentials = Buffer.from(`${MPESA_CONSUMER_KEY}:${MPESA_CONSUMER_SECRET}`).toString("base64");
  const response = await fetch(`${BASE_URL}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: { Authorization: `Basic ${credentials}` },
  });
  if (!response.ok) throw new Error(`Failed to get M-PESA token: ${response.status}`);
  const data = await response.json() as { access_token: string };
  return data.access_token;
}

function normalizePhone(phone: string): string {
  let p = String(phone).replace(/\D/g, "");
  if (p.startsWith("0")) p = "254" + p.slice(1);
  if (!p.startsWith("254")) p = "254" + p;
  return p;
}

// POST /api/mpesa/stkpush
router.post("/stkpush", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { phone, amount } = req.body;
    if (!phone || !amount) {
      res.status(400).json({ error: "phone and amount are required" });
      return;
    }

    const amt = Number(amount);
    if (isNaN(amt) || amt < 10) {
      res.status(400).json({ error: "Minimum deposit is KES 10" });
      return;
    }

    const normalizedPhone = normalizePhone(phone);

    if (!LIVE_CREDENTIALS) {
      // Simulation mode — auto-credit wallet immediately
      const checkoutRequestId = `SIM-CHK-${Date.now()}`;
      await db.insert(depositsTable).values({
        userId: req.userId!,
        amount: String(amt),
        status: "completed",
        phone: normalizedPhone,
        mpesaReceiptNumber: `SIM${Date.now()}`,
        checkoutRequestId,
        completedAt: new Date(),
      });

      await db.update(walletsTable).set({
        balance: sql`${walletsTable.balance} + ${amt}`,
        totalDeposited: sql`${walletsTable.totalDeposited} + ${amt}`,
      }).where(eq(walletsTable.userId, req.userId!));

      logger.info({ userId: req.userId, amt }, "M-PESA simulation deposit credited");

      res.json({
        success: true,
        simulation: true,
        checkoutRequestId,
        message: "Deposit credited instantly (simulation mode — Daraja credentials not configured yet)",
      });
      return;
    }

    // Real Daraja STK Push
    const timestamp = new Date().toISOString().replace(/[-T:.Z]/g, "").slice(0, 14);
    const password = Buffer.from(`${MPESA_SHORTCODE}${MPESA_PASSKEY}${timestamp}`).toString("base64");
    const callbackUrl = `${process.env.CALLBACK_BASE_URL}/api/mpesa/callback`;

    const token = await getMpesaToken();
    const stkRes = await fetch(
  "https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest",
  {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      BusinessShortCode: MPESA_SHORTCODE,
      Password: password,
      Timestamp: timestamp,
      TransactionType: "CustomerPayBillOnline",
      Amount: Math.round(amt),
      PartyA: normalizedPhone,
      PartyB: MPESA_SHORTCODE,
      PhoneNumber: normalizedPhone,
      CallBackURL: callbackUrl,
      AccountReference: "TradersHub",
      TransactionDesc: "TradersHub Wallet Deposit",
    }),
  }
);

    const stkData = await stkRes.json() as {
      ResponseCode?: string;
      CheckoutRequestID?: string;
      MerchantRequestID?: string;
      CustomerMessage?: string;
      errorMessage?: string;
      errorCode?: string;
    };

    logger.info({ stkData }, "STK Push response");

    if (stkData.ResponseCode !== "0") {
      res.status(400).json({ error: stkData.errorMessage || "STK Push failed. Please try again." });
      return;
    }

    await db.insert(depositsTable).values({
      userId: req.userId!,
      amount: String(amt),
      status: "pending",
      phone: normalizedPhone,
      checkoutRequestId: stkData.CheckoutRequestID,
      merchantRequestId: stkData.MerchantRequestID,
    });

    res.json({
      success: true,
      simulation: false,
      checkoutRequestId: stkData.CheckoutRequestID || "",
      message: stkData.CustomerMessage || "Check your phone and enter your M-PESA PIN to complete the deposit.",
    });
  } catch (err) {
    logger.error({ err }, "STK push error");
    res.status(500).json({ error: "Internal server error. Please try again." });
  }
});

// GET /api/mpesa/status/:checkoutRequestId — frontend polls this after STK push
router.get("/status/:checkoutRequestId", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { checkoutRequestId } = req.params;

    const [deposit] = await db
      .select()
      .from(depositsTable)
      .where(
        and(
          eq(depositsTable.checkoutRequestId, String(checkoutRequestId)),
          eq(depositsTable.userId, req.userId!),
        ),
      )
      .orderBy(desc(depositsTable.createdAt))
      .limit(1);

    if (!deposit) {
      res.status(404).json({ error: "Deposit not found" });
      return;
    }

    res.json({
      status: deposit.status,
      amount: Number(deposit.amount),
      mpesaReceiptNumber: deposit.mpesaReceiptNumber,
      completedAt: deposit.completedAt,
    });
  } catch (err) {
    logger.error({ err }, "Status check error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/mpesa/callback — Safaricom calls this after payment
router.post("/callback", async (req, res) => {
  try {
    const callback = req.body?.Body?.stkCallback;
    if (!callback) {
      res.json({ ResultCode: 0, ResultDesc: "Accepted" });
      return;
    }

    const { CheckoutRequestID, ResultCode, CallbackMetadata } = callback;
    logger.info({ CheckoutRequestID, ResultCode }, "M-PESA callback received");

    if (ResultCode !== 0) {
      await db.update(depositsTable)
        .set({ status: "failed" })
        .where(and(
          eq(depositsTable.checkoutRequestId, CheckoutRequestID),
          eq(depositsTable.status, "pending"),
        ));
      res.json({ ResultCode: 0, ResultDesc: "Accepted" });
      return;
    }

    const meta: Record<string, unknown> = {};
    if (CallbackMetadata?.Item) {
      for (const item of CallbackMetadata.Item) {
        meta[item.Name] = item.Value;
      }
    }

    const receipt = String(meta["MpesaReceiptNumber"] || "");
    const amount = Number(meta["Amount"] || 0);

    const [deposit] = await db.select().from(depositsTable)
      .where(and(
        eq(depositsTable.checkoutRequestId, CheckoutRequestID),
        eq(depositsTable.status, "pending"),
      ))
      .limit(1);

    if (!deposit) {
      res.json({ ResultCode: 0, ResultDesc: "Accepted" });
      return;
    }

    await db.update(depositsTable).set({
      status: "completed",
      mpesaReceiptNumber: receipt,
      completedAt: new Date(),
    }).where(eq(depositsTable.id, deposit.id));

    const creditAmount = amount > 0 ? amount : Number(deposit.amount);
    await db.update(walletsTable).set({
      balance: sql`${walletsTable.balance} + ${creditAmount}`,
      totalDeposited: sql`${walletsTable.totalDeposited} + ${creditAmount}`,
    }).where(eq(walletsTable.userId, deposit.userId));

    logger.info({ userId: deposit.userId, creditAmount, receipt }, "M-PESA deposit completed and wallet credited");
    res.json({ ResultCode: 0, ResultDesc: "Accepted" });
  } catch (err) {
    logger.error({ err }, "M-PESA callback error");
    res.json({ ResultCode: 0, ResultDesc: "Accepted" });
  }
});

export default router;
