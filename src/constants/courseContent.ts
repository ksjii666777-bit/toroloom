import { Course, Lesson } from '../types';

// =============================================================================
// TOROLOOM — Real Educational Content
// 6 courses, 40+ lessons with detailed content, quizzes, and key takeaways
// =============================================================================

export const realCourses: Course[] = [
  {
    id: 'c1',
    title: 'Stock Market Basics',
    description: 'Everything you need to know to start investing in the stock market. From understanding what a stock is to placing your first trade and building a portfolio.',
    thumbnail: '📈',
    duration: '5 hours',
    lessons: 8,
    progress: 75,
    level: 'beginner',
    category: 'Fundamentals',
    rating: 4.8,
    enrolledCount: 24500,
  },
  {
    id: 'c2',
    title: 'Technical Analysis Mastery',
    description: 'Master chart patterns, indicators, and price action trading strategies used by professional traders. Learn to read market psychology through price movements.',
    thumbnail: '📊',
    duration: '8 hours',
    lessons: 8,
    progress: 30,
    level: 'intermediate',
    category: 'Technical',
    rating: 4.9,
    enrolledCount: 18200,
  },
  {
    id: 'c3',
    title: 'Fundamental Analysis',
    description: 'Learn how to analyze company financials, read balance sheets, and value stocks like Warren Buffett. Master the art of finding undervalued gems.',
    thumbnail: '📋',
    duration: '7 hours',
    lessons: 8,
    progress: 0,
    level: 'intermediate',
    category: 'Fundamentals',
    rating: 4.7,
    enrolledCount: 15800,
  },
  {
    id: 'c4',
    title: 'Mutual Funds & SIP Investing',
    description: 'Complete guide to mutual funds, SIP strategies, and building a diversified portfolio. Perfect for long-term wealth creation with minimal effort.',
    thumbnail: '💰',
    duration: '4 hours',
    lessons: 6,
    progress: 50,
    level: 'beginner',
    category: 'Investing',
    rating: 4.6,
    enrolledCount: 21300,
  },
  {
    id: 'c5',
    title: 'Options Trading Strategies',
    description: 'Advanced options strategies including hedging, covered calls, spreads, and iron condors. Learn how professional traders manage risk and generate consistent returns.',
    thumbnail: '🎯',
    duration: '10 hours',
    lessons: 8,
    progress: 0,
    level: 'advanced',
    category: 'Derivatives',
    rating: 4.9,
    enrolledCount: 8900,
  },
  {
    id: 'c6',
    title: 'Risk Management & Trading Psychology',
    description: 'Master the psychological aspects of trading and learn professional risk management techniques. The difference between profitable and losing traders is often not strategy — it is psychology and risk control.',
    thumbnail: '🧠',
    duration: '5 hours',
    lessons: 6,
    progress: 10,
    level: 'intermediate',
    category: 'Psychology',
    rating: 4.8,
    enrolledCount: 12400,
  },
];

