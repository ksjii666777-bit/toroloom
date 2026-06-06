/**
 * ============================================================================
 * Toroloom Broker-Specific Routes — EDIS & Brokerage Calculator
 * ============================================================================
 *
 * Exposes Angel One-specific broker features via REST API:
 *
 *   POST /api/broker/edis/verify
 *   POST /api/broker/edis/generate-tpin
 *   POST /api/broker/edis/tran-status
 *   POST /api/broker/brokerage/estimate
 *
 * These routes require the active broker to be AngelBroker. If the active
 * broker is not Angel One (e.g., Zerodha or Mock), the endpoints return a
 * 400 error explaining that these features are only available with Angel One.
 *
 * Auth: Required (authMiddleware) — EDIS involves user holdings.
 *
 * ============================================================================
 */

import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { getBroker, getCurrentBrokerType } from '../services/broker';
import { AngelBroker } from '../services/broker/angelBroker';
import type {
  EDISVerifyRequest,
  EDISGenerateTPINRequest,
  EDISTranStatusRequest,
  BrokerageEstimateRequest,
} from '../services/broker/interface';

const router = Router();
router.use(authMiddleware);

// ──── Helpers ──────────────────────────────────────────────────────────────

/**
 * Get the active broker as an AngelBroker instance.
 * Throws a user-friendly error if the active broker is not Angel One.
 */
async function getAngelBroker(): Promise<AngelBroker> {
  const broker = await getBroker();
  if (!(broker instanceof AngelBroker)) {
    throw new Error(
      `EDIS and Brokerage Calculator are only available with the Angel One broker. ` +
      `Current broker: ${getCurrentBrokerType() || 'unknown'}. ` +
      `Set BROKER=angel in your .env file.`,
    );
  }
  return broker;
}

// ──── EDIS Endpoints ──────────────────────────────────────────────────────

/**
 * POST /api/broker/edis/verify
 *
 * Initiate CDSL/NSDL authorisation for a specific holding (ISIN).
 * After calling this, the client must redirect the user to the ReturnURL
 * (CDSL verification page) to complete the TPIN authorisation.
 *
 * Body: { isin: string, quantity: string }
 *
 * Response: {
 *   ReqId,       // Request ID for tracking
 *   ReturnURL,   // CDSL verification URL to redirect user
 *   DPId,        // Depository Participant ID
 *   BOID,        // Beneficiary Owner ID
 *   TransDtls    // Transaction details
 * }
 */
router.post('/edis/verify', async (req: Request, res: Response) => {
  try {
    const { isin, quantity } = req.body;

    if (!isin || typeof isin !== 'string') {
      res.status(400).json({ error: 'isin is required (e.g., "INE545U01014")' });
      return;
    }
    if (!quantity || typeof quantity !== 'string') {
      res.status(400).json({ error: 'quantity is required (e.g., "10")' });
      return;
    }

    const request: EDISVerifyRequest = { isin: isin.trim().toUpperCase(), quantity };
    const broker = await getAngelBroker();
    const result = await broker.verifyEDIS(request);

    res.status(200).json(result);
  } catch (error: any) {
    const statusCode = error.message?.includes('only available') ? 400 : 500;
    res.status(statusCode).json({
      error: error.message || 'Failed to initiate EDIS verification',
    });
  }
});

/**
 * POST /api/broker/edis/generate-tpin
 *
 * Generate TPIN for EDIS authorisation.
 * Call this after the user has completed the CDSL portal flow.
 *
 * Body: { dpId: string, ReqId: string, boid: string, pan: string }
 *
 * Response: { status: string }
 */
