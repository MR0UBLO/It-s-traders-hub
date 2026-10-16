import { Router } from "express";
import { db, depositsTable, walletsTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../middlewares/auth.js";
import { logger } from "../lib/logger.js";
import { sql } from "drizzle-orm";

const router = Router();

const MPESA_CONSUMER_KEY = process.env.MPESA_CONSUMER_KEY?.trim() || "";
const MPESA_CONSUMER_SECRET = process.env.MPESA_CONSUMER_SECRET?.trim() || "";
const MPESA_PASSKEY = process.env.MPESA_PASSKEY?.trim() || "";
const MPESA_ENV = (process.env.MPESA_ENV || "sandbox").trim().toLowerCase();
const IS_PRODUCTION = MPESA_ENV === "production";
// Never silently use Safaricom's sandbox shortcode for a live payment.
const MPESA_SHORTCODE = process.env.MPESA_SHORTCODE?.trim() || (IS_PRODUCTION ? "" : "174379");
const MPESA_USD_RATE = Number(process.env.MPESA_USD_RATE || 130);

const BASE_URL = IS_PRODUCTION
  ? "https://api.safaricom.co.ke"
  : "https://sandbox.safaricom.co.ke";

const LIVE_CREDENTIALS = !!(
  MPESA_CONSUMER_KEY && MPESA_CONSUMER_SECRET && MPESA_PASSKEY && MPESA_SHORTCODE
);

async function getMpesaToken(): Promise<string> {
  const credentials = Buffer.from(`${MPESA_CONSUMER_KEY}:${MPESA_CONSUMER_SECRET}`).toString("base64");
  const response = await fetch(`${BASE_URL}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: { Authorization: `Basic ${credentials}` },
  });
  if (!response.ok) {
    // Do not log credentials or authorization headers; include only the HTTP status for diagnosis.
    throw new Error(`Daraja OAuth token request failed (HTTP ${response.status}, environment=${MPESA_ENV})`);
  }
  const data = await response.json() as { access_token?: string };
  if (!data.access_token) {
    throw new Error(`Daraja OAuth response did not contain an access token (environment=${MPESA_ENV})`);
  }
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
    if (!/^254(?:7|1)\d{8}$/.test(normalizedPhone)) {
      res.status(400).json({ error: "Enter a valid Kenyan mobile number, for example 0712345678." });
      return;
    }

    if (!LIVE_CREDENTIALS) {
      res.status(503).json({
        error: `M-PESA ${MPESA_ENV} configuration is incomplete. Check MPESA_CONSUMER_KEY, MPESA_CONSUMER_SECRET, MPESA_PASSKEY, and MPESA_SHORTCODE in the backend environment.`,
      });
      return;
    }

    const callbackBaseUrl = process.env.CALLBACK_BASE_URL?.trim().replace(/\/$/, "");
    if (!callbackBaseUrl || !/^https:\/\//i.test(callbackBaseUrl)) {
      res.status(503).json({
        error: "M-PESA callback is not configured. Set CALLBACK_BASE_URL to the public HTTPS backend URL.",
      });
      return;
    }

    // Daraja expects a Nairobi-local timestamp in yyyyMMddHHmmss format.
    // ISO UTC timestamps can be rejected by production even when credentials are valid.
    const now = new Date();
    const nairobiParts = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Africa/Nairobi",
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
      hourCycle: "h23",
    }).formatToParts(now);
    const part = (type: string) => nairobiParts.find((p) => p.type === type)?.value ?? "";
    const timestamp = `${part("year")}${part("month")}${part("day")}${part("hour")}${part("minute")}${part("second")}`;
    const password = Buffer.from(`${MPESA_SHORTCODE}${MPESA_PASSKEY}${timestamp}`).toString("base64");
    const callbackUrl = `${callbackBaseUrl}/api/mpesa/callback`;
    if (callbackUrl.length > 256) {
      res.status(503).json({ error: "M-PESA callback URL is too long. Check CALLBACK_BASE_URL." });
      return;
    }

    const token = await getMpesaToken();
    const stkRes = await fetch(`${BASE_URL}/mpesa/stkpush/v1/processrequest`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        BusinessShortCode: MPESA_SHORTCODE,
        Password: password,
        Timestamp: timestamp,
        TransactionType: process.env.MPESA_TRANSACTION_TYPE === "CustomerBuyGoodsOnline" ? "CustomerBuyGoodsOnline" : "CustomerPayBillOnline",
        Amount: Math.round(amt),
        PartyA: normalizedPhone,
        PartyB: MPESA_SHORTCODE,
        PhoneNumber: normalizedPhone,
        CallBackURL: callbackUrl,
        AccountReference: "Tradollar",
        TransactionDesc: "Tradollar Wallet Deposit",
      }),
    });

    const stkData = await stkRes.json() as {
      ResponseCode?: string;
      CheckoutRequestID?: string;
      MerchantRequestID?: string;
      CustomerMessage?: string;
      errorMessage?: string;
      errorCode?: string;
      ResponseDescription?: string;
    };

    if (!stkRes.ok || stkData.ResponseCode !== "0") {
      // Safaricom's response helps distinguish live credential, shortcode, product, and payload issues.
      // Never log the consumer secret, passkey, OAuth token, or generated Password.
      logger.warn({
        status: stkRes.status,
        errorCode: stkData.errorCode,
        responseCode: stkData.ResponseCode,
        description: stkData.errorMessage || stkData.ResponseDescription,
        environment: MPESA_ENV,
      }, "Daraja STK Push rejected");
      res.status(400).json({
        error: stkData.errorMessage || stkData.ResponseDescription ||
          `Safaricom rejected the STK Push request (HTTP ${stkRes.status}, environment=${MPESA_ENV}). Check Render logs for the sanitized error details.`,
      });
      return;
    }

    logger.info({ checkoutRequestId: stkData.CheckoutRequestID }, "Daraja STK Push accepted");

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

    // Only credit the exact KES amount requested for this deposit.
    // Never trust a missing/zero callback amount as a substitute for the requested amount.
    if (!receipt || !Number.isFinite(amount) || amount <= 0 || amount !== Number(deposit.amount)) {
      logger.warn({ checkoutRequestId: CheckoutRequestID, expectedKes: Number(deposit.amount), receivedKes: amount }, "M-PESA callback amount/receipt mismatch; wallet not credited");
      await db.update(depositsTable).set({ status: "failed" }).where(and(
        eq(depositsTable.id, deposit.id),
        eq(depositsTable.status, "pending"),
      ));
      res.json({ ResultCode: 0, ResultDesc: "Accepted" });
      return;
    }

    // Conditional transition prevents duplicate callbacks from crediting the same deposit twice.
    const completed = await db.update(depositsTable).set({
      status: "completed",
      mpesaReceiptNumber: receipt,
      completedAt: new Date(),
    }).where(and(
      eq(depositsTable.id, deposit.id),
      eq(depositsTable.status, "pending"),
    )).returning({ id: depositsTable.id });

    if (completed.length === 0) {
      res.json({ ResultCode: 0, ResultDesc: "Accepted" });
      return;
    }

    // Deposit records are stored in KES, but Tradollar wallet balances are USD.
    const creditAmount = Number((amount / MPESA_USD_RATE).toFixed(4));
    await db.update(walletsTable).set({
      balance: sql`${walletsTable.balance} + ${creditAmount}`,
      totalDeposited: sql`${walletsTable.totalDeposited} + ${creditAmount}`,
    }).where(eq(walletsTable.userId, deposit.userId));

    logger.info({ userId: deposit.userId, creditAmount, receipt }, "Verified M-PESA deposit completed and wallet credited");
    res.json({ ResultCode: 0, ResultDesc: "Accepted" });
  } catch (err) {
    logger.error({ err }, "M-PESA callback error");
    res.json({ ResultCode: 0, ResultDesc: "Accepted" });
  }
});

export default router;