export const realLessons: Lesson[] = [
  // ─── Course 1: Stock Market Basics (8 lessons) ───
  {
    id: 'l1',
    courseId: 'c1',
    title: 'What is the Stock Market?',
    content: `The stock market is a marketplace where buyers and sellers trade shares of publicly listed companies. When you buy a stock, you are buying a small piece of ownership in that company. This ownership entitles you to a portion of the company's assets and profits.

The concept of stock markets dates back to the 1600s when the Dutch East India Company issued shares to fund voyages. Today, stock markets exist in virtually every country, with the largest being the New York Stock Exchange (NYSE), Nasdaq, and in India, the National Stock Exchange (NSE) and Bombay Stock Exchange (BSE).

Why do companies list on stock markets? The primary reason is to raise capital for growth and expansion. By selling shares to the public through an Initial Public Offering (IPO), companies can access funds from thousands of investors without taking on debt. For investors, the stock market offers the opportunity to earn returns through capital appreciation (price increase) and dividends (profit sharing).

Stock markets serve several crucial functions in the economy:
1. Capital Formation — Companies raise money for expansion, research, and operations
2. Price Discovery — The market determines fair prices for securities based on supply and demand
3. Liquidity — Investors can buy and sell shares easily
4. Risk Distribution — Risk is spread across millions of investors
5. Economic Indicator — Stock market performance often reflects the overall health of the economy

In India, the Securities and Exchange Board of India (SEBI) regulates the stock market to protect investor interests and ensure fair trading practices.`,
    duration: '20 min',
    completed: true,
    quiz: {
      id: 'q1',
      title: 'Market Basics Quiz',
      score: 80,
      passed: true,
      questions: [
        { id: 'q1_1', question: 'What does buying a stock represent?', options: ['A loan to the company', 'Partial ownership in the company', 'A type of insurance', 'A government bond'], correctAnswer: 1, explanation: 'A stock represents a share of ownership in a company. Shareholders are part-owners of the business.' },
        { id: 'q1_2', question: 'Which organization regulates the Indian stock market?', options: ['RBI', 'SEBI', 'IRDAI', 'CCC'], correctAnswer: 1, explanation: 'SEBI (Securities and Exchange Board of India) is the regulatory body for the Indian securities market.' },
        { id: 'q1_3', question: 'What is an IPO?', options: ['Internal Public Offering', 'Initial Public Offering', 'Indian Public Option', 'Investment Portfolio Objective'], correctAnswer: 1, explanation: 'An IPO is when a company first sells its shares to the public to raise capital from investors.' },
        { id: 'q1_4', question: 'Which of these is a major Indian stock exchange?', options: ['NYSE', 'NSE', 'NASDAQ', 'LSE'], correctAnswer: 1, explanation: 'The National Stock Exchange (NSE) is one of India\'s two major stock exchanges, along with the BSE.' },
      ],
    },
  },
  {
    id: 'l2',
    courseId: 'c1',
    title: 'Key Market Participants',
    content: `The stock market ecosystem involves various participants, each playing a unique role in ensuring smooth functioning and liquidity.

Retail Investors — Individual investors like you and me who buy and sell shares for personal accounts. Retail investors typically invest smaller amounts and trade through brokerage platforms. In India, the number of retail investors has grown enormously, with over 10 crore Demat accounts as of 2025.

Institutional Investors — Large organizations that invest significant capital. These include:
• Foreign Institutional Investors (FIIs) — International investment funds, pension funds, and sovereign wealth funds
• Domestic Institutional Investors (DIIs) — Indian mutual funds, insurance companies, and pension funds
• Foreign Portfolio Investors (FPIs) — A broader category that includes FIIs and other foreign entities

Mutual Funds — Pooled investment vehicles where professional fund managers invest money collected from thousands of retail investors. When you invest in a mutual fund, you own units that represent a portion of the fund's portfolio.

Market Makers — Entities that provide liquidity by continuously quoting buy and sell prices for securities. They profit from the bid-ask spread and help ensure that trades can be executed quickly.

Stock Brokers — SEBI-registered intermediaries who facilitate buying and selling of securities on behalf of investors. Brokers can be full-service (offering research, advice, and services) or discount brokers (offering execution-only at lower costs).

Depositories — Organizations that hold securities in electronic (Demat) form. In India, the two depositories are NSDL (National Securities Depository Limited) and CDSL (Central Depository Services Limited).

Understanding who participates in the market helps you understand what drives price movements. For example, when FIIs are net buyers, markets tend to rally, and when they sell, markets may decline.`,
    duration: '20 min',
    completed: true,
    quiz: {
      id: 'q2',
      title: 'Market Participants Quiz',
      score: 100,
      passed: true,
      questions: [
        { id: 'q2_1', question: 'What does FII stand for?', options: ['Federal Investment Institution', 'Foreign Institutional Investor', 'Financial Investment Index', 'Fixed Income Instrument'], correctAnswer: 1, explanation: 'FII stands for Foreign Institutional Investor — international entities that invest in Indian markets.' },
        { id: 'q2_2', question: 'Which depositories operate in India?', options: ['NSDL and CDSL', 'RBI and SEBI', 'NSE and BSE', 'SBI and HDFC'], correctAnswer: 0, explanation: 'NSDL and CDSL are the two depositories in India that hold securities in electronic (Demat) form.' },
      ],
    },
  },
  {
    id: 'l3',
    courseId: 'c1',
    title: 'Understanding Stock Exchanges',
    content: `In India, there are two primary stock exchanges: the National Stock Exchange (NSE) and the Bombay Stock Exchange (BSE). Both exchanges facilitate trading in equities, derivatives, ETFs, and other securities.

NSE (National Stock Exchange) — Established in 1992, NSE is India's largest exchange by trading volume. Its benchmark index is the Nifty 50, which tracks the performance of the 50 largest and most liquid Indian companies. NSE was the first exchange in India to provide electronic trading through its platform called NEAT (National Exchange for Automated Trading).

BSE (Bombay Stock Exchange) — Asia's oldest stock exchange, established in 1875. Its benchmark index is the SENSEX (Sensitive Index), comprising 30 well-established and financially sound companies. While the BSE has lower trading volumes than NSE in equities, it lists more companies overall.

Trading Hours — Indian stock markets operate from 9:15 AM to 3:30 PM, Monday through Friday (excluding national holidays). The trading day has several phases:
• Pre-Open Session (9:00–9:15 AM) — Order collection and price discovery
• Continuous Trading (9:15 AM–3:30 PM) — Regular trading
• Closing Session (3:30–3:45 PM) — Call auction for closing price determination

Market Indices — Indices are statistical measures that track the performance of a group of stocks. Besides Nifty 50 and SENSEX, other important indices include:
• Nifty Bank — Tracks banking stocks
• Nifty Midcap 100 — Tracks mid-cap companies
• Nifty Smallcap 100 — Tracks small-cap companies
• India VIX — Measures market volatility (the "fear index")

Circuit Breakers — Exchanges have mechanisms to halt trading if markets move too sharply. If the Nifty 50 falls by 10%, 15%, or 20%, trading is halted for specific periods to prevent panic selling.`,
    duration: '25 min',
    completed: true,
    quiz: {
      id: 'q3',
      title: 'Exchanges & Indices Quiz',
      score: 75,
      passed: true,
      questions: [
        { id: 'q3_1', question: 'What are the trading hours for Indian stock markets?', options: ['9:00 AM to 3:00 PM', '9:15 AM to 3:30 PM', '10:00 AM to 4:00 PM', '9:30 AM to 3:30 PM'], correctAnswer: 1, explanation: 'Indian stock markets trade from 9:15 AM to 3:30 PM, Monday through Friday.' },
        { id: 'q3_2', question: 'How many companies are in the Nifty 50 index?', options: ['30', '50', '100', '500'], correctAnswer: 1, explanation: 'The Nifty 50 tracks the performance of 50 large, liquid Indian companies listed on the NSE.' },
      ],
    },
  },
  {
    id: 'l4',
    courseId: 'c1',
    title: 'How to Read Stock Prices',
    content: `When you open a trading platform, you see various numbers and terms associated with each stock. Understanding these is essential for making informed decisions.

Key Terms:

Last Traded Price (LTP) — The most recent price at which the stock was traded. This is what most people refer to as the "current price."

Day Open — The price at which the stock first trades when the market opens. This may differ from the previous day's closing price.

Day High/Low — The highest and lowest prices at which the stock has traded during the current trading session.

Previous Close — The closing price of the stock from the previous trading day.

Change — The difference between the current price and the previous close. A positive change means the stock is up, and a negative change means it is down.

Change Percent — The change expressed as a percentage of the previous close. For example, if a stock closed at ₹1,000 yesterday and is now at ₹1,050, the change percent is +5%.

Bid & Ask — The bid is the highest price a buyer is willing to pay, and the ask is the lowest price a seller is willing to accept. The difference between them is called the bid-ask spread.

Volume — The number of shares traded during a session. High volume confirms the strength of a price move.

Market Depth — Also called the order book, this shows all pending buy and sell orders at different price levels. It helps you understand supply and demand at various prices.

52-Week High/Low — The highest and lowest prices at which the stock has traded over the past 52 weeks. These levels often act as important support and resistance points.

Market Capitalization — The total value of a company's outstanding shares, calculated as: Stock Price × Total Number of Shares. Companies are categorized as large-cap (top 100 by market cap), mid-cap (101st to 250th), and small-cap (251st onwards).

Understanding these terms allows you to quickly assess a stock's performance and make better trading decisions.`,
    duration: '25 min',
    completed: true,
  },
  {
    id: 'l5',
    courseId: 'c1',
    title: 'Order Types Explained',
    content: `Placing the right type of order is crucial for executing your trading strategy effectively. Different order types serve different purposes and offer different levels of price control.

Market Order — An order to buy or sell a stock immediately at the best available current price. Market orders guarantee execution but not the price. Use when speed is more important than price precision.

Limit Order — An order to buy or sell a stock at a specific price or better. A buy limit order will only execute at the limit price or lower. A sell limit order will only execute at the limit price or higher. Limit orders guarantee price but not execution.

Stop-Loss Order (Stop Market) — An order that becomes a market order when the stock reaches a specified price (the stop price). Used to limit losses or protect profits. For example, if you bought a stock at ₹500 and set a stop-loss at ₹450, if the stock falls to ₹450, a market sell order is triggered.

Stop-Limit Order — A combination of stop and limit orders. When the stop price is reached, a limit order is placed instead of a market order. This provides more price control but risks the order not being filled if the price moves past the limit.

Good Till Cancelled (GTC) — An order that remains active until it is either executed or cancelled by the trader. Note: Most Indian brokers do not support GTC orders for more than one trading session.

Good For Day (GFD) — The default order type. The order is valid only for the current trading session and expires if not filled by market close.

After Market Order (AMO) — Orders placed after trading hours that are queued for execution when the market opens the next day. Useful for traders who cannot be available during market hours.

Intraday Orders (MIS) — Orders that must be squared off (closed) by the end of the trading day. Used for short-term speculation.

Delivery Orders (CNC) — Orders where you pay the full amount and take delivery of shares. Used for long-term investing.

Cover Order — A type of stop-loss order where you must specify both the target and stop-loss when placing the order. Common in derivatives trading.

Understanding when to use each order type helps you execute trades more effectively and manage risk better.`,
    duration: '25 min',
    completed: true,
  },
  {
    id: 'l6',
    courseId: 'c1',
    title: 'Demat & Trading Accounts',
    content: `To start investing in Indian stock markets, you need two essential accounts — a Demat account and a Trading account. Understanding how they work together is the first step to becoming an investor.

What is a Demat Account? — A Demat (Dematerialized) account holds your shares and securities in electronic form. Before dematerialization, shares were held as physical certificates, which was cumbersome and risky. Today, your Demat account securely holds all your investments — stocks, mutual funds, ETFs, and bonds.

What is a Trading Account? — A Trading account is linked to your Demat account and is used to place buy and sell orders on stock exchanges. When you buy shares, they are credited to your Demat account. When you sell, they are debited from your Demat account.

How to Open an Account:
1. Choose a SEBI-registered stock broker (full-service or discount)
2. Complete the KYC (Know Your Customer) process with PAN card, Aadhaar card, address proof, and bank account details
3. Sign the account opening forms (now largely digital through e-sign)
4. Complete In-Person Verification (IPV) — often done via video call
5. Your Demat account is opened with NSDL or CDSL through the broker

Account Types:
• Regular Account — Standard account for individual investors
• Joint Account — Held by two or more individuals
• Corporate Account — For companies and institutions

Charges to be aware of:
• Account Opening Charges — Varies from free to a few hundred rupees
• Annual Maintenance Charges (AMC) — ₹150 to ₹750 per year
• Brokerage — Per-trade fee (can be ₹0 to ₹20 per trade for discount brokers)
• STT (Securities Transaction Tax) — 0.1% of turnover for delivery trades
• DP Charges — ₹15–₹25 per transaction for selling shares
• GST — 18% on brokerage and transaction fees

The KYC process is now seamless — once you complete KYC with one broker, it is valid across the financial system through the KYC Registration Agency (KRA) system.`,
    duration: '20 min',
    completed: false,
  },
  {
    id: 'l7',
    courseId: 'c1',
    title: 'Taxation of Stock Market Income',
    content: `Understanding how your stock market profits are taxed is essential for accurate tax filing and maximizing your post-tax returns. The tax treatment depends on the holding period and the type of income.

Capital Gains Tax:
• Short-Term Capital Gains (STCG) — If you hold listed equity shares for 12 months or less, the profit is treated as STCG. STCG on equity shares is taxed at 15% (plus surcharge and cess).
• Long-Term Capital Gains (LTCG) — If you hold listed equity shares for more than 12 months, the profit is LTCG. LTCG exceeding ₹1 lakh in a financial year is taxed at 10% (plus surcharge and cess). Gains up to ₹1 lakh are tax-free.

How to calculate holding period:
• The holding period starts from the date of purchase and ends on the date of sale
• For bonus shares, the holding period starts from the date of allotment
• For shares received through IPO, the holding period starts from the date of allotment

Setting off and carrying forward losses:
• Short-term capital losses can be set off against any capital gains (short-term or long-term)
• Long-term capital losses can only be set off against long-term capital gains
• Unadjusted losses can be carried forward for up to 8 assessment years
• You must file your income tax return before the due date to carry forward losses

Securities Transaction Tax (STT):
• STT is automatically deducted on every trade
• Delivery trades: 0.1% of turnover (both buy and sell side)
• Intraday trades: 0.025% on sell side
• Futures: 0.01% on sell side
• Options: 0.05% on premium (sell side)

Other Income:
• Dividends — Added to your total income and taxed as per your income tax slab. Companies deduct TDS (Tax Deducted at Source) at 10% on dividends exceeding ₹5,000.
• Interest on margin money — Taxed as per your income tax slab.

Tax-Saving Investments through ELSS:
• Equity Linked Savings Schemes (ELSS) are mutual funds with a 3-year lock-in period
• Investments up to ₹1.5 lakh in ELSS qualify for tax deduction under Section 80C
• Returns are treated as capital gains and taxed accordingly

Always consult a qualified tax professional for your specific situation, as tax laws can change and individual circumstances vary.`,
    duration: '20 min',
    completed: false,
  },
  {
    id: 'l8',
    courseId: 'c1',
    title: 'Building Your First Portfolio',
    content: `Building a well-diversified investment portfolio is the foundation of long-term wealth creation. Here is a step-by-step guide to creating your first portfolio.

Step 1: Define Your Financial Goals
Before investing, ask yourself:
• What am I investing for? (Retirement, house, education, wealth creation)
• What is my time horizon? (Short-term < 3 years, Medium-term 3–7 years, Long-term > 7 years)
• How much risk can I tolerate? (Your risk appetite determines your asset allocation)

Step 2: Understand Asset Allocation
Asset allocation is the process of dividing your investments among different asset classes:
• Equities (Stocks) — High risk, high return potential. Suitable for long-term goals
• Debt (Bonds, Fixed Deposits) — Lower risk, stable returns. Suitable for short to medium goals
• Gold — Hedge against inflation and market uncertainty
• Real Estate — Physical asset with appreciation potential
• Cash — Emergency fund (3–6 months of expenses)

A common rule of thumb: Subtract your age from 100 to get the percentage of your portfolio that should be in equities. For example, if you are 30, 70% in equities and 30% in debt.

Step 3: Diversification Within Equities
Don't put all your money in one stock. Diversify across:
• Sectors — Finance, IT, Pharma, Auto, Energy, Consumer goods, etc.
• Market Caps — Large-cap (stable), Mid-cap (growth), Small-cap (high growth, high risk)
• Investment Style — Value stocks, Growth stocks, Dividend stocks

Step 4: Choose Your Investment Approach
• Active Investing — Research and select individual stocks. Requires time, knowledge, and effort
• Passive Investing — Invest in index funds or ETFs that track market indices like Nifty 50. Lower cost, less effort
• Hybrid Approach — Core portfolio of index funds + satellite portfolio of individual stocks

Step 5: Start Small and Systematic
• Begin with a small amount you are comfortable with
• Use Systematic Investment Plans (SIPs) for regular investing
• Avoid the temptation to time the market — time in the market beats timing the market
• Rebalance your portfolio annually to maintain target asset allocation

Step 6: Monitor and Review
• Check your portfolio quarterly, not daily
• Review if your investments are on track to meet your goals
• Make adjustments based on life changes, not market noise
• Keep learning and improving your investment knowledge

Remember: Building wealth through the stock market is a marathon, not a sprint. Stay disciplined, keep learning, and let compound interest work its magic.`,
    duration: '25 min',
    completed: false,
    quiz: {
      id: 'q4',
      title: 'Portfolio Building Quiz',
      score: 0,
      passed: false,
      questions: [
        { id: 'q4_1', question: 'What is asset allocation?', options: ['Buying assets at low prices', 'Dividing investments among different asset classes', 'Selling all assets at once', 'Investing only in gold'], correctAnswer: 1, explanation: 'Asset allocation is the strategy of dividing your investments among different asset classes (equities, debt, gold, etc.) based on your goals and risk tolerance.' },
        { id: 'q4_2', question: 'What is the recommended emergency fund size?', options: ['1 month of expenses', '3–6 months of expenses', '1 year of expenses', 'No emergency fund needed'], correctAnswer: 1, explanation: 'Financial experts recommend keeping 3–6 months of living expenses in liquid assets as an emergency fund.' },
        { id: 'q4_3', question: 'What does "time in the market beats timing the market" mean?', options: ['You should trade every day', 'Long-term investing is better than trying to predict short-term moves', 'Market timing is the best strategy', 'You should only invest at market close'], correctAnswer: 1, explanation: 'This famous investing adage means that staying invested for the long term typically produces better results than trying to predict short-term market movements.' },
      ],
    },
  },

  // ─── Course 2: Technical Analysis Mastery (8 lessons) ───
  {
    id: 'l9',
    courseId: 'c2',
    title: 'Introduction to Technical Analysis',
    content: `Technical analysis is the study of market action through the use of charts and indicators to forecast future price movements. Unlike fundamental analysis which examines a company's financial health, technical analysis focuses solely on price, volume, and market psychology.

The Core Philosophy — Technical analysis is built on three fundamental principles:
1. Market Discounts Everything — All information (news, earnings, economic data) is already reflected in the price
2. Price Moves in Trends — Once a trend is established, it tends to continue
3. History Tends to Repeat Itself — Market participants react similarly to similar situations, creating predictable patterns

Dow Theory — The foundation of modern technical analysis, developed by Charles Dow (founder of the Wall Street Journal):
• The market has three trends: Primary (long-term, lasting months to years), Secondary (intermediate, lasting weeks to months), and Minor (short-term, lasting days)
• Trends have three phases: Accumulation (smart money buys), Public Participation (general investors join), and Distribution (smart money sells to the public)
• Indices must confirm each other — a trend in one index should be confirmed by related indices
• Volume confirms the trend — volume should increase in the direction of the trend

Types of Charts:
• Line Chart — Connects closing prices over time. Simplest view
• Bar Chart (OHLC) — Shows Open, High, Low, Close for each period
• Candlestick Chart — Japanese charting method showing the same data as bar charts but in a more visually intuitive format. Most popular among traders.

Time Frames:
• Intraday (1-min, 5-min, 15-min) — For day traders
• Short-term (Hourly, Daily) — For swing traders
• Medium-term (Weekly) — For position traders
• Long-term (Monthly) — For investors

Technical analysis works because it studies human psychology. Fear and greed drive markets, and these emotions create repetitive patterns that can be identified and traded.`,
    duration: '25 min',
    completed: true,
    quiz: {
      id: 'q5',
      title: 'Technical Analysis Basics Quiz',
      score: 100,
      passed: true,
      questions: [
        { id: 'q5_1', question: 'What is the primary focus of technical analysis?', options: ['Company financial statements', 'Price and volume data', 'Management quality', 'Industry trends'], correctAnswer: 1, explanation: 'Technical analysis focuses on price, volume, and market psychology rather than company fundamentals.' },
        { id: 'q5_2', question: 'Which theory is considered the foundation of modern technical analysis?', options: ['Efficient Market Theory', 'Dow Theory', 'Random Walk Theory', 'Modern Portfolio Theory'], correctAnswer: 1, explanation: 'Dow Theory, developed by Charles Dow, is the foundation of modern technical analysis.' },
      ],
    },
  },
  {
    id: 'l10',
    courseId: 'c2',
    title: 'Candlestick Patterns',
    content: `Candlestick charting was developed by Japanese rice traders in the 18th century and popularized in the West by Steve Nison. It is now the most widely used charting method among traders worldwide.

Candlestick Anatomy — Each candlestick represents price action over a specific time period:
• Body — The rectangular area between the open and close prices
    › Bullish Candle — Close is higher than open (typically green or white)
    › Bearish Candle — Close is lower than open (typically red or black)
• Upper Wick (Shadow) — The highest price reached during the period
• Lower Wick (Shadow) — The lowest price reached during the period

Single Candlestick Patterns:
• Doji — Open and close are nearly equal, indicating indecision. A doji after a strong uptrend or downtrend can signal a reversal.
• Hammer — Small body with a long lower wick. Appears during a downtrend and signals a potential bullish reversal.
• Shooting Star — Small body with a long upper wick. Appears during an uptrend and signals a potential bearish reversal.
• Marubozu — Candle with no wicks. A strong bullish or bearish signal.

Double Candlestick Patterns:
• Bullish Engulfing — A small bearish candle followed by a larger bullish candle that completely engulfs the previous candle. Strong bullish reversal signal.
• Bearish Engulfing — A small bullish candle followed by a larger bearish candle that engulfs it. Strong bearish reversal signal.
• Piercing Pattern — A bearish candle followed by a bullish candle that closes above the midpoint of the previous candle. Bullish reversal.
• Dark Cloud Cover — A bullish candle followed by a bearish candle that closes below the midpoint of the previous candle. Bearish reversal.

Triple Candlestick Patterns:
• Morning Star — Three-candle pattern: Long bearish, small indecisive (doji or spinning top), long bullish. Bullish reversal.
• Evening Star — Three-candle pattern: Long bullish, small indecisive, long bearish. Bearish reversal.
• Three White Soldiers — Three consecutive long bullish candles with higher closes. Strong bullish continuation.
• Three Black Crows — Three consecutive long bearish candles with lower closes. Strong bearish continuation.

Trading with candlestick patterns requires confirmation. Never trade a pattern in isolation — look for volume confirmation and support/resistance levels before taking a trade.`,
    duration: '30 min',
    completed: true,
    quiz: {
      id: 'q6',
      title: 'Candlestick Patterns Quiz',
      score: 80,
      passed: true,
      questions: [
        { id: 'q6_1', question: 'What does a Doji candlestick indicate?', options: ['Strong buying pressure', 'Market indecision', 'Strong selling pressure', 'Gap up opening'], correctAnswer: 1, explanation: 'A Doji forms when open and close prices are nearly equal, indicating indecision in the market.' },
        { id: 'q6_2', question: 'Which pattern consists of three candles: long bearish, small doji, and long bullish?', options: ['Evening Star', 'Three White Soldiers', 'Morning Star', 'Bullish Engulfing'], correctAnswer: 2, explanation: 'The Morning Star is a bullish reversal pattern consisting of a long bearish candle, a small indecisive candle, and a long bullish candle.' },
      ],
    },
  },
  {
    id: 'l11',
    courseId: 'c2',
    title: 'Support & Resistance',
    content: `Support and resistance are fundamental concepts in technical analysis. They represent price levels where the market has historically reacted, and they help traders identify potential entry and exit points.

Support — A price level where buying pressure is strong enough to prevent the price from falling further. At support, demand exceeds supply. Think of it as a floor that supports the price.

Resistance — A price level where selling pressure is strong enough to prevent the price from rising further. At resistance, supply exceeds demand. Think of it as a ceiling that caps the price.

How Support and Resistance Form:
• Previous Highs and Lows — Price levels where the market has reversed before become reference points
• Round Numbers — Psychological levels like ₹500, ₹1,000, ₹20,000 act as support/resistance
• Moving Averages — 50-day, 100-day, and 200-day moving averages often act as dynamic support/resistance
• Trendlines — Drawn along consecutive highs (resistance) or lows (support)
• Fibonacci Levels — 38.2%, 50%, and 61.8% retracement levels

Role Reversal — One of the most important concepts in technical analysis:
• When a resistance level is broken to the upside, it often becomes support
• When a support level is broken to the downside, it often becomes resistance
• This happens because traders who missed the breakout buy on the first pullback

Strength of Support/Resistance Levels:
• The more times a level has been tested, the stronger it becomes
• The longer the time frame, the more significant the level
• High volume at a level increases its significance
• A level that has recently formed is more relevant than one from months ago

Breakouts vs. Fakeouts:
• A true breakout is accompanied by high volume and strong momentum
• A fakeout (false breakout) happens when price briefly breaks a level but quickly reverses
• To avoid fakeouts, wait for a close above/below the level or use a volume filter

Applying Support and Resistance in Trading:
• Buy near support with a stop-loss below support
• Sell near resistance with a stop-loss above resistance
• Enter on the breakout of a significant level
• Take profits at the next support/resistance level`,
    duration: '30 min',
    completed: true,
  },
  {
    id: 'l12',
    courseId: 'c2',
    title: 'Moving Averages',
    content: `Moving averages are one of the most versatile and widely used technical indicators. They smooth out price data to help traders identify trends and potential reversal points.

What is a Moving Average? — A moving average calculates the average price over a specified number of periods. As new data becomes available, the oldest data point is dropped, and the new one is added — hence the average "moves."

Types of Moving Averages:
• Simple Moving Average (SMA) — The arithmetic mean of prices over a specified period. Gives equal weight to all data points.
• Exponential Moving Average (EMA) — Gives more weight to recent prices, making it more responsive to new information. Preferred by short-term traders.

Common Periods:
• 20-day MA — Short-term trend indicator
• 50-day MA — Intermediate trend indicator
• 100-day MA — Medium-term trend indicator
• 200-day MA — Long-term trend indicator (bull/bear market line)

Using Moving Averages:

1. Trend Identification — When price is above the moving average, the trend is up. When price is below, the trend is down. The slope of the MA also matters — a rising MA confirms an uptrend, while a falling MA confirms a downtrend.

2. Crossovers — When a shorter-term MA crosses above a longer-term MA, it generates a "Golden Cross" — a bullish signal. When a shorter-term MA crosses below a longer-term MA, it generates a "Death Cross" — a bearish signal.
• 50-day SMA crossing above 200-day SMA = Golden Cross (strong bullish signal)
• 50-day SMA crossing below 200-day SMA = Death Cross (strong bearish signal)

3. Dynamic Support and Resistance — Moving averages often act as support in uptrends and resistance in downtrends. Traders look to buy when price pulls back to a rising MA during an uptrend.

4. Moving Average Ribbons — Using multiple MAs (e.g., 10, 20, 30, 40, 50, 60) creates a ribbon. When the ribbon is expanding and ordered (shortest on top), it confirms a strong trend. When the ribbon contracts and crosses, it signals a trend change.

Limitations of Moving Averages:
• Lagging indicator — Based on past prices, so they always lag current price action
• Can give false signals in sideways (range-bound) markets
• No single MA period works for all markets or time frames

Best Practice: Combine moving averages with other indicators (like RSI or MACD) and price action analysis for more reliable signals.`,
    duration: '25 min',
    completed: false,
    quiz: {
      id: 'q7',
      title: 'Moving Averages Quiz',
      score: 0,
      passed: false,
      questions: [
        { id: 'q7_1', question: 'What is the key difference between SMA and EMA?', options: ['SMA is faster than EMA', 'EMA gives more weight to recent prices', 'SMA only uses closing prices', 'EMA is only for daily charts'], correctAnswer: 1, explanation: 'The Exponential Moving Average (EMA) gives more weight to recent price data, making it more responsive to new information compared to the Simple Moving Average (SMA).' },
        { id: 'q7_2', question: 'What does a Golden Cross indicate?', options: ['Bearish reversal', 'Bullish signal when 50-day MA crosses above 200-day MA', 'Market is about to crash', 'Moving average convergence'], correctAnswer: 1, explanation: 'A Golden Cross occurs when the 50-day moving average crosses above the 200-day moving average and is considered a strong bullish signal.' },
      ],
    },
  },
  {
    id: 'l13',
    courseId: 'c2',
    title: 'RSI & MACD',
    content: `RSI (Relative Strength Index) and MACD (Moving Average Convergence Divergence) are two of the most popular momentum indicators. Together, they provide powerful insights into market strength and trend direction.

RSI (Relative Strength Index) — Developed by J. Welles Wilder, RSI measures the speed and magnitude of recent price changes to evaluate overbought or oversold conditions.

RSI Calculation and Interpretation:
• RSI ranges from 0 to 100
• RSI above 70 = Overbought (potential for reversal or pullback)
• RSI below 30 = Oversold (potential for bounce or reversal)
• RSI around 50 = Neutral

Advanced RSI Signals:
• Divergence — When price makes a higher high but RSI makes a lower high = Bearish divergence (trend weakening)
• When price makes a lower low but RSI makes a higher low = Bullish divergence (trend weakening)
• Centerline Cross — RSI crossing above 50 is bullish, crossing below 50 is bearish
• Failure Swings — RSI moves above 70, pulls back (stays above 40), then breaks the previous high = bullish continuation

MACD (Moving Average Convergence Divergence) — Developed by Gerald Appel, MACD is a trend-following momentum indicator that shows the relationship between two moving averages.

MACD Components:
• MACD Line — (12-day EMA minus 26-day EMA) — Shows the convergence/divergence of two EMAs
• Signal Line — 9-day EMA of the MACD Line — Trigger for buy/sell signals
• Histogram — MACD Line minus Signal Line — Shows momentum strength

MACD Signals:
• MACD Line crossing above Signal Line = Bullish (buy)
• MACD Line crossing below Signal Line = Bearish (sell)
• MACD crossing above zero line = Bullish (momentum shifting positive)
• MACD crossing below zero line = Bearish (momentum shifting negative)
• Divergence between MACD and price = Trend weakness (same as RSI divergence)

Using RSI and MACD Together:
• MACD identifies the trend and momentum direction
• RSI identifies overbought/oversold conditions within the trend
• In a strong uptrend, buy on RSI pullbacks to 40–50 (not 30)
• In a strong downtrend, sell on RSI rallies to 60–70 (not 70)
• MACD crossover in the direction of the trend confirms the signal

Common Mistakes:
• Don't short just because RSI is above 70 — in strong trends, RSI can stay overbought for extended periods
• Don't buy just because RSI is below 30 — in strong downtrends, RSI can stay oversold
• Always use these indicators in conjunction with price action and trend analysis`,
    duration: '30 min',
    completed: false,
    quiz: {
      id: 'q8',
      title: 'RSI & MACD Quiz',
      score: 0,
      passed: false,
      questions: [
        { id: 'q8_1', question: 'What RSI level is typically considered oversold?', options: ['Above 70', 'Below 30', 'At 50', 'Below 20'], correctAnswer: 1, explanation: 'RSI below 30 is generally considered oversold, suggesting the price may be due for a bounce or reversal.' },
        { id: 'q8_2', question: 'What are the three components of MACD?', options: ['RSI, Signal Line, Histogram', 'MACD Line, Signal Line, Histogram', 'MACD Line, RSI, Moving Average', 'Signal Line, Stochastic, Histogram'], correctAnswer: 1, explanation: 'MACD consists of three components: the MACD Line (12 EMA - 26 EMA), the Signal Line (9 EMA of MACD Line), and the Histogram showing the difference between them.' },
      ],
    },
  },
  {
    id: 'l14',
    courseId: 'c2',
    title: 'Chart Patterns',
    content: `Chart patterns are specific formations that appear on price charts and signal potential future price movements. They are created by the collective psychology of market participants and tend to repeat over time.

Reversal Patterns — Signal that the current trend is about to reverse:

1. Head and Shoulders (Top) — A top reversal pattern consisting of three peaks: a higher middle peak (head) between two lower peaks (shoulders). The neckline connects the two troughs. A break below the neckline confirms the reversal. The price target is the distance from the head to the neckline, projected downward from the breakout.

2. Inverse Head and Shoulders (Bottom) — The opposite of the above — a bottom reversal pattern. A break above the neckline confirms a bullish reversal.

3. Double Top — Price reaches a resistance level twice but fails to break through, forming two roughly equal peaks. A break below the support level (the trough between the peaks) confirms the pattern.

4. Double Bottom — Price reaches a support level twice but fails to break through, forming two roughly equal troughs. A break above resistance confirms a bullish reversal.

5. Rounding Bottom (Cup and Handle) — A gradual U-shaped bottom followed by a small consolidation (handle). A break above the handle's resistance confirms the pattern. One of the most reliable bullish patterns.

Continuation Patterns — Signal that the current trend is likely to continue after a pause:

1. Bullish Flag — A sharp upward move (flagpole) followed by a downward-sloping consolidation (flag). A break above the flag's upper trendline confirms continuation. The target is the height of the flagpole added to the breakout.

2. Bearish Flag — A sharp downward move followed by an upward-sloping consolidation. A break below the flag confirms continuation.

3. Symmetrical Triangle — Converging trendlines where each successive high is lower and each successive low is higher. A breakout in either direction signals the trend. Volume should increase on the breakout.

4. Ascending Triangle — A flat resistance line and rising support line. Typically bullish — a break above resistance confirms.

5. Descending Triangle — A flat support line and falling resistance line. Typically bearish — a break below support confirms.

6. Pennant — Similar to a flag but with converging trendlines (small symmetrical triangle). Follows a sharp price move.

Key Principles for Trading Chart Patterns:
• The larger the pattern, the more significant the potential move
• Higher time frame patterns are more reliable
• Volume should expand on the breakout
• Wait for a confirmed breakout (close beyond the pattern boundary)
• The measured target is the height of the pattern projected from the breakout`,
    duration: '30 min',
    completed: false,
  },
  {
    id: 'l15',
    courseId: 'c2',
    title: 'Volume Analysis',
    content: `Volume is one of the most important indicators available to traders. It measures the number of shares traded during a given period and reveals the strength (or weakness) behind price movements.

Why Volume Matters:
• Volume confirms trends — Strong trends are accompanied by increasing volume
• Volume signals reversals — Climax volume can mark the end of a trend
• Volume validates breakouts — A breakout on high volume is more likely to succeed
• Volume divergence — When price and volume move in opposite directions, the trend is weakening

Key Volume Patterns:

Volume Confirms Trend:
• Uptrend with rising volume = Healthy, strong trend
• Uptrend with declining volume = Weakening trend, possible reversal
• Downtrend with rising volume = Strong selling pressure
• Downtrend with declining volume = Selling pressure diminishing

Volume and Breakouts:
• Breakout above resistance with 50%+ increase in average volume = Strong breakout
• Breakout with below-average volume = False breakout (fakeout)
• Retest of breakout level on low volume = Successful retest

Climax Volume:
• Buying Climax — Extremely high volume at the end of an uptrend. Smart money distributes to the public.
• Selling Climax — Extremely high volume at the end of a downtrend. Panic selling followed by a reversal.

Volume Indicators:

1. On-Balance Volume (OBV) — A cumulative volume indicator developed by Joe Granville. OBV adds volume on up days and subtracts volume on down days. Divergence between OBV and price signals trend weakness.

2. Volume Price Trend (VPT) — Similar to OBV but uses percentage price changes to weight volume.

3. Accumulation/Distribution Line — Uses the close relative to the day's range to weight volume. Shows whether a stock is being accumulated (bought) or distributed (sold).

4. Volume-Weighted Average Price (VWAP) — The average price weighted by volume. Institutional traders use VWAP to evaluate trade execution quality. Price above VWAP is bullish, below is bearish.

Putting It All Together:
• Price making higher highs + OBV making higher highs = Strong uptrend
• Price making higher highs + OBV making lower highs = Bearish divergence (sell)
• Price making lower lows + OBV making higher lows = Bullish divergence (buy)
• Volume spike at resistance = potential breakout
• Volume drying up at support = potential bounce`,
    duration: '25 min',
    completed: false,
  },
  {
    id: 'l16',
    courseId: 'c2',
    title: 'Building a Trading System',
    content: `A trading system is a set of rules that defines when to enter, when to exit, and how much to risk on each trade. Having a system removes emotion from trading and provides a framework for consistent decision-making.

Components of a Trading System:

1. Market Selection — Which markets or stocks will you trade? Consider liquidity, volatility, and your available time:
   • Highly liquid stocks with tight spreads
   • Stocks with sufficient daily volatility for your time frame
   • Markets that exhibit trending behavior

2. Entry Rules — Specific conditions that must be met before entering a trade:
   • Technical indicators aligned (e.g., RSI above 50, MACD bullish crossover)
   • Price action confirmation (e.g., bullish engulfing at support)
   • Volume confirmation (e.g., volume above 20-day average)
   • Trend filter (e.g., only take long trades when price is above 200-day MA)

3. Exit Rules — When to close a position:
   • Profit Target — Based on support/resistance, Fibonacci extensions, or fixed reward multiple
   • Stop Loss — Based on technical levels, volatility (ATR), or fixed percentage
   • Trailing Stop — Moves the stop in the direction of profit as the trade moves favorably

4. Position Sizing — How much to risk on each trade:
   • Fixed Percentage — Risk 1–2% of your capital per trade
   • Kelly Criterion — Percentage of capital to risk based on win rate and average win/loss ratio
   • Volatility-Based — Adjust position size based on stock volatility (ATR)

Example Swing Trading System:
• Time Frame: Daily
• Universe: Nifty 200 stocks
• Entry: Price closes above 20-day EMA AND RSI(14) crosses above 50
• Stop Loss: 2x ATR(14) below entry
• Target: Previous resistance level or 3x risk
• Position Size: Risk max 1% of capital per trade

Backtesting — Before trading a system with real money, test it on historical data:
• Calculate win rate, average win, average loss, and maximum drawdown
• Aim for a profit factor (gross profit / gross loss) above 1.5
• Ensure the system has at least 30–50 trades in the backtest
• Test across different market conditions (bull, bear, sideways)

Keeping a Trading Journal:
• Record every trade with entry, exit, stop loss, target, and rationale
• Analyze what worked and what didn't
• Track your emotional state during trades
• Review and refine your system continuously

Remember: No trading system works all the time. The goal is to have a system that is profitable over many trades, not to win every trade. Focus on process, not outcome.`,
    duration: '30 min',
    completed: false,
  },

  // ─── Course 3: Fundamental Analysis (8 lessons) ───
  {
    id: 'l17',
    courseId: 'c3',
    title: 'Introduction to Fundamental Analysis',
    content: `Fundamental analysis is the process of evaluating a company's intrinsic value by examining its financial health, business model, competitive advantages, industry position, and economic environment. It answers one simple question: Is this company worth investing in?

Top-Down vs. Bottom-Up Approach:

Top-Down Analysis — Start with the overall economy, then narrow down to industries, and finally select individual companies:
1. Global Economic Analysis — GDP growth, inflation, interest rates, geopolitical factors
2. Domestic Economic Analysis — India's economic growth, fiscal policy, RBI monetary policy
3. Industry Analysis — Sector growth rates, regulatory environment, competitive dynamics
4. Company Analysis — Financial health, management quality, valuation

Bottom-Up Analysis — Focus on individual companies regardless of the macro environment. Warren Buffett famously uses this approach — find great companies at reasonable prices.

The Value Investing Philosophy — Popularized by Benjamin Graham and Warren Buffett:
• Buy a stock as if you are buying the entire business
• Look for a "margin of safety" — buying at a significant discount to intrinsic value
• Focus on the long term — holding periods measured in years, not weeks
• Ignore market noise and short-term price fluctuations

Key Questions Fundamental Analysis Answers:
1. Is the company profitable and growing?
2. Does the company have a competitive advantage?
3. Is the management capable and shareholder-friendly?
4. Is the company financially stable?
5. Is the stock reasonably priced relative to its intrinsic value?

Where to Find Information:
• Company Annual Reports — Available on company websites and the BSE/NSE websites
• Quarterly Results — Published within 45 days of each quarter end
• Analyst Reports — Available on brokerage platforms and financial websites
• Regulatory Filings — SEBI, ROC, and stock exchange filings
• Financial News — Business newspapers, financial TV channels, online portals

Fundamental analysis requires patience and diligence. It is not about finding the next hot stock — it is about understanding what you own and why you own it.`,
    duration: '25 min',
    completed: false,
    quiz: {
      id: 'q9',
      title: 'Fundamental Analysis Intro Quiz',
      score: 0,
      passed: false,
      questions: [
        { id: 'q9_1', question: 'What does "margin of safety" mean in value investing?', options: ['Using stop-loss orders', 'Buying at a significant discount to intrinsic value', 'Investing only in government bonds', 'Diversifying across 20+ stocks'], correctAnswer: 1, explanation: 'Margin of safety is the difference between a stock\'s intrinsic value and its market price. A larger margin of safety provides a buffer against errors in analysis.' },
        { id: 'q9_2', question: 'What is the first step in the top-down approach to fundamental analysis?', options: ['Analyze the company', 'Analyze the global economy', 'Analyze the industry', 'Read the annual report'], correctAnswer: 1, explanation: 'The top-down approach starts with the global economy, then moves to domestic economy, industry, and finally the specific company.' },
      ],
    },
  },
  {
    id: 'l18',
    courseId: 'c3',
    title: 'Reading Financial Statements',
    content: `Financial statements are the language of business. Learning to read them is essential for evaluating companies. There are three primary financial statements you need to understand.

1. Balance Sheet — A snapshot of what the company owns (assets) and owes (liabilities) at a specific point in time.

Assets = Liabilities + Shareholders' Equity

Key Components:
• Current Assets — Cash, accounts receivable, inventory (convertible to cash within 1 year)
• Non-Current Assets — Property, plant, equipment (PP&E), intangible assets, goodwill
• Current Liabilities — Accounts payable, short-term debt, accrued expenses (due within 1 year)
• Long-Term Liabilities — Long-term debt, deferred tax liabilities, pension obligations
• Shareholders' Equity — Share capital, retained earnings, reserves

What to look for: High current assets relative to current liabilities (liquidity), reasonable debt levels, growing retained earnings.

2. Profit & Loss (P&L) Statement — Shows the company's revenues, expenses, and profits over a period.

Revenue — Sales from core business operations
Less: Cost of Goods Sold (COGS) = Gross Profit
Less: Operating Expenses (SG&A, R&D, Depreciation) = Operating Profit (EBIT)
Less: Interest and Taxes = Net Profit

Key Ratios from P&L:
• Gross Margin = Gross Profit / Revenue (profitability of core operations)
• Operating Margin = Operating Profit / Revenue (operational efficiency)
• Net Margin = Net Profit / Revenue (overall profitability)

3. Cash Flow Statement — Shows how cash moves in and out of the business. More difficult to manipulate than P&L.

Three Sections:
• Operating Cash Flow — Cash from core business operations. Should be positive and growing.
• Investing Cash Flow — Cash spent on assets or received from asset sales. Usually negative (company investing in growth).
• Financing Cash Flow — Cash from debt/equity issuance or used for buybacks/dividends.

Red Flags in Financial Statements:
• Revenue growing but operating cash flow declining
• Increasing accounts receivable (customers not paying)
• Goodwill growing faster than total assets
• One-time gains masking underlying weakness
• Related party transactions with unfavorable terms
• Auditor qualifications or frequent auditor changes`,
    duration: '30 min',
    completed: false,
  },
  {
    id: 'l19',
    courseId: 'c3',
    title: 'Key Financial Ratios',
    content: `Financial ratios help you quickly assess a company's performance and compare it with peers. Here are the most important ratios every investor should know.

Valuation Ratios:

1. Price-to-Earnings (P/E) Ratio = Stock Price / Earnings Per Share (EPS)
   • A high P/E suggests the market expects high future growth
   • Compare P/E with industry average and historical P/E
   • A P/E significantly below industry average may indicate undervaluation (or problems)

2. Price-to-Book (P/B) Ratio = Stock Price / Book Value Per Share
   • Measures how much investors are paying for the company's net assets
   • P/B under 1 can indicate undervaluation (but also potential trouble)
   • Most relevant for financial companies (banks, insurance)

3. Price-to-Sales (P/S) Ratio = Market Cap / Total Revenue
   • Useful for companies with negative earnings
   • Indicates how much investors pay per rupee of revenue

4. Dividend Yield = Annual Dividend Per Share / Stock Price
   • Measures return from dividends alone
   • Compare with fixed deposit rates and bond yields

Profitability Ratios:

1. Return on Equity (ROE) = Net Profit / Shareholders' Equity
   • Measures how efficiently the company uses shareholder capital
   • Look for consistent ROE above 15%
   • Sustainable high ROE suggests a competitive advantage

2. Return on Capital Employed (ROCE) = EBIT / (Total Assets - Current Liabilities)
   • Measures return on ALL capital (debt + equity)
   • Should be higher than the company's cost of capital
   • Compare with the company's weighted average cost of capital (WACC)

3. Net Profit Margin = Net Profit / Revenue
   • Higher margins indicate pricing power and cost efficiency

Financial Health Ratios:

1. Debt-to-Equity (D/E) Ratio = Total Liabilities / Shareholders' Equity
   • High D/E (above 1) = More risky, especially in rising interest rate environments
   • Varies by industry — utilities and infrastructure companies can have higher D/E

2. Current Ratio = Current Assets / Current Liabilities
   • Above 1.5 is generally healthy
   • Below 1 indicates potential liquidity problems

3. Interest Coverage Ratio = EBIT / Interest Expense
   • Below 1.5 is a red flag — company may struggle to pay interest
   • Above 3 is comfortable

Growth Ratios:
• Revenue Growth (YoY) — Is the company growing its top line?
• EPS Growth (YoY) — Is the bottom line growing faster than revenue?
• Book Value Growth — Is the company creating value for shareholders?

No single ratio tells the complete story. Always analyze ratios in context — compare with industry peers, historical trends, and the overall economic environment.`,
    duration: '30 min',
    completed: false,
  },
  {
    id: 'l20',
    courseId: 'c3',
    title: 'Discounted Cash Flow (DCF) Valuation',
    content: `Discounted Cash Flow (DCF) analysis is the most rigorous method for estimating a company's intrinsic value. It is based on the principle that a company is worth all the cash it can generate in the future, discounted back to the present.

The Core Concept — A rupee today is worth more than a rupee tomorrow because you can invest today's rupee to earn a return. Therefore, future cash flows must be "discounted" to account for the time value of money and risk.

Steps in DCF Valuation:

Step 1: Project Free Cash Flows
Free Cash Flow (FCF) = Operating Cash Flow — Capital Expenditures
• Project FCF for 5–10 years
• Use historical growth rates, industry outlook, and competitive position
• Be conservative — it is better to underestimate than overestimate

Step 2: Calculate the Terminal Value
• After the projection period, assume the company grows at a stable, low rate (typically 2–4% = GDP growth rate)
• Terminal Value = Final Year FCF × (1 + Growth Rate) / (Discount Rate — Growth Rate)
• Terminal value often represents 60–80% of total valuation

Step 3: Determine the Discount Rate (WACC)
• Weighted Average Cost of Capital (WACC) = Cost of Equity × (Equity / Total Capital) + Cost of Debt × (Debt / Total Capital) × (1 — Tax Rate)
• Cost of Equity is estimated using the Capital Asset Pricing Model (CAPM)
• For Indian companies, WACC typically ranges from 10% to 15%

Step 4: Discount Everything to Present Value
• Discount each year's FCF and the terminal value back to today
• Present Value = Future Value / (1 + Discount Rate) ^ Number of Years

Step 5: Calculate Intrinsic Value
• Enterprise Value = Sum of discounted FCFs + Discounted Terminal Value
• Equity Value = Enterprise Value — Net Debt (Total Debt — Cash)
• Intrinsic Value Per Share = Equity Value / Total Number of Shares

Compare with current market price:
• If intrinsic value > market price = Undervalued (potential buy)
• If intrinsic value < market price = Overvalued (avoid or sell)

Limitations of DCF:
• Highly sensitive to assumptions (growth rate, discount rate, terminal value)
• Less useful for cyclical companies with unpredictable earnings
• Does not account for potential acquisitions, restructuring, or other corporate actions
• Small changes in assumptions can produce very different valuations

Despite its limitations, DCF forces you to think deeply about a company's business model, competitive position, and growth prospects.`,
    duration: '35 min',
    completed: false,
    quiz: {
      id: 'q10',
      title: 'DCF Valuation Quiz',
      score: 0,
      passed: false,
      questions: [
        { id: 'q10_1', question: 'What does DCF stand for?', options: ['Discounted Cash Flow', 'Direct Cash Finance', 'Derived Cash Formula', 'Discretionary Cash Flow'], correctAnswer: 0, explanation: 'DCF stands for Discounted Cash Flow — a valuation method that estimates intrinsic value by discounting projected future cash flows.' },
        { id: 'q10_2', question: 'What does WACC represent in DCF analysis?', options: ['The growth rate of the company', 'The discount rate reflecting the company\'s cost of capital', 'The terminal growth rate', 'The inflation rate'], correctAnswer: 1, explanation: 'WACC (Weighted Average Cost of Capital) is the discount rate that reflects the company\'s blended cost of equity and debt capital.' },
      ],
    },
  },
  {
    id: 'l21',
    courseId: 'c3',
    title: 'Industry Analysis',
    content: `A company's performance is heavily influenced by the industry it operates in. Even the best-managed company will struggle in a declining industry, while average companies can thrive in growing ones.

Porter's Five Forces Framework — Developed by Harvard professor Michael Porter to analyze industry attractiveness:

1. Threat of New Entrants — How easy is it for new competitors to enter the industry?
   • High barriers: Patents, high capital requirements, government regulations, brand loyalty
   • Low barriers: Commodity businesses, low capital requirements, simple technology
   • Impact: Lower threat = More pricing power and higher profits

2. Bargaining Power of Suppliers — Can suppliers dictate terms?
   • High power: Few suppliers, unique products, high switching costs
   • Low power: Many suppliers, commodity inputs, easy to switch
   • Impact: High supplier power = Lower margins for companies in the industry

3. Bargaining Power of Buyers — Can customers demand lower prices?
   • High power: Few large buyers, undifferentiated products, low switching costs
   • Low power: Many small buyers, unique products, high switching costs
   • Impact: High buyer power = Lower prices and margins

4. Threat of Substitutes — Can customers use alternative products or services?
   • Examples: Streaming vs cable TV, EVs vs petrol cars, digital payments vs cash
   • Impact: More substitutes = Lower pricing power

5. Industry Rivalry — How intense is the competition?
   • Factors: Number of competitors, industry growth rate, fixed costs, exit barriers
   • Impact: High rivalry = Price wars, lower profits

Industry Life Cycle:
• Introduction — Early stage, high risk, negative profits, many players
• Growth — Rapid expansion, profits improving, competition increasing
• Maturity — Stable growth, established players, strong cash flows
• Decline — Shrinking market, consolidation, companies exiting

Analyzing Industry Structure in India:
• Regulatory environment — Government policies, licensing, foreign investment limits
• Cyclical vs. defensive — Cyclical (auto, metals, real estate) vs defensive (FMCG, pharma, IT)
• Organized vs. unorganized — Industries with high unorganized share offer consolidation opportunity
• Input cost sensitivity — Impact of raw material prices, labor costs, interest rates

A great business in a great industry is the ideal combination. But even a great business in a poor industry may not be a good investment.`,
    duration: '25 min',
    completed: false,
  },
  {
    id: 'l22',
    courseId: 'c3',
    title: 'Economic Moats',
    content: `An economic moat is a company's sustainable competitive advantage that protects it from competitors. The term was popularized by Warren Buffett, who looks for companies with wide, durable moats.

Types of Economic Moats:

1. Cost Advantage — The ability to produce goods or services at a lower cost than competitors:
   • Economies of scale — Larger companies spread fixed costs over more units (e.g., Reliance Industries)
   • Proprietary technology — Patents or trade secrets that competitors cannot replicate
   • Access to cheap raw materials — Exclusive supply agreements or favorable locations
   • Efficient processes — Unique operational expertise (e.g., Toyota Production System)

2. Switching Costs — Costs (financial or psychological) that prevent customers from switching to competitors:
   • Software ecosystems — Moving from one software to another is expensive and disruptive
   • Banking relationships — The hassle of changing banks keeps customers loyal
   • Industrial supplies — Custom components that require requalification to change suppliers

3. Network Effects — The value of a product or service increases as more people use it:
   • Social platforms — More users attract more users (e.g., Zerodha's trading platform)
   • Marketplaces — More buyers attract more sellers, which attracts more buyers
   • Payment systems — More merchants accepting a payment method encourages more users

4. Intangible Assets — Brands, patents, and regulatory licenses that competitors cannot replicate:
   • Brand power — Premium pricing due to brand trust and recognition (e.g., Hindustan Unilever)
   • Patents — Legal protection for innovations (e.g., pharmaceutical companies)
   • Regulatory licenses — Banking licenses, telecom spectrum, mining rights

5. Efficient Scale — A market that is only large enough to support a few competitors profitably:
   • Natural monopolies — Utilities, railway networks, pipelines
   • Oligopolies — Industries where the efficient scale limits the number of profitable players

Evaluating Moat Strength:
• Wide moat — Strong competitive advantage expected to last >20 years (e.g., HDFC Bank, Asian Paints)
• Narrow moat — Competitive advantage expected to last 10–20 years
• No moat — Limited or no competitive advantage

Moat Threats — Even the strongest moats can erode:
• Technological disruption — New technology makes old advantages obsolete (e.g., Kodak)
• Regulatory changes — New laws undermine competitive positions
• Changing consumer preferences — Tastes evolve, brands lose relevance
• Poor management decisions — Misallocation of capital weakens competitive position

The best investments are companies with wide moats that are getting wider — where the competitive advantage is strengthening over time, not weakening.`,
    duration: '25 min',
    completed: false,
  },
  {
    id: 'l23',
    courseId: 'c3',
    title: 'Annual Report Analysis',
    content: `The annual report is the most comprehensive source of information about a company. Learning to read it effectively is a superpower for investors.

Structure of an Annual Report:
1. Management Discussion & Analysis (MD&A) — Management's perspective on the business
2. Director's Report — Summary of operations, dividends, and corporate governance
3. Financial Statements — Balance sheet, P&L, cash flow, notes
4. Auditor's Report — Independent auditor's opinion on financial statements
5. Corporate Governance Report — Board composition, related party transactions
6. Shareholding Pattern — Who owns the company

What to Look For in Each Section:

Management Discussion & Analysis:
• What are the key growth drivers and risks identified by management?
• Is the discussion candid about challenges, or excessively optimistic?
• What is the competitive landscape and market share trend?
• What is the capital allocation strategy?

Director's Report:
• Dividend history and payout ratio
• Subsidiary performance
• Risk management framework
• Corporate social responsibility (CSR) initiatives

Notes to Accounts (Critical!):
• Revenue recognition policy — Conservative or aggressive?
• Depreciation method and useful lives — Reasonable assumptions?
• Contingent liabilities — Potential future obligations
• Related party transactions — Arm's length or favorable to promoters?
• Off-balance sheet items — Leases, guarantees, derivatives

Red Flags in Annual Reports:
• Frequent changes in accounting policies
• Revenue growing but receivables growing faster
• Inventory buildup without corresponding sales growth
• Capitalization of expenses that should be expensed
• Write-offs of assets or investments in subsequent years
• Pension fund or employee stock option expenses underestimated
• Unusual related party transactions
• Auditor's emphasis of matter or qualified opinion
• CEO or CFO resignation without clear reason
• Related party loans or investments in group companies

Key Sections to Read First:
1. MD&A — For management's perspective
2. Auditor's Report — For any qualifications or concerns
3. Notes on Revenue and Related Party Transactions — For potential red flags
4. Segment Reporting — To understand which parts of the business drive performance

Reading annual reports is a skill that improves with practice. Start with companies you already know — it makes the learning process more engaging.`,
    duration: '30 min',
    completed: false,
  },
  {
    id: 'l24',
    courseId: 'c3',
    title: 'Building a Value Investing Checklist',
    content: `Value investing is about buying great companies at reasonable prices. A systematic checklist helps you evaluate opportunities consistently and avoid emotional decisions.

The Buffett-Munger Framework:

1. Business Quality Checklist:
   ☐ Does the business have a durable competitive advantage (economic moat)?
   ☐ Is the business simple and understandable?
   ☐ Does it have consistent operating history (10+ years)?
   ☐ Does it generate strong and consistent free cash flow?
   ☐ Does it have high returns on capital (ROE > 15%, ROCE > cost of capital)?
   ☐ Does it have pricing power (ability to raise prices without losing customers)?
   ☐ Is it a leader in its industry?

2. Management Quality Checklist:
   ☐ Is management competent and shareholder-friendly?
   ☐ Do they have a significant ownership stake in the company?
   ☐ Is capital allocation wise (buybacks, dividends, acquisitions)?
   ☐ Is the compensation structure aligned with long-term shareholder value?
   ☐ Is the communication transparent and honest?
   ☐ Has management demonstrated integrity over time?

3. Financial Health Checklist:
   ☐ Is the debt-to-equity ratio manageable (< 1 for most industries)?
   ☐ Is the interest coverage ratio comfortable (> 3)?
   ☐ Is the current ratio healthy (> 1.5)?
   ☐ Is operating cash flow consistently positive and growing?
   ☐ Are capital expenditure requirements reasonable?
   ☐ Is working capital management efficient?

4. Valuation Checklist:
   ☐ Is the P/E ratio reasonable compared to historical average and peers?
   ☐ Is the P/B ratio reasonable for the industry?
   ☐ Does the DCF valuation suggest a margin of safety (> 20%)?
   ☐ Is the dividend yield attractive if applicable?
   ☐ Is the PEG ratio (P/E / Growth rate) below 1.5?

5. Risk Checklist:
   ☐ What could permanently impair the business?
   ☐ Is there technological disruption risk?
   ☐ Is there regulatory risk?
   ☐ Is there concentration risk (single customer, single product, single geography)?
   ☐ Is the company dependent on a single person?

The Final Decision:
• If a stock scores well on all checklists, it is a potential investment
• If it has minor concerns in one area, investigate further
• If there are multiple red flags, pass — there are always other opportunities
• Remember the rule: "It is far better to buy a wonderful company at a fair price than a fair company at a wonderful price."

Temperament is as important as analysis. Value investing requires patience to wait for the right opportunity, discipline to stick to your criteria, and conviction to buy when others are selling.`,
    duration: '30 min',
    completed: false,
  },

  // ─── Course 4: Mutual Funds & SIP Investing (6 lessons) ───
  {
    id: 'l25',
    courseId: 'c4',
    title: 'What are Mutual Funds?',
    content: `A mutual fund is a pooled investment vehicle that collects money from multiple investors and invests it in a diversified portfolio of stocks, bonds, or other securities. When you invest in a mutual fund, you buy units that represent your share of the portfolio.

How Mutual Funds Work:
1. An Asset Management Company (AMC) creates a fund with a specific investment objective
2. Investors buy units of the fund at the Net Asset Value (NAV)
3. The fund manager invests the pooled money according to the fund's stated strategy
4. The value of your investment changes as the underlying securities change in value
5. You can redeem your units at the prevailing NAV

Net Asset Value (NAV) — The price per unit of a mutual fund. It is calculated as:
NAV = (Total Assets — Total Liabilities) / Total Number of Units Outstanding
NAV changes daily based on the market value of the fund's holdings.

Types of Mutual Funds by Structure:

Open-Ended Funds — You can buy and sell units at any time at the prevailing NAV. Most mutual funds in India are open-ended. These funds offer high liquidity.

Close-Ended Funds — You can only buy units during the New Fund Offer (NFO) period. The fund has a fixed maturity date, and you can redeem only at maturity or through the stock exchange (if listed).

Interval Funds — Combine features of open-ended and close-ended funds. You can buy/sell at specified intervals.

Types of Mutual Funds by Asset Class:

Equity Mutual Funds — Invest primarily in stocks
Debt Mutual Funds — Invest in fixed-income securities like bonds and treasury bills
Hybrid Mutual Funds — Invest in a mix of equity and debt
Money Market Funds — Invest in short-term instruments (Treasury Bills, Commercial Paper)
Commodity Funds — Invest in gold, silver, or other commodities
Real Estate Funds — Invest in real estate or Real Estate Investment Trusts (REITs)

Expense Ratio — The annual fee charged by the fund for management and operations. It is expressed as a percentage of assets. For example, a 1% expense ratio means ₹1,000 is charged annually for every ₹1,00,000 invested. Lower expense ratios mean higher returns for investors.

Load vs. No-Load Funds:
• Entry Load — A fee charged when you invest. Banned by SEBI in 2009.
• Exit Load — A fee charged when you redeem within a specified period (usually 1 year). Typically 0.5–1% for equity funds.

Mutual funds offer diversification, professional management, and convenience — making them an ideal starting point for new investors.`,
    duration: '20 min',
    completed: true,
    quiz: {
      id: 'q11',
      title: 'Mutual Funds Basics Quiz',
      score: 100,
      passed: true,
      questions: [
        { id: 'q11_1', question: 'What does NAV stand for in mutual funds?', options: ['Net Asset Value', 'National Asset Verification', 'Net Annual Value', 'Nominal Asset Volume'], correctAnswer: 0, explanation: 'NAV (Net Asset Value) is the price per unit of a mutual fund, calculated daily based on the market value of the fund\'s holdings.' },
        { id: 'q11_2', question: 'What is the expense ratio of a mutual fund?', options: ['The rate of return promised to investors', 'The annual fee charged for fund management, expressed as a percentage', 'The minimum investment amount', 'The exit load percentage'], correctAnswer: 1, explanation: 'The expense ratio is the annual fee charged by the fund for management and operations, expressed as a percentage of the fund\'s assets.' },
      ],
    },
  },
  {
    id: 'l26',
    courseId: 'c4',
    title: 'Equity Mutual Funds',
    content: `Equity mutual funds invest primarily in stocks. They offer the highest return potential among mutual fund categories but also come with higher risk. Understanding the different types of equity funds is crucial for making the right choice.

By Market Capitalization:

Large-Cap Funds — Invest at least 80% of assets in the top 100 companies by market capitalization.
• Lower risk within equity funds
• Consistent returns (12–15% CAGR over long term)
• Ideal for conservative equity investors

Mid-Cap Funds — Invest at least 65% of assets in companies ranked 101–250 by market cap.
• Higher growth potential than large caps
• Higher volatility and risk
• Suitable for aggressive investors with a 5+ year horizon

Small-Cap Funds — Invest at least 65% of assets in companies ranked 251st and below.
• Highest return potential among equity funds
• Highest volatility — can fall 30–50% in a downturn
• Only for risk-tolerant investors with a 7+ year horizon

By Investment Strategy:

Flexi-Cap Funds — Can invest across large, mid, and small caps at the fund manager's discretion. Maximum flexibility — the manager can shift between market caps based on opportunities.

Multi-Cap Funds — Required to invest at least 25% each in large, mid, and small caps. Balanced exposure across market caps.

Value Funds — Invest in stocks that appear undervalued based on fundamentals. Follow the value investing philosophy. Lower volatility than growth funds.

Growth Funds — Invest in companies with high earnings growth potential. Higher risk but potentially higher returns compared to value funds.

ELSS (Equity Linked Savings Scheme) — Tax-saving mutual funds with a 3-year lock-in period.
• Investments up to ₹1.5 lakh qualify for tax deduction under Section 80C
• Lowest lock-in period among tax-saving options (PPF: 15 years, FD: 5 years)
• Returns are taxed as capital gains (not taxed on withdrawal, only on sale)

Sectoral/Thematic Funds — Invest in specific sectors (IT, Pharma, Banking) or themes (Consumption, ESG, Manufacturing).
• Higher risk due to lack of diversification
• Returns depend entirely on sector performance
• Only for investors who understand the sector well

Index Funds & ETFs — Passive funds that track an index (Nifty 50, Sensex, etc.).
• Lowest expense ratios (0.05–0.50%)
• No fund manager risk — returns match the index
• Best for investors who believe markets are efficient

How to Choose:
• Beginner investors should start with large-cap or flexi-cap funds
• Add mid-cap and small-cap exposure as risk appetite increases
• Use sectoral funds only as tactical allocations (5–10% of portfolio)
• Index funds are excellent for core portfolio holdings`,
    duration: '25 min',
    completed: true,
  },
  {
    id: 'l27',
    courseId: 'c4',
    title: 'Debt Mutual Funds',
    content: `Debt mutual funds invest in fixed-income securities like government bonds, corporate bonds, treasury bills, and money market instruments. They offer stable returns with lower risk than equity funds.

Types of Debt Funds:

Liquid Funds — Invest in money market instruments with maturity up to 91 days.
• Lowest risk among debt funds
• Returns: 3–5% annually
• Best for: Parking emergency funds for 1–3 months
• Exit load: None

Ultra-Short Duration Funds — Invest in instruments with Macaulay duration 3–6 months.
• Slightly higher returns than liquid funds
• Returns: 4–6% annually
• Best for: 3–6 month investment horizon

Short Duration Funds — Invest in instruments with Macaulay duration 1–3 years.
• Moderate risk and returns
• Returns: 5–7% annually
• Best for: 1–3 year investment horizon

Corporate Bond Funds — Invest at least 80% in highest-rated corporate bonds (AA+ and above).
• Higher returns than government securities
• Returns: 6–8% annually
• Best for: 2–4 year investment horizon

Gilt Funds — Invest in government securities (G-Secs).
• No credit risk (government guaranteed)
• Interest rate risk — NAV falls when yields rise
• Returns: 5–8% annually
• Best for: 3–5 year investment horizon

Credit Risk Funds — Invest in lower-rated bonds (below AA) for higher returns.
• Higher default risk
• Returns: 7–10% annually
• Only for very risk-tolerant investors with 3+ year horizon

Key Concepts in Debt Funds:

Yield to Maturity (YTM) — The total return anticipated if the bond is held to maturity. Indicates the fund's potential return.

Macaulay Duration — Measures the fund's sensitivity to interest rate changes. A duration of 3 years means the fund's NAV will fall by approximately 3% if interest rates rise by 1%.

Modified Duration — A more precise measure of interest rate sensitivity.

Credit Rating — Assessment of the issuer's ability to repay debt:
• AAA = Highest safety
• AA, A = High safety
• BBB = Moderate safety
• Below BBB = Speculative (Junk)

Interest Rate Cycle:
• When RBI cuts rates → Bond prices rise → Debt fund NAVs increase
• When RBI raises rates → Bond prices fall → Debt fund NAVs decrease
• Short-duration funds are less affected by rate changes

Debt funds are ideal for capital preservation and regular income, but they are not risk-free. The Franklin Templeton fiasco of 2020 showed that even respected debt funds can face liquidity crises.`,
    duration: '25 min',
    completed: true,
  },
  {
    id: 'l28',
    courseId: 'c4',
    title: 'SIP vs Lump Sum',
    content: `One of the most common questions for investors is: Should I invest through a Systematic Investment Plan (SIP) or invest everything at once (lump sum)?

Systematic Investment Plan (SIP) — Invest a fixed amount at regular intervals (monthly, quarterly).
• Instills financial discipline
• Rupee Cost Averaging — Buys more units when NAV is low, fewer when NAV is high
• Power of Compounding — Small amounts grow significantly over time
• No need to time the market
• Start with as little as ₹500 per month

Lump Sum Investment — Invest the entire amount at once.
• Potentially higher returns if you invest at market bottom
• Requires market timing (or at least a favorable market condition)
• Risk of investing at market peak
• Suitable when you have a large amount of ready cash

Which is Better? Research shows:

• In a rising market: Lump sum generally outperforms SIP because your entire investment participates in the uptrend from day one
• In a falling market: SIP generally outperforms because you buy more units at lower prices (rupee cost averaging)
• In a volatile market: SIP provides peace of mind and reduces timing risk

The Verdict:
• For new investors: Start with SIP — it builds discipline and reduces risk
• For experienced investors: SIP + lump sum combination works best
• For large windfalls (bonus, inheritance): Invest in staggered SIP (invest over 6–12 months) rather than all at once

Power of Compounding — Albert Einstein called compound interest the "eighth wonder of the world."

Example:
If you invest ₹10,000 per month through SIP:
• At 12% annual return: After 10 years = ₹23.2 lakhs (invested ₹12 lakhs)
• At 12% annual return: After 20 years = ₹99.9 lakhs (invested ₹24 lakhs)
• At 12% annual return: After 30 years = ₹3.52 crores (invested ₹36 lakhs)

Notice that the total invested in 30 years is only 3× the amount invested in 10 years, but the final corpus is 15× larger. That is the power of compounding!

Step-Up SIP — Increase your SIP amount by a fixed percentage every year (e.g., 10% annual increase). This aligns your investments with your income growth and dramatically increases your final corpus.

SIP vs Lump Sum Calculator:
• Use a SIP calculator to estimate your target corpus
• Adjust SIP amount based on your financial goals
• Remember that inflation will reduce the purchasing power of your returns`,
    duration: '20 min',
    completed: false,
    quiz: {
      id: 'q12',
      title: 'SIP vs Lump Sum Quiz',
      score: 0,
      passed: false,
      questions: [
        { id: 'q12_1', question: 'What is rupee cost averaging?', options: ['Buying more units when prices are high and fewer when low', 'Buying more units when prices are low and fewer when high through regular investments', 'Averaging the cost of all your investments at year-end', 'A tax-saving strategy for mutual fund investors'], correctAnswer: 1, explanation: 'Rupee cost averaging happens through SIP — when the market is down, your fixed investment buys more units, and when the market is up, it buys fewer units, averaging out your purchase cost over time.' },
        { id: 'q12_2', question: 'What happens if you invest ₹10,000/month at 12% returns for 20 years?', options: ['You get back exactly what you invested', '~₹25 lakhs', '~₹1 crore', '~₹50 lakhs'], correctAnswer: 2, explanation: 'At 12% annual returns, investing ₹10,000/month for 20 years grows to approximately ₹99.9 lakhs (almost ₹1 crore), demonstrating the power of compounding.' },
      ],
    },
  },
  {
    id: 'l29',
    courseId: 'c4',
    title: 'How to Select Mutual Funds',
    content: `With thousands of mutual funds available, choosing the right ones can be overwhelming. Here is a systematic approach to fund selection.

Step 1: Define Your Investment Objective
• Capital appreciation → Equity funds
• Regular income → Debt funds or monthly income plans
• Tax saving → ELSS funds
• Goal with specific timeframe → Select funds matching your horizon

Step 2: Past Performance (But Don't Chase Past Returns)
• Look at 3-year, 5-year, and 10-year returns (not just 1-year)
• Compare with the fund's benchmark (e.g., Nifty 50 for a large-cap fund)
• Compare with category average (e.g., how did this mid-cap fund perform vs other mid-cap funds)
• Consistency matters more than spectacular returns in one year

Step 3: Fund Manager & Investment Team
• Who is the fund manager? How long have they managed this fund?
• What is their experience and track record?
• Has the fund manager changed recently? New managers may change the fund's style.

Step 4: Expense Ratio
• Lower is better — every 0.5% saved in expenses adds significantly to your returns over time
• Direct plans have lower expense ratios than regular plans (0.5–1% lower)
• Index funds and ETFs have the lowest expense ratios
• Actively managed funds typically charge 1–1.5% for equity, 0.5–1% for debt

Step 5: Portfolio Holdings
• Does the fund's portfolio match its stated objective?
• Is the portfolio diversified or concentrated in a few stocks?
• What is the portfolio turnover ratio (high turnover = higher costs)?
• Is there style drift (e.g., a large-cap fund investing in mid-caps)?

Step 6: Risk Metrics
• Standard Deviation — Measures volatility (higher = riskier)
• Beta — Sensitivity to market movements
• Sharpe Ratio — Risk-adjusted returns (higher is better)
• Sortino Ratio — Similar to Sharpe but focuses on downside risk
• Alpha — Returns generated beyond the benchmark (positive alpha = fund manager adding value)

Step 7: AUM & Expense Trends
• Very small funds (< ₹100 crore) may not be viable long-term
• Very large funds (> ₹10,000 crore) may struggle to find good investment opportunities
• Check if the fund has consistently maintained low expense ratios

Common Mistakes to Avoid:
• Investing in too many funds (over-diversification)
• Chasing last year's top performer
• Switching funds frequently based on recent performance
• Ignoring the impact of expense ratios
• Not reviewing your portfolio periodically

A good mutual fund portfolio for a beginner: 2–3 equity funds (large-cap, flexi-cap, mid-cap) + 1 debt fund + 1 index fund.`,
    duration: '25 min',
    completed: false,
  },
  {
    id: 'l30',
    courseId: 'c4',
    title: 'Taxation of Mutual Fund Investments',
    content: `Understanding mutual fund taxation helps you maximize your post-tax returns and plan your redemptions strategically.

Equity Mutual Funds (Equity exposure > 65% of portfolio):

Short-Term Capital Gains (STCG) — Holding period < 12 months:
• Tax rate: 15% (plus surcharge and cess)
• Gains are added to your income and taxed at 15%

Long-Term Capital Gains (LTCG) — Holding period > 12 months:
• Tax rate: 10% (plus surcharge and cess)
• Only on gains exceeding ₹1 lakh in a financial year
• Gains up to ₹1 lakh are tax-free
• No indexation benefit

Debt Mutual Funds (Equity exposure < 65%) — Treated differently:

Short-Term Capital Gains — Holding period < 36 months:
• Taxed as per your income tax slab rate
• Added to your total income

Long-Term Capital Gains — Holding period > 36 months:
• Tax rate: 20% with indexation benefit
• Indexation adjusts the purchase price for inflation, reducing taxable gains
• In high inflation periods, indexation can significantly reduce tax

Hybrid Funds:
• Aggressive Hybrid Funds (65–80% equity) — Taxed like equity funds
• Conservative Hybrid Funds (10–40% equity) — Taxed like debt funds

ELSS Funds:
• 3-year lock-in period
• Taxed like equity funds after lock-in
• STCG: If redeemed within 12 months of lock-in expiry (locks-in counts, but holding period matters)
• LTCG: If held for more than 12 months (including lock-in period)

Dividend Distribution:
• Dividends from mutual funds are added to your income and taxed as per your slab
• The Dividend Distribution Tax (DDT) was abolished in 2020
• Companies deduct TDS at 10% on dividends exceeding ₹5,000

Tax-Saving Strategies:
1. Hold equity funds for more than 12 months to qualify for LTCG treatment
2. Use the ₹1 lakh LTCG exemption each year by booking profits and reinvesting (tax harvesting)
3. Hold debt funds for more than 3 years to benefit from indexation
4. Invest in ELSS for Section 80C deduction (up to ₹1.5 lakh)
5. Consider your tax slab when choosing between growth and dividend options

Tax Harvesting Strategy:
• If your equity LTCG is close to ₹1 lakh, sell and repurchase the same fund
• This resets your cost basis without paying tax (since gains up to ₹1 lakh are exempt)
• You can do this annually to maximize tax efficiency

Always consult a tax professional for your specific situation, as individual tax liabilities vary based on your total income and applicable tax slab.`,
    duration: '20 min',
    completed: false,
  },

  // ─── Course 5: Options Trading Strategies (8 lessons) ───
  {
    id: 'l31',
    courseId: 'c5',
    title: 'Options Basics',
    content: `Options are derivative instruments that give you the right, but not the obligation, to buy or sell an underlying asset at a predetermined price (strike price) on or before a specific date (expiry).

Two Types of Options:

Call Option — Gives the buyer the right but not the obligation to BUY the underlying asset at the strike price.
• You buy a call when you expect the price to rise (bullish)
• Maximum loss = Premium paid
• Maximum profit = Unlimited (theoretically)

Put Option — Gives the buyer the right but not the obligation to SELL the underlying asset at the strike price.
• You buy a put when you expect the price to fall (bearish)
• Maximum loss = Premium paid
• Maximum profit = Strike price — Premium (if price goes to zero)

Key Terminology:

Strike Price — The predetermined price at which the option can be exercised.

Premium — The price paid to buy the option. This is the maximum loss for the buyer.

Expiry Date — The last date on which the option can be exercised. In India, weekly expiries (Thursdays) and monthly expiries (last Thursday of the month).

Option Classes:
• European Options — Can only be exercised at expiry
• American Options — Can be exercised any time before expiry
• In India, most index options are European-style, stock options are American-style

Moneyness of Options:
• In the Money (ITM) — Call: Spot > Strike | Put: Spot < Strike
• At the Money (ATM) — Spot ≈ Strike (nearest strike)
• Out of the Money (OTM) — Call: Spot < Strike | Put: Spot > Strike

Intrinsic Value vs Time Value:
• Option Premium = Intrinsic Value + Time Value
• Intrinsic Value — The amount the option is ITM (Max(Spot — Strike, 0) for calls)
• Time Value — The remaining premium above intrinsic value. Decays as expiry approaches.

Why Trade Options?
1. Leverage — Control a large position with a small premium
2. Defined Risk — Maximum loss is limited to premium paid (for buyers)
3. Flexibility — Profit from rising, falling, or sideways markets
4. Hedging — Protect your portfolio from downside risk

Options vs Futures:
• Options: Right but not obligation → Limited risk for buyers
• Futures: Obligation to buy/sell → Unlimited risk both sides
• Options: Pay premium upfront
• Futures: Pay margin (blocked amount)

Important: Options selling (writing) carries significant risk. As a seller, your liability can be unlimited. Beginners should start by buying options, not selling them.`,
    duration: '30 min',
    completed: false,
    quiz: {
      id: 'q13',
      title: 'Options Basics Quiz',
      score: 0,
      passed: false,
      questions: [
        { id: 'q13_1', question: 'What is the maximum loss for a call option buyer?', options: ['Unlimited', 'The premium paid', 'The strike price', 'The underlying asset value'], correctAnswer: 1, explanation: 'The maximum loss for an option buyer is limited to the premium paid. This is one of the key advantages of buying options over futures.' },
        { id: 'q13_2', question: 'When is a call option "In the Money"?', options: ['When spot price is below strike price', 'When spot price is above strike price', 'When spot price equals strike price', 'When time value is zero'], correctAnswer: 1, explanation: 'A call option is In the Money (ITM) when the spot price is above the strike price, meaning the option has intrinsic value.' },
        { id: 'q13_3', question: 'What does ATM stand for in options trading?', options: ['Automated Teller Machine', 'At The Money', 'All Time Market', 'Above The Market'], correctAnswer: 1, explanation: 'ATM (At The Money) means the strike price is approximately equal to the current spot price of the underlying asset.' },
      ],
    },
  },
  {
    id: 'l32',
    courseId: 'c5',
    title: 'Options Pricing & Greeks',
    content: `Options pricing is complex but understanding the fundamentals helps you make better trading decisions. The Black-Scholes model is the standard pricing model.

The Option Premium consists of two components:

1. Intrinsic Value — The real, quantifiable value of the option if exercised immediately.
   • Call Intrinsic Value = Max(0, Spot — Strike)
   • Put Intrinsic Value = Max(0, Strike — Spot)
   • Only ITM options have intrinsic value

2. Time Value — The extra premium you pay for the possibility that the option will move further ITM before expiry.
   • OTM options have only time value
   • ATM options have the highest time value
   • Time value decays as expiry approaches (Theta decay)

Factors Affecting Option Premium:
• Underlying Price — As price increases, calls become more valuable, puts become less valuable
• Strike Price — Higher strikes make calls cheaper and puts more expensive
• Time to Expiry — More time = more expensive (all else equal)
• Volatility — Higher volatility = more expensive options
• Interest Rates — Minor impact, higher rates slightly increase call prices
• Dividends — Expected dividends slightly decrease call prices and increase put prices

The Greeks — Measures of option sensitivity to various factors:

Delta (Δ) — Rate of change of option price relative to underlying price change.
• Call Delta: 0 to 1 (ITM ≈ 0.8–1.0, ATM ≈ 0.5, OTM ≈ 0–0.3)
• Put Delta: -1 to 0 (ITM ≈ -0.8 to -1.0, ATM ≈ -0.5, OTM ≈ 0 to -0.3)
• Delta approximates the probability the option will expire ITM
• Example: Delta of 0.6 means the option price moves ₹0.60 for every ₹1 movement in the underlying

Gamma (Γ) — Rate of change of Delta relative to underlying price change.
• Highest for ATM options near expiry
• High gamma means Delta can change rapidly
• Long gamma (buying options) is profitable when markets move sharply

Theta (Θ) — Time decay — how much value the option loses each day.
• Always negative for option buyers (you lose money every day)
• Highest for ATM options as expiry approaches
• Selling options profits from theta decay (time is on your side)

Vega (ν) — Sensitivity to implied volatility changes.
• Higher for longer-dated options
• Higher when options are ATM
• A vega of 0.10 means the option price changes by ₹0.10 for every 1% change in volatility

Rho (ρ) — Sensitivity to interest rate changes. Least important of the Greeks for short-term trading.

Implied Volatility (IV) — The market's expectation of future volatility, derived from option prices.
• High IV = Expensive options (fear in the market)
• Low IV = Cheap options (complacency)
• IV tends to rise during market crashes and fall during calm periods
• IV is mean-reverting — periods of high IV tend to be followed by lower IV

Understanding the Greeks helps you:
• Choose the right option strategy for your market view
• Manage risk by knowing how your position reacts to different market conditions
• Avoid unpleasant surprises from volatility or time decay`,
    duration: '35 min',
    completed: false,
  },
  {
    id: 'l33',
    courseId: 'c5',
    title: 'Covered Call Strategy',
    content: `The covered call is one of the most popular options strategies, especially for income-focused investors who already own the underlying stock.

How It Works:
1. Own (or buy) 100 shares of a stock
2. Sell (write) a call option on that stock
3. Collect the premium upfront

This is a bullish-to-neutral strategy. You profit from collecting premium while holding the stock, but cap your upside if the stock rallies above the strike price.

When to Use:
• You own a stock and expect it to move sideways or slightly higher
• You want to generate additional income from your portfolio
• You are willing to sell your shares at a specific price (strike)

Example:
• Buy RELIANCE at ₹2,800 (or already own it)
• Sell a Call option with strike ₹2,900, expiring in 30 days, for ₹45 premium
• Net premium income: ₹45 × 100 = ₹4,500

Possible Outcomes:
1. Stock stays below ₹2,900 at expiry:
   • The option expires worthless, you keep the entire ₹4,500 premium
   • You still own the stock and can sell another call

2. Stock rises to ₹3,000 at expiry:
   • Your shares are "called away" at ₹2,900
   • You profit: (₹2,900 — ₹2,800) × 100 + ₹4,500 premium = ₹14,500
   • But you miss the additional gain from ₹2,900 to ₹3,000

3. Stock falls to ₹2,600 at expiry:
   • Option expires worthless, you keep ₹4,500 premium
   • But your stock has lost ₹20,000 (ignoring premium)
   • Net loss: ₹20,000 — ₹4,500 = ₹15,500

Risk Management:
• If the stock falls significantly, the small premium from the covered call does not compensate for the loss
• If the stock rallies above the strike, your upside is capped
• You can avoid assignment by buying back the call before expiry if it is ITM

Variations:
• Out-of-the-Money Covered Call — Strike above current price. Less premium but room for stock appreciation.
• In-the-Money Covered Call — Strike below current price. More premium but more likely to be assigned.
• Weekly Covered Call — Sell calls with 1-week expiry. More frequent income, lower premium per trade.

Covered call is considered a conservative strategy, but it does not eliminate downside risk. You still bear the full downside of the stock while capping your upside.`,
    duration: '25 min',
    completed: false,
  },
  {
    id: 'l34',
    courseId: 'c5',
    title: 'Protective Put Strategy',
    content: `A protective put is like buying insurance for your stock portfolio. You buy a put option on a stock you already own to protect against a decline in price.

How It Works:
1. You own shares of a stock
2. Buy a put option on that stock (at-the-money or out-of-the-money)
3. The put gives you the right to sell your shares at the strike price, regardless of how far the stock falls

This is a bearish hedge on a bullish position. It is primarily a risk management strategy, not a profit-making strategy.

When to Use:
• You have unrealized gains in a stock and want to protect them
• You are bullish long-term but concerned about short-term volatility
• You cannot sell the stock (tax reasons, lock-up period, or conviction in long-term value)
• Before earnings announcements or other binary events

Example:
• You own 100 shares of TCS bought at ₹3,800 (current price ₹3,900)
• Buy a Put option with strike ₹3,850, expiring in 30 days, for ₹30 premium
• Cost of protection: ₹30 × 100 = ₹3,000

Possible Outcomes:
1. Stock stays above ₹3,850 at expiry:
   • The put expires worthless
   • Cost: ₹3,000 (insurance premium)
   • Your stock position retains its gains

2. Stock falls to ₹3,500 at expiry:
   • Your put allows you to sell at ₹3,850
   • You exercise the put: sell shares at ₹3,850
   • Loss on stock: (₹3,850 — ₹3,900) × 100 = -₹5,000
   • Plus premium paid: -₹3,000
   • Total loss: -₹8,000 (vs -₹40,000 loss without the put)

3. Stock rises to ₹4,200 at expiry:
   • Put expires worthless
   • Stock profit: (₹4,200 — ₹3,900) × 100 = ₹30,000
   • Less premium: -₹3,000
   • Net profit: ₹27,000 (still benefited from the rally)

The Cost of Protection:
• ATM puts cost more (higher premium) but offer full protection below the strike
• OTM puts cost less but offer partial protection (protection only begins below the lower strike)
• Longer-dated puts cost more per contract but cheaper when annualized

Synthetic Long Stock = Buy Stock + Buy ATM Put
• This combination behaves like a long call option
• Maximum loss is limited (put strike × quantity — premium paid)
• Unlimited upside potential

Married Put = Buy Stock + Buy ATM Put (same day)
• This is a protective put initiated at the time of stock purchase
• You know your maximum risk from day one

The protective put is essential for any serious investor who wants to manage downside risk without selling their core holdings.`,
    duration: '25 min',
    completed: false,
  },
  {
    id: 'l35',
    courseId: 'c5',
    title: 'Vertical Spreads',
    content: `Vertical spreads involve buying and selling options of the same type (calls or puts) with different strike prices but the same expiry date. They are called "vertical" because the strikes are stacked vertically on the options chain.

Bull Call Spread — Buy an ATM call + Sell an OTM call (net debit)
• Strategy: Bullish with defined risk and reward
• Max Profit: (Short Strike — Long Strike — Net Premium) × Quantity
• Max Loss: Net premium paid
• Breakeven: Long Strike + Net Premium

Example: Nifty at 23,500
• Buy 23,500 Call @ ₹150
• Sell 23,800 Call @ ₹50
• Net debit: ₹100
• Max profit: (23,800 — 23,500 — 100) = 200 points × 25 = ₹5,000
• Max loss: 100 × 25 = ₹2,500

Bear Put Spread — Buy an ATM put + Sell an OTM put (net debit)
• Strategy: Bearish with defined risk and reward
• Max Profit: (Long Strike — Short Strike — Net Premium) × Quantity
• Max Loss: Net premium paid
• Breakeven: Long Strike — Net Premium

Bull Put Spread — Sell an OTM put + Buy a further OTM put (net credit)
• Strategy: Bullish (expect price to stay above short strike)
• Max Profit: Net credit received
• Max Loss: (Strike Difference — Net Credit) × Quantity
• Breakeven: Short Strike — Net Credit

Bear Call Spread — Sell an OTM call + Buy a further OTM call (net credit)
• Strategy: Bearish (expect price to stay below short strike)
• Max Profit: Net credit received
• Max Loss: (Strike Difference — Net Credit) × Quantity
• Breakeven: Short Strike + Net Credit

Comparison of Spread Types:

Credit Spreads (Sell near-ATM, Buy further OTM):
• You receive premium upfront
• Profit if the market stays within your range
• Probability of profit is higher
• Risk is higher (limited but can be substantial)

Debit Spreads (Buy near-ATM, Sell further OTM):
• You pay premium upfront
• Profit if the market moves in your direction
• Probability of profit is lower
• Risk is lower (limited to premium paid)

Advantages of Vertical Spreads:
• Defined maximum risk — you know your worst case upfront
• Lower margin requirement than naked options
• Cheaper than buying outright calls/puts
• Can be used in any market condition (bullish, bearish, neutral)

Disadvantages:
• Limited profit potential — you cap your upside
• More legs means higher transaction costs
• Can be complex to manage if the underlying moves against you

Vertical spreads are excellent tools for traders who want defined risk and limited capital at risk. They allow directional trading with controlled downside.`,
    duration: '30 min',
    completed: false,
  },
  {
    id: 'l36',
    courseId: 'c5',
    title: 'Iron Condor Strategy',
    content: `The Iron Condor is the quintessential range-bound market strategy. It profits when the underlying asset stays within a defined price range, making it ideal for low-volatility environments.

How It Works — An iron condor consists of four legs, all with the same expiry:
1. Sell an OTM put (lower strike)
2. Buy a further OTM put (lowest strike) — for protection
3. Sell an OTM call (upper strike)
4. Buy a further OTM call (highest strike) — for protection

This creates a "condor" shape on the profit/loss diagram — profitable in the middle range between the two short strikes.

Example: Nifty at 23,500 (assuming 100-point strike intervals):
• Sell 23,400 Put @ ₹30
• Buy 23,300 Put @ ₹15
• Sell 23,600 Call @ ₹35
• Buy 23,700 Call @ ₹15

Net credit received: (30 — 15) + (35 — 15) = ₹35 per unit
For 1 lot (25 units): ₹35 × 25 = ₹875

Profit/Loss Scenarios:
1. Nifty closes between 23,400 and 23,600:
   • All options expire worthless
   • Max profit: ₹875

2. Nifty closes at 23,350:
   • The 23,400 put is ITM by 50 points
   • Profit from put spread: (23,400 — 23,350) — 15 = 35 points loss
   • But you received 35 credit in put spread... let me recalculate:
   
   Put Spread: Sold 23,400P @ 30, Bought 23,300P @ 15. If Nifty at 23,350:
   • Short 23,400P = -50 points (ITM by 50)
   • Long 23,300P = 0 (OTM)
   • Put spread P&L: Received 30 - paid 15 - lost 50 = -35
   • Call spread: Both OTM, keep the 20 credit
   • Total: -35 + 20 = -15 points = -₹375

3. Nifty closes above 23,700 or below 23,300:
   • Maximum loss is reached
   • Max loss per unit: ₹(100 — 35) = ₹65 (width between strikes — credit received)

Adjusting the Iron Condor:
• Range → Wider strikes = Lower premium but wider profit zone
• Range → Narrower strikes = Higher premium but riskier
• Directional bias → Shift the condor higher (bullish) or lower (bearish)
• Management → If Nifty approaches one wing, you can roll that wing further out

When NOT to Trade an Iron Condor:
• High volatility environment — large moves can hit your wings
• Trending markets — a directional trend will quickly take you out of range
• Before major events — budget, RBI policy, US Fed decisions
• Earnings season for stock options

Comparing with Other Range-Bound Strategies:
• Short Straddle: Higher premium but unlimited risk
• Short Strangle: Lower premium but unlimited risk
• Iron Condor: Lower premium but limited risk (best for risk-averse range-bound traders)

The iron condor is a professional strategy that offers a high probability of profit with defined risk. It requires patience and active management near resistance levels.`,
    duration: '30 min',
    completed: false,
  },
  {
    id: 'l37',
    courseId: 'c5',
    title: 'Straddle & Strangle Strategies',
    content: `Straddles and strangles are volatility strategies that profit from large price movements regardless of direction. They are the go-to strategies for earnings announcements, budget days, and RBI policy events.

Long Straddle — Buy an ATM Call + Buy an ATM Put (same strike, same expiry)
• Strategy: Expect a large move in either direction
• Max Profit: Unlimited (on the call side if price rises)
• Max Loss: Total premium paid
• Breakeven (Upside): Strike + Total Premium
• Breakeven (Downside): Strike — Total Premium

Example: Stock at ₹1,000
• Buy 1,000 Call @ ₹30
• Buy 1,000 Put @ ₹25
• Total debit: ₹55
• Breakeven upside: ₹1,055
• Breakeven downside: ₹945
• Max loss: ₹55 × 100 = ₹5,500 (if stock stays at ₹1,000 at expiry)

For this trade to be profitable, the stock needs to move more than 5.5% in either direction. The bigger the expected move, the more attractive the straddle.

Long Strangle — Buy an OTM Call + Buy an OTM Put (different strikes)
• Strategy: Expect a large move in either direction (cheaper than straddle)
• Max Profit: Unlimited (on the call side)
• Max Loss: Total premium paid
• Wider breakeven points compared to straddle
• Lower premium cost compared to straddle

Example: Stock at ₹1,000
• Buy 1,050 Call @ ₹15 (OTM)
• Buy 950 Put @ ₹12 (OTM)
• Total debit: ₹27
• Breakeven upside: ₹1,077
• Breakeven downside: ₹923

When to Use Straddles/Strangles:
• Earnings announcements (expecting a gap move)
• Major economic data releases (Fed/RBI decisions, GDP data)
• Binary events (election results, budget announcements)
• When implied volatility is low (options are cheap)

Comparing Straddle vs Strangle:

Long Straddle:
• More expensive (ATM options have highest time value)
• Narrower breakeven range
• Higher delta sensitivity

Long Strangle:
• Cheaper (OTM options cost less)
• Wider breakeven range
• Needs a larger move to profit

Short Straddle/Strangle (for advanced traders only):
• Sell both a call and a put
• Profit from time decay when the market stays within range
• Risk: Unlimited on both sides
• NOT recommended for beginners

Important Risks:
• Time decay works against you — options lose value every day
• You need the move to happen before expiry
• If implied volatility is already high, you may overpay
• Volatility crush after the event can kill your profits even if the market moves

Straddles and strangles are powerful tools for event-driven trading, but they require careful timing and volatility analysis. Never enter a volatility strategy without understanding the implied volatility levels.`,
    duration: '30 min',
    completed: false,
  },
  {
    id: 'l38',
    courseId: 'c5',
    title: 'Options Trading Risk Management',
    content: `Options trading can be highly leveraged, which means it can amplify both gains and losses. Professional options traders prioritize risk management above all else.

The First Rule: Never Risk More Than You Can Afford to Lose
• Options trading involves significant financial risk
• Only use capital that is allocated specifically for speculation
• Never use margin to trade options as a beginner — one bad trade can wipe out your account

Position Sizing for Options:

1. Fixed Percentage Method — Risk no more than 1–2% of your total capital on any single trade.
   • If you have ₹1,00,000 capital: Max risk per trade = ₹1,000–₹2,000
   • This ensures no single loss is catastrophic

2. Kelly Criterion — A mathematical formula for position sizing:
   • f* = (bp — q) / b where:
   • b = Net odds received on the trade (win amount / loss amount)
   • p = Probability of winning
   • q = Probability of losing (1 — p)
   • Most traders use 25–50% of the Kelly formula to be conservative

Common Options Trading Mistakes:

1. Buying Deep OTM Options — Low premium but extremely low probability of profit. These are lottery tickets, not trades.

2. Holding Losing Positions Too Long — Options have time decay. A losing position rarely recovers in options trading unlike stocks.

3. Over-leverage — Using too much margin can lead to forced liquidation at the worst time.

4. Ignoring Implied Volatility (IV) — Buying options when IV is extremely high means you are overpaying. Check IV percentile before entering.

5. Not Managing Winners — Letting a profitable option expire can result in losing all profits if the price reverses. Book profits when your thesis is confirmed.

6. Trading Illiquid Options — Wide bid-ask spreads cost you money. Focus on near-month, near-ATM options with high volume.

The 60/40 Rule for Buying Options:
• 60% of your option's value is determined by time to expiry
• 40% is determined by the underlying price movement
• Never buy options with less than 7 days to expiry (theta decay accelerates)
• The sweet spot for buying options: 3–8 weeks to expiry

The 15-minute Rule for Earnings Trades:
• Do not enter an earnings straddle/strangle more than 15 minutes before the result
• IV tends to be priced in during the final hours
• Better to miss the trade than overpay for premium

Max Pain Theory:
• The strike price where most option buyers will lose money at expiry
• Market often gravitates toward the max pain level on expiry day
• Useful for managing short options positions

Checklist Before Every Trade:
☐ What is my max loss on this trade?
☐ What is my target profit?
☐ What is my stop loss (price or time)?
☐ Am I comfortable with the probability of profit?
☐ Have I checked the IV percentile?
☐ Is the option liquid enough?

Options trading is a zero-sum game (actually negative-sum due to brokerage and taxes). Before trading options with real money, practice on a simulator for at least 3 months.`,
    duration: '30 min',
    completed: false,
  },

  // ─── Course 6: Risk Management & Trading Psychology (6 lessons) ───
  {
    id: 'l39',
    courseId: 'c6',
    title: 'Position Sizing',
    content: `Position sizing is the single most important factor in long-term trading success. It is not about what you buy — it is about how much you buy.

Why Position Sizing Matters:
• Even the best trading strategy will have losing streaks
• Proper position sizing ensures you survive those losing streaks
• The goal is to maximize returns while managing drawdown

The Fixed Percentage Rule — The most common and effective position sizing method:
• Risk no more than 1% of your capital on any single trade
• If your stop loss is hit, you lose only 1% of your capital
• Example: Capital = ₹5,00,000, Max risk per trade = ₹5,000

Calculating Position Size:
Position Size = (Account × Risk %) / (Entry Price — Stop Loss)

Example:
• Capital: ₹5,00,000
• Risk per trade: 1% (₹5,000)
• Stock: RELIANCE at ₹2,800
• Stop loss: ₹2,720 (80 points risk)
• Position size = ₹5,000 / 80 = 62 shares (round down to 60 shares)

Advanced Position Sizing Methods:

1. Kelly Criterion — Based on your historical win rate and average win/loss ratio:
   • f* = (Win Rate × Avg Win) — ((1 — Win Rate) × Avg Loss) / (Avg Win)
   • Example: If win rate = 55%, avg win = ₹1,000, avg loss = ₹800
   • f* = (0.55 × 1000 — 0.45 × 800) / 1000 = 19%
   • Most traders use 25% of Kelly: 19% × 25% ≈ 5% of capital per trade
   • Higher risk than fixed percentage but mathematically optimal

2. Volatility-Based Sizing (ATR Method):
   • Adjust position size based on the stock's volatility
   • More volatile stocks get smaller positions
   • Position Size = (Account × Risk %) / (ATR × ATR Multiplier)
   • ATR Multiplier = 2–3 (stop loss at 2–3× ATR)

3. Equal Risk Method:
   • Allocate capital so every position has equal risk
   • A stock with an 80-point stop gets the same risk as one with a 50-point stop
   • Position sizes adjust automatically based on volatility

The Critical Rule: Never Increase Position Size After a Loss (Martingale)
• Some traders double down after losses to "recoup" — this is a sure path to blowing up
• After a loss, stick to your standard position size or reduce it
• After a win streak, consider reducing position size (you are due for a loss)

Optimal f — Empirical testing by Ralph Vince:
• Determine the "optimal f" percentage that maximizes geometric growth
• This can be done through backtesting
• Warning: Using optimal f directly can result in 80–90% drawdowns
• Most traders use 50% of optimal f for safety

The most important rule of position sizing: Consistency. Use the same method every time, on every trade. Consistency eliminates emotion from the sizing decision.`,
    duration: '25 min',
    completed: false,
    quiz: {
      id: 'q14',
      title: 'Position Sizing Quiz',
      score: 0,
      passed: false,
      questions: [
        { id: 'q14_1', question: 'What is the standard recommended risk per trade as a percentage of capital?', options: ['5–10%', '1–2%', '15–20%', '25–30%'], correctAnswer: 1, explanation: 'Most professional traders recommend risking no more than 1–2% of your total capital on any single trade to survive losing streaks.' },
        { id: 'q14_2', question: 'How do you calculate position size?', options: ['Account balance + stop loss distance', '(Account × Risk %) / (Entry — Stop Loss)', 'Total capital / number of positions', 'Average true range × 100'], correctAnswer: 1, explanation: 'Position size = (Account × Risk %) / (Entry Price — Stop Loss Price). This ensures that if your stop loss is hit, you lose exactly your predetermined risk amount.' },
      ],
    },
  },
  {
    id: 'l40',
    courseId: 'c6',
    title: 'Stop Loss Strategies',
    content: `A stop loss is your most important risk management tool. It is a pre-determined price at which you exit a losing trade to prevent further losses.

Why Traders Don't Use Stop Losses:
• Hope — "It will come back" (sometimes it doesn't)
• Ego — Refusing to admit the trade was wrong
• Fear — Afraid of being stopped out just before the turn
• Overconfidence — "I know this trade will work"

These emotional reactions are exactly why you must use stop losses. Remove emotion from the exit decision.

Types of Stop Losses:

1. Technical Stop Loss — Based on chart levels:
   • Below the recent swing low (for long trades)
   • Above the recent swing high (for short trades)
   • Below support / above resistance levels
   • Below an important moving average (50-day, 100-day, 200-day)

2. Volatility-Based Stop Loss — Based on Average True Range (ATR):
   • Stop at 2–3× ATR below entry
   • Accounts for the stock's natural volatility
   • Wider stops for volatile stocks, tighter stops for stable stocks

3. Fixed Percentage Stop Loss — Based on a fixed percentage of entry price:
   • Common: 5–8% below entry for equities
   • Common: 1–3% for intraday
   • Simple and easy to calculate
   • Does not account for market context

4. Time Stop Loss — Exit if the trade hasn't worked within a set time:
   • If the thesis hasn't played out in 5 days, exit
   • Prevents "dead money" and capital being tied up
   • Especially important for options (time decay)

5. Trailing Stop Loss — Moves up as the price rises:
   • Lock in profits as the trade moves in your favor
   • Fixed trail: Set stop at ₹X below the highest price since entry
   • Percentage trail: Set stop at X% below the highest price
   • ATR trail: Set stop at 3× ATR below the highest price

Where NOT to Place Stop Losses:
• Too tight (right at a support level) — Likely to be hit by market noise
• At round numbers — Everyone has stops there, market makers may hunt them
• Below a major support (long trade) — Set it just below, not at the exact level

The 1% Rule Revisited:
• If your stop loss is 5 points and your risk is 1% of capital, your position size is determined
• If your stop loss is 10 points and your risk is 1%, your position is halved
• The stop loss distance directly determines your position size

Stop Loss Psychology:
• A hit stop loss is NOT a failed trade — it is a successful risk management action
• The goal is to have small losses and big wins
• A 30% win rate can be profitable if your winners are 3× your losers
• Review your stop loss placement after each trade to improve

The Golden Rule: Every trade must have a stop loss before entry. You decide your exit before you enter. This rule is non-negotiable for professional traders.`,
    duration: '25 min',
    completed: false,
  },
  {
    id: 'l41',
    courseId: 'c6',
    title: 'Risk-Reward Ratio',
    content: `The risk-reward ratio (R:R) is the comparison of potential profit to potential loss on a trade. It is one of the most important metrics for evaluating trade quality.

What is Risk-Reward Ratio?
• R:R = Potential Loss / Potential Profit
• A 1:3 risk-reward means you risk ₹1 to make ₹3
• Lower R:R numbers are better (1:2, 1:3, 1:5)

Example:
• Entry: ₹1,000
• Stop Loss: ₹950 (risk = ₹50)
• Target: ₹1,100 (reward = ₹100)
• R:R = 50/100 = 1:2 (risk 1 to make 2)

Why Risk-Reward Matters:

Even with a low win rate, a good R:R can make you profitable:
• 30% win rate with 1:3 R:R = Profitable
• Win: +3 units, Loss: -1 unit
• After 10 trades: 3 wins (9 units) — 7 losses (7 units) = +2 units

Even with a high win rate, a poor R:R can lose money:
• 80% win rate with 3:1 R:R = Losing
• Win: +1 unit, Loss: -3 units
• After 10 trades: 8 wins (8 units) — 2 losses (6 units) = +2 units... wait let me recalculate:
• R:R 3:1 means risk 3 to make 1
• 80% win rate: 8 wins × 1 = 8, 2 losses × 3 = 6 → Net = +2 units

Actually that's breakeven-ish. Let me use a clearer example:
• 60% win rate with 1:1 R:R = Net 0 after 10 trades (6×1 - 4×1 = 2)
• 60% win rate with 1:2 R:R = Net +8 after 10 trades (6×2 - 4×1 = 8)
• 40% win rate with 1:3 R:R = Net +2 after 10 trades (4×3 - 6×1 = 6)

How to Set Targets:
1. Support/Resistance Levels — Take profit at the next major level
2. Fibonacci Extensions — 127.2%, 161.8% extensions of the last move
3. Fixed Multiple — 2× or 3× the risk amount
4. Volatility-Based — 2–3× ATR from entry
5. Trailing Target — Move the target higher as the trade moves in your favor

Minimum Risk-Reward Thresholds:
• Day Trading: 1:1.5 minimum
• Swing Trading: 1:2 minimum
• Position Trading: 1:3 minimum
• Options Buying: 1:3 minimum (due to time decay)

The 2:1 Rule for Position Sizing:
• If your R:R is better than 1:2, you can risk slightly more
• If your R:R is worse than 1:2, reduce your risk
• Adjust position size based on trade quality

Expected Value (EV) — The key metric for evaluating your trading system:
• EV = (Win Rate × Average Win) — (Loss Rate × Average Loss)
• If EV is positive, your system is profitable over many trades
• Focus on EV, not individual trade outcomes

Common R:R Mistakes:
• Setting unrealistic targets (like 1:10) — You will rarely hit them
• Moving targets closer when the trade is in profit (taking small wins)
• Not accounting for slippage and brokerage in your R:R calculation
• Being too rigid — sometimes the market only gives you a 1:1.5 move, which may still be worth taking

The Bottom Line: Always know your risk and reward BEFORE entering a trade. If the R:R is not favorable, skip the trade. Discipline in this area separates profitable traders from everyone else.`,
    duration: '20 min',
    completed: false,
  },
  {
    id: 'l42',
    courseId: 'c6',
    title: 'Trading Psychology',
    content: `Trading psychology is the study of how emotions and cognitive biases affect trading decisions. Most traders fail not because of bad strategies, but because of poor psychology.

The Trading Emotional Cycle:
1. Excitement — Entry feels good, anticipation of profits
2. Euphoria — Trade moves in your favor, you feel invincible
3. Anxiety — Trade moves against you, worry sets in
4. Denial — "It will come back," you refuse to accept the loss
5. Fear — Losses mount, panic sets in
6. Capitulation — You exit at the worst possible time
7. Despair — Regret, loss of confidence
8. Hope — You look for the next trade to recover losses

Breaking this cycle is the key to consistent profitability.

Common Cognitive Biases in Trading:

1. Confirmation Bias — Seeking information that confirms your trade idea while ignoring contradictory evidence.
   • Solution: Always ask "What would make this trade wrong?" before entering

2. Anchoring — Fixating on a specific price (like the entry price or a past high).
   • Solution: Let go of attachment to specific prices — what matters is the current setup

3. Loss Aversion — Feeling losses more intensely than equivalent gains (2× more painful).
   • Solution: Use a predefined stop loss and position sizing to remove emotion

4. Recency Bias — Giving more weight to recent events than historical patterns.
   • Solution: Keep a trading journal and review long-term statistics

5. Overconfidence — Believing your winning streak is due to skill when luck played a role.
   • Solution: Review your journal honestly — separate skill-based wins from luck

6. FOMO (Fear of Missing Out) — Chasing trades after they have already moved significantly.
   • Solution: Accept that there will always be other opportunities. Missing a trade is better than chasing one.

7. Revenge Trading — Trying to recover losses immediately by taking impulsive trades.
   • Solution: After a loss, take a break. Walk away from the screen for at least 30 minutes.

Building a Trading Psychology Routine:

Before Trading:
• Check your physical state — Are you tired, stressed, hungry?
• Review your trading plan — What are you looking for today?
• Set your risk limits — How much are you willing to lose today?
• Meditate or breathe deeply for 2 minutes

During Trading:
• Stick to your plan — No impulsive trades
• Take breaks between trades — Step away from the screen
• Size down if you are on a losing streak (reduce risk by 50%)
• If you feel emotional, close the platform and walk away

After Trading:
• Journal every trade — What did you do? Why? How did you feel?
• Review your entries and exits — What could you improve?
• Separate process from outcome — A good decision can have a bad outcome
• Celebrate good process, not just profitable trades

The Importance of Process Over Outcome:
• A well-executed trade that hits its stop loss is still a good trade
• A poorly planned trade that coincidentally becomes profitable is a bad trade
• Focus on executing your plan consistently, and the P&L will take care of itself

The trading room mirror: If you look at your P&L and your emotional state is directly correlated, you have a psychological problem that needs addressing.`,
    duration: '25 min',
    completed: false,
    quiz: {
      id: 'q15',
      title: 'Trading Psychology Quiz',
      score: 0,
      passed: false,
      questions: [
        { id: 'q15_1', question: 'What is loss aversion in trading?', options: ['Not wanting to trade when volatile', 'Feeling losses more intensely than equivalent gains', 'Avoiding high-risk stocks', 'Preferring long-term over short-term trading'], correctAnswer: 1, explanation: 'Loss aversion is the tendency to feel the pain of losses about twice as intensely as the pleasure of equivalent gains. This bias can cause traders to hold losing positions too long.' },
        { id: 'q15_2', question: 'What should you do after a significant losing trade?', options: ['Double down to recover quickly', 'Take a break and step away from trading', 'Ignore it and keep trading', 'Change your entire strategy immediately'], correctAnswer: 1, explanation: 'After a significant loss, take a break to reset your emotional state. Trading while emotional often leads to revenge trading and further losses.' },
      ],
    },
  },
  {
    id: 'l43',
    courseId: 'c6',
    title: 'Building a Trading Journal',
    content: `A trading journal is the single most effective tool for improving your trading performance. It transforms subjective feelings into objective data for analysis.

Why Keep a Trading Journal:
• Identifies patterns in your winning and losing trades
• Reveals emotional states that lead to bad decisions
• Provides data for position sizing (win rate, average win/loss)
• Forces you to be accountable for every trade
• Tracks your progress over time

What to Record for Every Trade:

Pre-Trade (Entry):
• Date and time
• Instrument (stock, index, etc.)
• Direction (long/short)
• Entry price
• Position size
• Stop loss level
• Target level
• Setup type (breakout, pullback, reversal, etc.)
• Reason for entry (specific criteria met)
• Chart time frame

During Trade:
• Did you move your stop loss?
• Did you trail your target?
• Emotional state (calm, anxious, excited)
• Did you follow your plan?

Post-Trade (Exit):
• Exit price
• Exit date and time
• Reason for exit (stop loss hit, target reached, manual exit)
• P&L (absolute and percentage)
• Holding period
• Emotional state at exit

Post-Trade Analysis:
• Did you follow your trading plan? (Yes/No/Partial)
• What would you do differently?
• Rating (1–5): How well did you execute this trade?
• Lessons learned

Key Metrics to Track:

Performance Metrics:
• Total trades: ___
• Win rate: ___%
• Average win: ₹___
• Average loss: ₹___
• Profit factor: ___ (gross profit / gross loss)
• Max consecutive wins: ___
• Max consecutive losses: ___
• Max drawdown: ___%
• Sharpe ratio: ___

Process Metrics (More Important Than P&L):
• Plan compliance rate: ___%
• Trades with predefined stop loss: ___%
• Trades exited at the right time: ___%
• Impulsive trades (no setup): ___%

Weekly Review Checklist:
☐ Review all trades from the week
☐ Calculate key metrics
☐ Identify what worked and what didn't
☐ Note any psychological patterns
☐ Adjust your trading plan if needed
☐ Set goals for next week

Sample Journal Template (Digital or Physical):

| Date | Stock | Direction | Entry | Exit | P&L | Setup | Followed Plan? | Emotion | Lessons |
|------|-------|-----------|-------|------|-----|-------|----------------|---------|---------|
| 01-Jun | RELIANCE | Long | 2800 | 2850 | +5000 | Breakout | Yes | Calm | Good risk management |
| 02-Jun | TCS | Long | 3900 | 3850 | -5000 | Pullback | No (held too long) | Anxious | Trust stop loss |

Tools for Journaling:
• Excel/Google Sheets — Simple and customizable
• Notion — Good for combining data with notes
• Trading-specific apps — Edgewonk, Tradervue
• Physical notebook — Some traders prefer the tactile experience

The 80/20 Rule: 80% of your journal value comes from reviewing, not recording. Set aside 15 minutes each day to review your trades.

If you are not journaling, you are not serious about improving as a trader. Full stop.`,
    duration: '20 min',
    completed: false,
  },
  {
    id: 'l44',
    courseId: 'c6',
    title: 'Building a Complete Risk Management Framework',
    content: `A comprehensive risk management framework goes beyond individual trade stops — it covers portfolio-level risk, drawdown management, and psychological safeguards.

The Three Layers of Risk Management:

Layer 1: Trade-Level Risk — Managing individual positions
• Every trade has a predefined stop loss (technical, volatility, or percentage-based)
• Position size is calculated based on risk (1% of capital per trade)
• Risk-reward ratio is at least 1:2 before entry
• Maximum exposure per single position: 10% of portfolio

Layer 2: Portfolio-Level Risk — Managing overall portfolio exposure
• Maximum total portfolio at risk (sum of all trade risks): 3–5% of total capital
• Maximum sector exposure: 20% of portfolio
• Maximum correlated positions: 25% of portfolio
• Maximum daily loss limit: 3% of portfolio (stop trading for the day if hit)
• Maximum weekly loss limit: 6% of portfolio (stop trading for the week if hit)

Layer 3: Lifestyle-Level Risk — Protecting your personal well-being
• Never trade money you cannot afford to lose
• Never trade while under the influence of alcohol or drugs
• Never trade when emotionally distressed
• Take a break after 3 consecutive losses
• Take a week off after 5 consecutive losses or a 10% drawdown

Drawdown Management Plan:

Drawdown 0–5%:
• Continue normal trading but review all recent trades
• Check if strategy is still working in current market conditions

Drawdown 5–10%:
• Reduce position size by 25%
• Increase entry criteria selectivity
• Review your trading journal for patterns

Drawdown 10–15%:
• Reduce position size by 50%
• Trade only your highest-conviction setups
• Consider taking a break to analyze what is going wrong

Drawdown 15–20%:
• Stop trading entirely
• Step away for at least 2 weeks
• Paper trade to rebuild confidence
• Re-enter with 50% reduced size

Drawdown > 20%:
• You have a serious problem — seek mentorship
• Reassess your strategy entirely
• Consider whether trading is right for you

The Risk Management Checklist (Review Daily):

Pre-Market:
☐ What are my max loss limits for today?
☐ Am I physically and mentally ready to trade?
☐ Do I have any open positions that need attention?

During Market:
☐ Am I sticking to my plan?
☐ Have I checked my emotional state?
☐ Are my stop losses in place for all positions?
☐ Have I reached my daily loss limit?

Post-Market:
☐ Did I follow my plan?
☐ What did I learn today?
☐ What will I do differently tomorrow?

The Ultimate Iron Law of Trading:
• The market can remain irrational longer than you can remain solvent
• Never risk money you need for essentials
• Never risk more than you can afford to lose
• Protect your capital first, profits second

A successful trader is not someone who never loses — it is someone who manages losses so well that the wins far outweigh them.`,
    duration: '25 min',
    completed: false,
    quiz: {
      id: 'q16',
      title: 'Risk Management Framework Quiz',
      score: 0,
      passed: false,
      questions: [
        { id: 'q16_1', question: 'What should you do if you reach a 10% drawdown from your peak capital?', options: ['Double down on the next trade to recover', 'Reduce position size by 50% and increase selectivity', 'Stop trading permanently', 'Ignore it and keep trading normally'], correctAnswer: 1, explanation: 'At 10% drawdown, reduce position size by 25%, increase criteria selectivity, and review your journal for patterns.' },
        { id: 'q16_2', question: 'What is the recommended maximum daily loss limit?', options: ['5% of portfolio', '10% of portfolio', '3% of portfolio', '15% of portfolio'], correctAnswer: 2, explanation: 'The recommended maximum daily loss limit is 3% of your portfolio. If hit, stop trading entirely for the day to prevent emotional revenge trading.' },
        { id: 'q16_3', question: 'What is the first layer of the three-layer risk management framework?', options: ['Lifestyle-level risk', 'Portfolio-level risk', 'Trade-level risk', 'Market-level risk'], correctAnswer: 2, explanation: 'The three layers are: 1) Trade-level (individual stops and sizing), 2) Portfolio-level (overall exposure), and 3) Lifestyle-level (personal well-being).' },
      ],
    },
  },
];
