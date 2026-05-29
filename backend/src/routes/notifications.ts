import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { getBroker } from '../services/broker';
import { getNotifications, markNotificationRead, markAllNotificationsRead, saveNotification } from '../services/notifications';

const router = Router();
router.use(authMiddleware);

// GET /api/notifications
router.get('/', async (req: Request, res: Response) => {
  const { unread } = req.query;
  const userId = req.user!.userId;

  let notifications = await getNotifications(userId);

  if (unread === 'true') {
    notifications = notifications.filter(n => !n.read);
  }

  res.json(notifications);
});

// PUT /api/notifications/:id/read
router.put('/:id/read', async (req: Request, res: Response) => {
  const notificationId = req.params.id as string;
  await markNotificationRead(notificationId);
  res.json({ success: true });
});

// PUT /api/notifications/read-all
router.put('/read-all', async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  await markAllNotificationsRead(userId);
  res.json({ success: true });
});

// GET /api/notifications/unread-count
router.get('/unread-count', async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const notifications = await getNotifications(userId);
  const count = notifications.filter(n => !n.read).length;
  res.json({ count });
});

// POST /api/notifications/price-alert
router.post('/price-alert', async (req: Request, res: Response) => {
  const { symbol, targetPrice } = req.body;
  const userId = req.user!.userId;

  if (!symbol || !targetPrice) {
    res.status(400).json({ error: 'Symbol and targetPrice are required' });
    return;
  }

  try {
    const broker = await getBroker();
    const quote = await broker.getQuote(symbol);

    const newNotification = {
      id: `n_${Date.now()}`,
      userId,
      type: 'price_alert' as const,
      title: `Price Alert: ${symbol}`,
      message: `${symbol} is now at ₹${quote.lastPrice}. Your target was ₹${targetPrice}.`,
      read: false,
      timestamp: new Date().toISOString(),
    };

    await saveNotification(newNotification);
    res.status(201).json(newNotification);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to create price alert' });
  }
});

export default router;
