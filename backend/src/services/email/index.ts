/**
 * ============================================================================
 * Toroloom — Email Service (Resend)
 * ============================================================================
 *
 * Sends transactional emails via Resend API (https://resend.com).
 * Used primarily for invoice/receipt emails after successful subscription payments.
 *
 * Usage:
 *   import { sendInvoiceEmail } from '../services/email';
 *   await sendInvoiceEmail({
 *     to: 'user@example.com',
 *     userName: 'John Doe',
 *     planName: 'Pro',
 *     amount: 399,
 *     currency: 'INR',
 *     transactionId: 'TXN123',
 *     invoiceId: 'INV-2026-001',
 *     billingPeriod: 'monthly',
 *     paymentMethod: 'razorpay',
 *     timestamp: '2026-07-19T10:30:00.000Z',
 *     discountApplied: 0,
 *     couponCode: undefined,
 *   });
 *
 * ============================================================================
 */

import { Resend } from 'resend';

// ──── Initialize Resend (lazy — OK if API key not set) ────────────────────

let _resend: Resend | null = null;

function getResend(): Resend | null {
  if (_resend) return _resend;
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn('[Email] RESEND_API_KEY not configured — email sending disabled');
    return null;
  }
  try {
    _resend = new Resend(apiKey);
    return _resend;
  } catch {
    console.warn('[Email] Failed to initialize Resend client');
    return null;
  }
}

// ──── Types ────────────────────────────────────────────────────────────────

export interface InvoiceEmailParams {
  to: string;
  userName: string;
  planName: string;
  amount: number;
  currency: string;
  transactionId: string;
  invoiceId: string;
  billingPeriod: 'monthly' | 'yearly';
  paymentMethod: 'razorpay' | 'upi_autopay' | 'coupon';
  timestamp: string;
  discountApplied?: number;
  couponCode?: string;
}

// ──── Helpers ──────────────────────────────────────────────────────────────

function fmtINR(amount: number): string {
  return '₹' + amount.toLocaleString('en-IN');
}

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

function methodLabel(method: string): string {
  switch (method) {
    case 'razorpay': return 'Razorpay (Card / UPI / NetBanking)';
    case 'upi_autopay': return 'UPI AutoPay';
    case 'coupon': return 'Coupon';
    default: return method;
  }
}

// ──── HTML Invoice Template ───────────────────────────────────────────────

