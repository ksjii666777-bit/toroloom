import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';

const router = Router();
router.use(authMiddleware);

export interface FAQ {
  id: string;
  question: string;
  answer: string;
  category: string;
  order: number;
}

const faqs: FAQ[] = [
  {
    id: 'faq_1',
    question: 'How do I start investing?',
    answer: 'Complete your KYC verification first, then add funds to your account. You can start buying stocks, mutual funds, or set up SIPs directly from the app.',
    category: 'Getting Started',
    order: 1,
  },
  {
    id: 'faq_2',
    question: 'What are the charges and brokerage fees?',
    answer: 'We offer zero brokerage on equity delivery trades. Intraday and F&O trades have flat ₹20 per order. Mutual funds have zero commission. DP charges are ₹15 per scrip.',
    category: 'Charges',
    order: 2,
  },
  {
    id: 'faq_3',
    question: 'How long does KYC verification take?',
    answer: 'KYC verification typically takes 24-48 hours after submitting all required documents. You can check your KYC status in Profile & KYC section.',
    category: 'Account',
    order: 3,
  },
  {
    id: 'faq_4',
    question: 'How do I withdraw money from my account?',
    answer: 'Go to More > Withdraw. Funds are typically credited to your linked bank account within T+1 day. Minimum withdrawal is ₹100.',
    category: 'Account',
    order: 4,
  },
  {
    id: 'faq_5',
    question: 'What is a SIP and how do I start one?',
    answer: 'SIP (Systematic Investment Plan) lets you invest a fixed amount in mutual funds regularly. Go to Mutual Funds, select a fund, and choose SIP option with your preferred frequency.',
    category: 'Investing',
    order: 5,
  },
  {
    id: 'faq_6',
    question: 'How are my investments taxed?',
    answer: 'Equity gains held >1 year: 10% LTCG above ₹1L. Short-term: 15%. Mutual fund taxation varies by type. Consult a tax advisor for personalized advice.',
    category: 'Tax',
    order: 6,
  },
  {
    id: 'faq_7',
    question: 'Can I trade in US stocks?',
    answer: 'Yes! We support investing in top US stocks through our international trading platform. Additional documentation may be required for US market access.',
    category: 'Trading',
    order: 7,
  },
  {
    id: 'faq_8',
    question: 'What is the \"Financial Bodyguard\" feature?',
    answer: 'Financial Bodyguard is our risk management system that helps protect your portfolio. You can set daily loss limits, position size limits, and get real-time risk alerts.',
    category: 'Features',
    order: 8,
  },
  {
    id: 'faq_9',
    question: 'How do I reset my password?',
    answer: 'Go to the login screen and tap "Forgot Password". Enter your registered email or phone number to receive reset instructions.',
    category: 'Account',
    order: 9,
  },
  {
    id: 'faq_10',
    question: 'Is my money safe with Toroloom?',
    answer: 'Yes. We are SEBI-registered and your funds are held in a separate trust account. We use 256-bit encryption and two-factor authentication for all transactions.',
    category: 'Security',
    order: 10,
  },
];

// GET /api/support/faqs
router.get('/faqs', (_req: Request, res: Response) => {
  res.json(faqs);
});

// GET /api/support/faqs/search?q=...  (must be before :id to avoid route conflict)
router.get('/faqs/search', (req: Request, res: Response) => {
  const query = (req.query.q as string || '').toLowerCase();
  if (!query) {
    res.json(faqs);
    return;
  }
  const results = faqs.filter(
    f => f.question.toLowerCase().includes(query) || f.answer.toLowerCase().includes(query),
  );
  res.json(results);
});

// GET /api/support/faqs/:id
router.get('/faqs/:id', (req: Request, res: Response) => {
  const faq = faqs.find(f => f.id === req.params.id);
  if (!faq) {
    res.status(404).json({ error: 'FAQ not found' });
    return;
  }
  res.json(faq);
});

export default router;
