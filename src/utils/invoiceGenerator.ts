/**
 * ============================================================================
 * Toroloom — Invoice / Receipt Generator
 * ============================================================================
 *
 * Generates beautiful PDF invoices for subscription payments using expo-print.
 * Follows the same pattern as certificateGenerator.ts and reportExport.ts.
 *
 * Usage:
 *   import { generateInvoicePDF, shareInvoicePDF } from '../../utils/invoiceGenerator';
 *
 *   const uri = await generateInvoicePDF(payment, 'John Doe', 'john@email.com');
 *   await shareInvoicePDF(uri);
 *
 * ============================================================================
 */

import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import type { SubscriptionPayment } from '../types';

// ─── Helpers ───────────────────────────────────────────────────────────────

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

function fmtTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

function generateInvoiceNumber(): string {
  const now = new Date();
  const prefix = 'INV';
  const yy = now.getFullYear().toString().slice(-2);
  const mm = (now.getMonth() + 1).toString().padStart(2, '0');
  const seq = Math.floor(Math.random() * 9000) + 1000;
  return `${prefix}-${yy}${mm}-${seq}`;
}

// ─── Invoice Status Config ─────────────────────────────────────────────────

const INVOICE_STATUS: Record<string, { label: string; color: string }> = {
  completed: { label: 'Paid', color: '#00E676' },
  pending: { label: 'Pending', color: '#FFAB40' },
  failed: { label: 'Failed', color: '#FF5252' },
  refunded: { label: 'Refunded', color: '#6C63FF' },
};

// ─── HTML Template ─────────────────────────────────────────────────────────