function buildInvoiceHTML(params: InvoiceEmailParams): string {
  const netAmount = params.amount - (params.discountApplied || 0);
  const taxAmount = Math.round(netAmount * 0.18); // 18% GST
  const totalAmount = netAmount + taxAmount;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, 'Helvetica Neue', 'Segoe UI', Roboto, Arial, sans-serif;
      background: #F4F5FA;
      padding: 20px;
    }
    .container {
      max-width: 560px;
      margin: 0 auto;
      background: #FFFFFF;
      border-radius: 16px;
      overflow: hidden;
    }
    .header {
      background: linear-gradient(135deg, #6C63FF, #3B82F6);
      padding: 32px 32px 24px;
      text-align: center;
    }
    .header-logo {
      font-size: 28px;
      font-weight: 800;
      color: #FFFFFF;
      letter-spacing: 1px;
    }
    .header-sub {
      font-size: 11px;
      color: rgba(255,255,255,0.7);
      letter-spacing: 2px;
      text-transform: uppercase;
      margin-top: 4px;
    }
    .header-badge {
      display: inline-block;
      background: rgba(255,255,255,0.2);
      color: #FFFFFF;
      padding: 6px 20px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 1px;
      text-transform: uppercase;
      margin-top: 12px;
    }
    .body-content {
      padding: 32px;
    }
    .greeting {
      font-size: 18px;
      font-weight: 700;
      color: #1A1A2E;
      margin-bottom: 4px;
    }
    .greeting-sub {
      font-size: 13px;
      color: #6E6E9A;
      margin-bottom: 20px;
      line-height: 1.5;
    }
    .plan-card {
      background: ${params.planName === 'Elite' ? '#10B981' : '#3B82F6'}08;
      border: 1px solid ${params.planName === 'Elite' ? '#10B981' : '#3B82F6'}20;
      border-radius: 12px;
      padding: 20px;
      margin-bottom: 20px;
    }
    .plan-name {
      font-size: 20px;
      font-weight: 800;
      color: #1A1A2E;
    }
    .plan-period {
      font-size: 11px;
      color: #6E6E9A;
      margin-top: 2px;
    }
    .plan-price {
      font-size: 28px;
      font-weight: 800;
      color: ${params.planName === 'Elite' ? '#10B981' : '#3B82F6'};
      margin-top: 8px;
    }
    .details-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 16px;
    }
    .details-table td {
      padding: 6px 0;
      border-bottom: 1px solid #F0F0F8;
      font-size: 13px;
    }
    .details-table td:last-child {
      text-align: right;
      font-weight: 600;
      color: #1A1A2E;
    }
    .details-table .label {
      color: #9A9AB0;
    }
    .details-table .discount {
      color: #00C853;
    }
    .total-row td {
      padding-top: 12px;
      border-top: 2px solid #E0E0F0;
      font-size: 16px;
      font-weight: 800;
      color: #1A1A2E;
    }
    .transaction-box {
      background: #F8F8FE;
      border-radius: 10px;
      padding: 16px;
      margin-bottom: 20px;
    }
    .transaction-box h3 {
      font-size: 11px;
      color: #9A9AB0;
      text-transform: uppercase;
      letter-spacing: 2px;
      margin-bottom: 10px;
    }
    .txn-grid {
      display: flex;
      flex-wrap: wrap;
      gap: 2px 24px;
    }
    .txn-item {
      flex: 0 0 auto;
    }
    .txn-item .label {
      font-size: 10px;
      color: #9A9AB0;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    .txn-item .value {
      font-size: 12px;
      color: #1A1A2E;
      font-weight: 600;
      font-family: 'Courier New', monospace;
    }
    .btn-container {
      text-align: center;
      margin: 24px 0;
    }
    .btn {
      display: inline-block;
      padding: 12px 32px;
      background: linear-gradient(135deg, #6C63FF, #3B82F6);
      color: #FFFFFF !important;
      text-decoration: none;
      border-radius: 30px;
      font-size: 14px;
      font-weight: 700;
    }
    .footer-text {
      text-align: center;
      font-size: 11px;
      color: #9A9AB0;
      line-height: 1.6;
      padding-top: 20px;
      border-top: 1px solid #E0E0F0;
    }
    .footer-text a {
      color: #6C63FF;
      text-decoration: none;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="header-logo">Toroloom</div>
      <div class="header-sub">Intelligence Meets Execution</div>
      <div class="header-badge">Payment Receipt</div>
    </div>

    <div class="body-content">
      <div class="greeting">Thank you, ${params.userName}! 🎉</div>
      <div class="greeting-sub">
        Your ${params.planName} plan payment has been received successfully.
        Your premium features are now active.
      </div>

      <div class="plan-card">
        <div class="plan-name">${params.planName} Plan</div>
        <div class="plan-period">${params.billingPeriod === 'monthly' ? 'Monthly Billing' : 'Yearly Billing'}</div>
        <div class="plan-price">${fmtINR(params.amount)}</div>
      </div>

      <table class="details-table">
        <tr>
          <td class="label">Subtotal</td>
          <td>${fmtINR(params.amount)}</td>
        </tr>
        ${params.discountApplied && params.discountApplied > 0 ? `
        <tr>
          <td class="label">Discount${params.couponCode ? ` (${params.couponCode})` : ''}</td>
          <td class="discount">-${fmtINR(params.discountApplied)}</td>
        </tr>` : ''}
        <tr>
          <td class="label">GST (18%)</td>
          <td>${fmtINR(taxAmount)}</td>
        </tr>
        <tr class="total-row">
          <td>Total Charged</td>
          <td>${fmtINR(totalAmount)}</td>
        </tr>
      </table>

      <div class="transaction-box">
        <h3>Transaction Details</h3>
        <div class="txn-grid">
          <div class="txn-item">
            <div class="label">Invoice #</div>
            <div class="value">${params.invoiceId}</div>
          </div>
          <div class="txn-item">
            <div class="label">Transaction ID</div>
            <div class="value">${params.transactionId}</div>
          </div>
          <div class="txn-item">
            <div class="label">Date</div>
            <div class="value">${fmtDate(params.timestamp)}</div>
          </div>
          <div class="txn-item">
            <div class="label">Payment Method</div>
            <div class="value">${methodLabel(params.paymentMethod)}</div>
          </div>
        </div>
      </div>

      <div class="btn-container">
        <a href="https://toroloom.app/premium" class="btn">Manage Subscription →</a>
      </div>

      <div class="footer-text">
        Toroloom — AI-Powered Trading &amp; Investment Platform<br>
        Need help? Contact <a href="mailto:support@toroloom.app">support@toroloom.app</a>
      </div>
    </div>
  </div>
</body>
</html>`;
}

// ──── Public API ──────────────────────────────────────────────────────────

/**
 * Send an invoice/receipt email after a successful subscription payment.
 * Returns true if the email was sent successfully, false otherwise.
 */
export async function sendInvoiceEmail(params: InvoiceEmailParams): Promise<boolean> {
  const resend = getResend();
  if (!resend) return false;

  const senderEmail = process.env.RESEND_SENDER_EMAIL || 'noreply@toroloom.app';

  try {
    const { data, error } = await resend.emails.send({
      from: `Toroloom <${senderEmail}>`,
      to: [params.to],
      subject: `Your Toroloom ${params.planName} Payment Receipt (${params.invoiceId})`,
      html: buildInvoiceHTML(params),
    });

    if (error) {
      console.error('[Email] Failed to send invoice email:', error);
      return false;
    }

    console.log(`[Email] Invoice email sent to ${params.to} (id: ${data?.id})`);
    return true;
  } catch (err) {
    console.error('[Email] Error sending invoice email:', err);
    return false;
  }
}

// ──── Promotional Email Types ────────────────────────────────────────────

export interface PromotionalEmailParams {
  to: string;
  userName: string;
  couponCode: string;
  discountDescription: string;
  planTier: string;
  discountValue: number;
  expiryDate?: string;
}

// ──── HTML Promotional Email Template ────────────────────────────────────

function buildPromotionalHTML(params: PromotionalEmailParams): string {
  const expirySection = params.expiryDate
    ? `<tr>
          <td class="label">Offer Expires</td>
          <td>${fmtDate(params.expiryDate)}</td>
        </tr>`
    : '';

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, 'Helvetica Neue', 'Segoe UI', Roboto, Arial, sans-serif;
      background: #F4F5FA;
      padding: 20px;
    }
    .container {
      max-width: 560px;
      margin: 0 auto;
      background: #FFFFFF;
      border-radius: 16px;
      overflow: hidden;
    }
    .header {
      background: linear-gradient(135deg, #6C63FF, #3B82F6);
      padding: 32px 32px 24px;
      text-align: center;
    }
    .header-logo {
      font-size: 28px;
      font-weight: 800;
      color: #FFFFFF;
      letter-spacing: 1px;
    }
    .header-sub {
      font-size: 11px;
      color: rgba(255,255,255,0.7);
      letter-spacing: 2px;
      text-transform: uppercase;
      margin-top: 4px;
    }
    .header-badge {
      display: inline-block;
      background: rgba(255,255,255,0.2);
      color: #FFFFFF;
      padding: 6px 20px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 1px;
      text-transform: uppercase;
      margin-top: 12px;
    }
    .body-content {
      padding: 32px;
    }
    .greeting {
      font-size: 18px;
      font-weight: 700;
      color: #1A1A2E;
      margin-bottom: 4px;
    }
    .greeting-sub {
      font-size: 13px;
      color: #6E6E9A;
      margin-bottom: 20px;
      line-height: 1.5;
    }
    .offer-card {
      background: linear-gradient(135deg, #6C63FF08, #3B82F608);
      border: 2px dashed #6C63FF40;
      border-radius: 12px;
      padding: 24px;
      text-align: center;
      margin-bottom: 20px;
    }
    .offer-code {
      font-size: 28px;
      font-weight: 800;
      color: #6C63FF;
      letter-spacing: 4px;
      margin-bottom: 8px;
    }
    .offer-value {
      font-size: 22px;
      font-weight: 700;
      color: #10B981;
      margin-bottom: 4px;
    }
    .offer-desc {
      font-size: 13px;
      color: #6E6E9A;
      line-height: 1.5;
      margin-top: 8px;
    }
    .details-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 16px;
    }
    .details-table td {
      padding: 6px 0;
      border-bottom: 1px solid #F0F0F8;
      font-size: 13px;
    }
    .details-table td:last-child {
      text-align: right;
      font-weight: 600;
      color: #1A1A2E;
    }
    .details-table .label {
      color: #9A9AB0;
    }
    .btn-container {
      text-align: center;
      margin: 24px 0;
    }
    .btn {
      display: inline-block;
      padding: 14px 40px;
      background: linear-gradient(135deg, #6C63FF, #3B82F6);
      color: #FFFFFF !important;
      text-decoration: none;
      border-radius: 30px;
      font-size: 14px;
      font-weight: 700;
    }
    .features-grid {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin: 16px 0;
      padding: 16px;
      background: #F8F8FE;
      border-radius: 10px;
    }
    .feature-item {
      flex: 0 0 48%;
      font-size: 12px;
      color: #1A1A2E;
      padding: 6px 0;
    }
    .feature-item::before {
      content: "✓ ";
      color: #6C63FF;
      font-weight: 700;
    }
    .footer-text {
      text-align: center;
      font-size: 11px;
      color: #9A9AB0;
      line-height: 1.6;
      padding-top: 20px;
      border-top: 1px solid #E0E0F0;
    }
    .footer-text a {
      color: #6C63FF;
      text-decoration: none;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="header-logo">Toroloom</div>
      <div class="header-sub">Intelligence Meets Execution</div>
      <div class="header-badge">Exclusive Offer 🎉</div>
    </div>

    <div class="body-content">
      <div class="greeting">Hey ${params.userName}! 👋</div>
      <div class="greeting-sub">
        We noticed you haven't tried our ${params.planTier === 'elite' ? 'Elite' : 'Pro'} plan yet.
        Here's an exclusive offer just for you!
      </div>

      <div class="offer-card">
        <div class="offer-code">${params.couponCode}</div>
        <div class="offer-value">${params.discountDescription}</div>
        <div class="offer-desc">
          on the ${params.planTier === 'elite' ? 'Elite' : 'Pro'} Plan
        </div>
      </div>

      <table class="details-table">
        <tr>
          <td class="label">Coupon Code</td>
          <td style="font-family: 'Courier New', monospace; letter-spacing: 2px;">${params.couponCode}</td>
        </tr>
        <tr>
          <td class="label">Plan</td>
          <td>${params.planTier === 'elite' ? 'Elite' : 'Pro'}</td>
        </tr>
        <tr>
          <td class="label">Discount</td>
          <td style="color: #10B981;">${params.discountDescription}</td>
        </tr>
        ${expirySection}
      </table>

      <div class="features-grid">
        <div class="feature-item">AI-Powered Insights</div>
        <div class="feature-item">Real-Time Market Data</div>
        <div class="feature-item">Advanced Options Chain</div>
        <div class="feature-item">Iron Lock Risk Protection</div>
        <div class="feature-item">Social Trading</div>
        <div class="feature-item">Priority Support</div>
      </div>

      <div class="btn-container">
        <a href="https://toroloom.app/premium?coupon=${params.couponCode}" class="btn">Claim Offer →</a>
      </div>

      <div class="footer-text">
        Toroloom — AI-Powered Trading &amp; Investment Platform<br>
        Need help? Contact <a href="mailto:support@toroloom.app">support@toroloom.app</a>
      </div>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Send a promotional email with a coupon offer to a user.
 * Returns true if the email was sent successfully, false otherwise.
 */
export async function sendPromotionalEmail(params: PromotionalEmailParams): Promise<boolean> {
  const resend = getResend();
  if (!resend) return false;

  const senderEmail = process.env.RESEND_SENDER_EMAIL || 'noreply@toroloom.app';

  try {
    const { data, error } = await resend.emails.send({
      from: `Toroloom <${senderEmail}>`,
      to: [params.to],
      subject: `🎉 Exclusive Offer: ${params.discountDescription} — Use Code ${params.couponCode}`,
      html: buildPromotionalHTML(params),
    });

    if (error) {
      console.error('[Email] Failed to send promotional email:', error);
      return false;
    }

    console.log(`[Email] Promotional email sent to ${params.to} (id: ${data?.id})`);
    return true;
  } catch (err) {
    console.error('[Email] Error sending promotional email:', err);
    return false;
  }
}