router.post('/edis/generate-tpin', async (req: Request, res: Response) => {
  try {
    const { dpId, ReqId, boid, pan } = req.body;

    if (!dpId || !ReqId || !boid || !pan || typeof dpId !== 'string' || typeof ReqId !== 'string' || typeof boid !== 'string' || typeof pan !== 'string') {
      res.status(400).json({
        error: 'dpId, ReqId, boid, and pan are all required and must be strings',
      });
      return;
    }

    // Validate PAN format: 5 uppercase letters + 4 digits + 1 uppercase letter
    const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
    const normalizedPan = pan.toUpperCase().trim();
    if (!panRegex.test(normalizedPan)) {
      res.status(400).json({
        error: 'Invalid PAN format. Expected format: 5 uppercase letters, 4 digits, 1 uppercase letter (e.g., "ABCDE1234F")',
      });
      return;
    }

    const request: EDISGenerateTPINRequest = { dpId, ReqId, boid, pan: normalizedPan };
    const broker = await getAngelBroker();
    const result = await broker.generateTPIN(request);

    res.status(200).json(result);
  } catch (error: any) {
    const statusCode = error.message?.includes('only available') ? 400 : 500;
    res.status(statusCode).json({
      error: error.message || 'Failed to generate TPIN',
    });
  }
});

/**
 * POST /api/broker/edis/tran-status
 *
 * Check the status of an EDIS transaction.
 * Status 0 = not yet authorised (cannot sell).
 * Status 1 = authorised (can sell).
 *
 * Body: { ReqId: string }
 *
 * Response: { ReqId: string, status: 0 | 1 }
 */
router.post('/edis/tran-status', async (req: Request, res: Response) => {
  try {
    const { ReqId } = req.body;

    if (!ReqId || typeof ReqId !== 'string') {
      res.status(400).json({ error: 'ReqId is required' });
      return;
    }

    const request: EDISTranStatusRequest = { ReqId };
    const broker = await getAngelBroker();
    const result = await broker.getEDISTranStatus(request);

    res.status(200).json(result);
  } catch (error: any) {
    const statusCode = error.message?.includes('only available') ? 400 : 500;
    res.status(statusCode).json({
      error: error.message || 'Failed to check EDIS status',
    });
  }
});

// ──── Brokerage Calculator Endpoint ────────────────────────────────────────

/**
 * POST /api/broker/brokerage/estimate
 *
 * Estimate brokerage charges for one or more orders.
 * Returns a breakdown of brokerage, transaction charges, GST, STT/CTT,
 * stamp duty, SEBI fees, and the total.
 *
 * Body: {
 *   orders: Array<{
 *     product_type: "DELIVERY" | "INTRADAY" | "MARGIN" | "BO" | "CO",
 *     transaction_type: "BUY" | "SELL",
 *     exchange: "NSE" | "BSE" | "NFO" | "MCX",
 *     symbol: string,
 *     token: string,
 *     qty: number,
 *     price: number
 *   }>
 * }
 *
 * Response: { status: string, payload: { brokerage, transaction_charges, gst, stt_ctt, stamp_duty, sebi_turnover_fees, total_charges } }
 */
router.post('/brokerage/estimate', async (req: Request, res: Response) => {
  try {
    const { orders } = req.body;

    if (!orders || !Array.isArray(orders) || orders.length === 0) {
      res.status(400).json({
        error: 'orders is required and must be a non-empty array',
      });
      return;
    }

    // Validate each order entry
    for (let i = 0; i < orders.length; i++) {
      const o = orders[i];
      const missingFields: string[] = [];
      if (!o.product_type) missingFields.push('product_type');
      if (!o.transaction_type) missingFields.push('transaction_type');
      if (!o.exchange) missingFields.push('exchange');
      if (!o.symbol) missingFields.push('symbol');
      if (!o.token) missingFields.push('token');
      if (o.qty === undefined || o.qty === null) missingFields.push('qty');
      if (o.price === undefined || o.price === null) missingFields.push('price');

      if (missingFields.length > 0) {
        res.status(400).json({
          error: `Order at index ${i} is missing required fields: ${missingFields.join(', ')}`,
        });
        return;
      }
    }

    const request: BrokerageEstimateRequest = { orders };
    const broker = await getAngelBroker();
    const result = await broker.estimateBrokerage(request);

    res.status(200).json(result);
  } catch (error: any) {
    const statusCode = error.message?.includes('only available') ? 400 : 500;
    res.status(statusCode).json({
      error: error.message || 'Failed to estimate brokerage',
    });
  }
});

export default router;