function buildInvoiceHTML(
  payment: SubscriptionPayment,
  userName: string,
  userEmail: string,
): string {
  const status = INVOICE_STATUS[payment.status] || INVOICE_STATUS.pending;
  const invoiceNumber = payment.invoiceId || generateInvoiceNumber();
  const netAmount = payment.amount - (payment.discountApplied || 0);
  const taxAmount = Math.round(netAmount * 0.18); // 18% GST
  const totalAmount = netAmount + taxAmount;
  const methodLabel =
    payment.method === 'razorpay' ? 'Razorpay (Card / UPI / NetBanking)' :
    payment.method === 'upi_autopay' ? 'UPI AutoPay' : 'Coupon';

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    @page { margin: 0; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, 'Helvetica Neue', 'Segoe UI', Roboto, sans-serif;
      background: #F4F5FA;
      padding: 0;
    }
    .page {
      width: 595px;  /* A4 width in points */
      min-height: 842px; /* A4 height in points */
      background: #FFFFFF;
      margin: 0 auto;
      padding: 40px;
      position: relative;
    }

    /* ── Header ── */
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      padding-bottom: 24px;
      border-bottom: 2px solid #E0E0F0;
      margin-bottom: 24px;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .brand-icon {
      width: 40px;
      height: 40px;
      background: linear-gradient(135deg, #6C63FF, #3B82F6);
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 20px;
      color: white;
    }
    .brand-name {
      font-size: 22px;
      font-weight: 800;
      color: #1A1A2E;
    }
    .brand-tagline {
      font-size: 9px;
      color: #9A9AB0;
      letter-spacing: 1px;
      text-transform: uppercase;
    }
    .invoice-title {
      text-align: right;
    }
    .invoice-title h1 {
      font-size: 28px;
      font-weight: 800;
      color: #1A1A2E;
      letter-spacing: 2px;
      text-transform: uppercase;
    }
    .invoice-number {
      font-size: 11px;
      color: #6C63FF;
      font-weight: 700;
      letter-spacing: 1px;
      margin-top: 2px;
    }

    /* ── Status Badge ── */
    .status-badge {
      display: inline-block;
      padding: 4px 14px;
      border-radius: 20px;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 1px;
      text-transform: uppercase;
      background: ${status.color}20;
      color: ${status.color};
      border: 1px solid ${status.color}40;
      margin-top: 6px;
    }

    /* ── Address Section ── */
    .address-section {
      display: flex;
      justify-content: space-between;
      margin-bottom: 28px;
      gap: 20px;
    }
    .address-block {
      flex: 1;
    }
    .address-block h3 {
      font-size: 10px;
      color: #9A9AB0;
      text-transform: uppercase;
      letter-spacing: 2px;
      margin-bottom: 6px;
    }
    .address-block .name {
      font-size: 14px;
      font-weight: 700;
      color: #1A1A2E;
      margin-bottom: 2px;
    }
    .address-block .detail {
      font-size: 10px;
      color: #6E6E9A;
      line-height: 1.5;
    }

    /* ── Details Table ── */
    .details-section {
      margin-bottom: 20px;
    }
    .detail-row {
      display: flex;
      justify-content: space-between;
      padding: 5px 0;
      border-bottom: 1px solid #F0F0F8;
    }
    .detail-label {
      font-size: 10px;
      color: #9A9AB0;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    .detail-value {
      font-size: 11px;
      color: #1A1A2E;
      font-weight: 600;
      text-align: right;
    }

    /* ── Plan Item ── */
    .plan-item {
      background: linear-gradient(135deg, ${payment.tier === 'elite' ? '#10B981' : '#3B82F6'}08, transparent);
      border: 1px solid ${payment.tier === 'elite' ? '#10B981' : '#3B82F6'}20;
      border-radius: 12px;
      padding: 16px;
      margin-bottom: 20px;
    }
    .plan-item-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
    }
    .plan-name {
      font-size: 16px;
      font-weight: 700;
      color: #1A1A2E;
    }
    .plan-period {
      font-size: 10px;
      color: #6E6E9A;
      background: #F0F0F8;
      padding: 2px 10px;
      border-radius: 10px;
    }
    .plan-description {
      font-size: 10px;
      color: #6E6E9A;
      margin-bottom: 8px;
    }
    .plan-price {
      font-size: 24px;
      font-weight: 800;
      color: ${payment.tier === 'elite' ? '#10B981' : '#3B82F6'};
    }

    /* ── Payment Table ── */
    .payment-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 16px;
    }
    .payment-table th {
      font-size: 9px;
      color: #9A9AB0;
      text-transform: uppercase;
      letter-spacing: 1px;
      text-align: left;
      padding: 6px 8px;
      border-bottom: 2px solid #E0E0F0;
    }
    .payment-table th:last-child,
    .payment-table td:last-child {
      text-align: right;
    }
    .payment-table td {
      font-size: 11px;
      color: #1A1A2E;
      padding: 8px;
      border-bottom: 1px solid #F0F0F8;
    }
    .payment-table .amount {
      font-weight: 700;
      text-align: right;
    }

    /* ── Totals ── */
    .totals-section {
      margin-left: auto;
      width: 250px;
      margin-bottom: 24px;
    }
    .total-row {
      display: flex;
      justify-content: space-between;
      padding: 4px 0;
    }
    .total-row .label {
      font-size: 10px;
      color: #6E6E9A;
    }
    .total-row .value {
      font-size: 11px;
      font-weight: 600;
      color: #1A1A2E;
    }
    .total-row.discount .value {
      color: #00C853;
    }
    .total-row.grand-total {
      border-top: 2px solid #E0E0F0;
      padding-top: 8px;
      margin-top: 4px;
    }
    .total-row.grand-total .label {
      font-size: 12px;
      font-weight: 700;
      color: #1A1A2E;
    }
    .total-row.grand-total .value {
      font-size: 16px;
      font-weight: 800;
      color: #1A1A2E;
    }

    /* ── Transaction Details ── */
    .transaction-section {
      background: #F8F8FE;
      border-radius: 10px;
      padding: 14px;
      margin-bottom: 24px;
    }
    .transaction-section h3 {
      font-size: 10px;
      color: #9A9AB0;
      text-transform: uppercase;
      letter-spacing: 2px;
      margin-bottom: 8px;
    }
    .txn-grid {
      display: flex;
      flex-wrap: wrap;
      gap: 4px 20px;
    }
    .txn-item {
      flex: 0 0 auto;
    }
    .txn-item .label {
      font-size: 8px;
      color: #9A9AB0;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    .txn-item .value {
      font-size: 10px;
      color: #1A1A2E;
      font-weight: 600;
      font-family: 'Courier New', monospace;
    }

    /* ── Footer ── */
    .footer {
      position: absolute;
      bottom: 30px;
      left: 40px;
      right: 40px;
      text-align: center;
      border-top: 1px solid #E0E0F0;
      padding-top: 14px;
    }
    .footer p {
      font-size: 8px;
      color: #9A9AB0;
      line-height: 1.6;
    }
    .footer .highlight {
      color: #6C63FF;
    }

    /* ── Coupon Badge ── */
    .coupon-badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      background: #00C85315;
      color: #00C853;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 9px;
      font-weight: 700;
    }
  </style>
