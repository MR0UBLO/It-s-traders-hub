import { Resend } from "resend";
import nodemailer from "nodemailer";
import { logger } from "./logger.js";

function createResend() {
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) return null;
  return new Resend(key);
}

function createSmtpTransporter() {
  const user = process.env.EMAIL_USER?.trim();
  const pass = process.env.EMAIL_PASS?.trim().replace(/\s+/g, "");
  const host = process.env.EMAIL_HOST?.trim();
  const port = process.env.EMAIL_PORT ? Number(process.env.EMAIL_PORT) : undefined;
  if (!user || !pass) return null;
  if (host) {
    return nodemailer.createTransport({ host, port: port ?? 587, secure: (port ?? 587) === 465, auth: { user, pass } });
  }
  return nodemailer.createTransport({ host: "smtp.gmail.com", port: 465, secure: true, auth: { user, pass } });
}

function buildHtml(toEmail: string, toName: string, otpCode: string): string {
  return `
    <div style="font-family:'IBM Plex Sans',Arial,sans-serif;max-width:480px;margin:0 auto;background:#0d0e12;color:#f0f0f0;border-radius:12px;overflow:hidden;">
      <div style="background:#ff444f;padding:24px 32px;">
        <h1 style="margin:0;font-size:22px;font-weight:700;color:#fff;letter-spacing:-0.5px;">TradersHub</h1>
        <p style="margin:4px 0 0;font-size:13px;color:rgba(255,255,255,0.8);">Your professional trading terminal</p>
      </div>
      <div style="padding:32px;">
        <h2 style="margin:0 0 8px;font-size:20px;font-weight:600;">Verify your email</h2>
        <p style="color:#999;margin:0 0 24px;font-size:14px;">Hi ${toName}, use the code below to verify your TradersHub account. It expires in <strong style="color:#f0f0f0;">15 minutes</strong>.</p>
        <div style="background:#1a1c23;border:1px solid #2a2d38;border-radius:8px;padding:28px;text-align:center;margin-bottom:24px;">
          <p style="margin:0 0 8px;font-size:12px;color:#666;text-transform:uppercase;letter-spacing:2px;">Verification Code</p>
          <span style="font-size:40px;font-weight:700;letter-spacing:14px;color:#ff444f;font-family:monospace;">${otpCode}</span>
        </div>
        <p style="color:#666;font-size:13px;margin:0;">Never share this code with anyone. TradersHub will never ask for it by phone or email.</p>
      </div>
      <div style="padding:16px 32px;border-top:1px solid #1a1c23;">
        <p style="color:#444;font-size:11px;margin:0;">This email was sent to ${toEmail} because you created a TradersHub account.</p>
      </div>
    </div>
  `;
}

export async function sendOtpEmail(
  toEmail: string,
  toName: string,
  otpCode: string,
): Promise<boolean> {
  const html = buildHtml(toEmail, toName, otpCode);
  const subject = `${otpCode} — Your TradersHub verification code`;

  // ── 1. Try Resend first (preferred) ──────────────────────────────────────
  const resend = createResend();
  if (resend) {
    try {
      const from = "TradersHub <onboarding@resend.dev>";
      const { error } = await resend.emails.send({ from, to: toEmail, subject, html });
      if (error) {
        logger.error({ error, toEmail }, "Resend API error");
        return false;
      }
      logger.info({ toEmail }, "OTP email sent via Resend");
      return true;
    } catch (err) {
      logger.error({ err, toEmail }, "Resend send failed");
      return false;
    }
  }

  // ── 2. Fall back to SMTP (Gmail / custom) ────────────────────────────────
  const transporter = createSmtpTransporter();
  if (!transporter) {
    logger.warn({ toEmail }, "No email service configured (set RESEND_API_KEY or EMAIL_USER+EMAIL_PASS)");
    return false;
  }
  const from = `"TradersHub" <${process.env.EMAIL_USER?.trim()}>`;
  try {
    await transporter.sendMail({ from, to: toEmail, subject, html });
    logger.info({ toEmail }, "OTP email sent via SMTP");
    return true;
  } catch (err) {
    logger.error({ err, toEmail }, "SMTP send failed");
    return false;
  }
}