</head>
<body>
  <div class="page">
    <!-- ── Header ── -->
    <div class="header">
      <div class="brand">
        <div class="brand-icon">T</div>
        <div>
          <div class="brand-name">Toroloom</div>
          <div class="brand-tagline">Intelligence Meets Execution</div>
        </div>
      </div>
      <div class="invoice-title">
        <h1>Invoice</h1>
        <div class="invoice-number">${invoiceNumber}</div>
        <div class="status-badge">${status.label}</div>
      </div>
    </div>

    <!-- ── Addresses ── -->
    <div class="address-section">
      <div class="address-block">
        <h3>Bill To</h3>
        <div class="name">${userName}</div>
        <div class="detail">${userEmail}</div>
      </div>
      <div class="address-block" style="text-align:right">
        <h3>Invoice Date</h3>
        <div class="name" style="font-size:13px">${fmtDate(payment.timestamp)}</div>
        <div class="detail">${fmtTime(payment.timestamp)}</div>
      </div>
    </div>

    <!-- ── Plan Card ── -->
    <div class="plan-item">
      <div class="plan-item-header">
        <span class="plan-name">${payment.planName} Plan</span>
        <span class="plan-period">${payment.billingPeriod === 'monthly' ? 'Monthly Billing' : 'Yearly Billing'}</span>
      </div>
      <div class="plan-description">
        Toroloom ${payment.planName} subscription · ${payment.billingPeriod === 'monthly' ? 'Billed every month' : 'Billed annually'}
      </div>
      <div class="plan-price">${fmtINR(payment.amount)}</div>
    </div>

    <!-- ── Payment Breakdown ── -->
    <table class="payment-table">
      <tr>
        <th>Description</th>
        <th>Period</th>
        <th>Amount</th>
      </tr>
      <tr>
        <td>Toroloom ${payment.planName} — ${payment.method === 'razorpay' ? 'One-time Payment' : 'UPI AutoPay'}</td>
        <td>${payment.billingPeriod === 'monthly' ? '1 Month' : '1 Year'}</td>
        <td class="amount">${fmtINR(payment.amount)}</td>
      </tr>
      ${payment.couponCode ? `
      <tr>
        <td colspan="2">
          <span class="coupon-badge">🎫 ${payment.couponCode}</span>
        </td>
        <td class="amount" style="color:#00C853">-${fmtINR(payment.discountApplied || 0)}</td>
      </tr>` : ''}
    </table>

    <!-- ── Totals ── -->
    <div class="totals-section">
      <div class="total-row">
        <span class="label">Subtotal</span>
        <span class="value">${fmtINR(payment.amount)}</span>
      </div>
      ${payment.discountApplied && payment.discountApplied > 0 ? `
      <div class="total-row discount">
        <span class="label">Discount${payment.couponCode ? ` (${payment.couponCode})` : ''}</span>
        <span class="value">-${fmtINR(payment.discountApplied)}</span>
      </div>` : ''}
      <div class="total-row">
        <span class="label">GST (18%)</span>
        <span class="value">${fmtINR(taxAmount)}</span>
      </div>
      <div class="total-row grand-total">
        <span class="label">Total</span>
        <span class="value">${fmtINR(totalAmount)}</span>
      </div>
    </div>

    <!-- ── Transaction Details ── -->
    <div class="transaction-section">
      <h3>Transaction Details</h3>
      <div class="txn-grid">
        <div class="txn-item">
          <div class="label">Transaction ID</div>
          <div class="value">${payment.transactionId}</div>
        </div>
        <div class="txn-item">
          <div class="label">Payment Method</div>
          <div class="value">${methodLabel}</div>
        </div>
        <div class="txn-item">
          <div class="label">Invoice #</div>
          <div class="value">${invoiceNumber}</div>
        </div>
        <div class="txn-item">
          <div class="label">Currency</div>
          <div class="value">${payment.currency}</div>
        </div>
      </div>
    </div>

    <!-- ── Footer ── -->
    <div class="footer">
      <p>
        <span class="highlight">Toroloom</span> — AI-Powered Trading &amp; Investment Platform<br>
        This is a computer-generated invoice. No signature required.<br>
        For questions, contact <span class="highlight">support@toroloom.app</span>
      </p>
    </div>
  </div>
</body>
</html>`;
}

// ─── Public API ────────────────────────────────────────────────────────────

/**
 * Generate a PDF invoice for a subscription payment.
 * Returns the file URI of the generated PDF, or null on failure.
 */
export async function generateInvoicePDF(
  payment: SubscriptionPayment,
  userName: string,
  userEmail: string,
): Promise<string | null> {
  try {
    const html = buildInvoiceHTML(payment, userName, userEmail);
    const { uri } = await Print.printToFileAsync({
      html,
      base64: false,
      width: 595,  // A4 width in points
    });
    return uri;
  } catch (error) {
    console.error('[InvoiceGenerator] Failed to generate PDF:', error);
    return null;
  }
}

/**
 * Share a generated invoice PDF via the OS share sheet.
 * Returns true if sharing was successful, false otherwise.
 */
export async function shareInvoicePDF(uri: string): Promise<boolean> {
  try {
    if (!(await Sharing.isAvailableAsync())) {
      console.warn('[InvoiceGenerator] Sharing is not available on this device');
      return false;
    }
    await Sharing.shareAsync(uri, {
      mimeType: 'application/pdf',
      dialogTitle: 'Share Invoice',
    });
    return true;
  } catch (error) {
    console.error('[InvoiceGenerator] Failed to share PDF:', error);
    return false;
  }
}

/**
 * Generate and immediately share an invoice PDF.
 * Convenience wrapper for common use case.
 */
export async function generateAndShareInvoice(
  payment: SubscriptionPayment,
  userName: string,
  userEmail: string,
): Promise<boolean> {
  const uri = await generateInvoicePDF(payment, userName, userEmail);
  if (!uri) return false;
  return await shareInvoicePDF(uri);
}
