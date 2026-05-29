// =============================================================================
// TOROLOOM Backend — Real Educational Content
// 6 courses, 44 lessons with detailed content and quizzes
// =============================================================================

export const realCourses = [
  {
    id: 'c1',
    title: 'Stock Market Basics',
    description: 'Everything you need to know to start investing in the stock market. From understanding what a stock is to placing your first trade and building a portfolio.',
    thumbnail: '📈',
    duration: '5 hours',
    lessons: 8,
    progress: 75,
    level: 'beginner' as const,
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
    level: 'intermediate' as const,
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
    level: 'intermediate' as const,
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
    level: 'beginner' as const,
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
    level: 'advanced' as const,
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
    level: 'intermediate' as const,
    category: 'Psychology',
    rating: 4.8,
    enrolledCount: 12400,
  },
];

export const realLessons = [
  // ─── Course 1: Stock Market Basics (8 lessons) ───
  {
    id: 'l1', courseId: 'c1',
    title: 'What is the Stock Market?',
    content: 'The stock market is a marketplace where buyers and sellers trade shares of publicly listed companies. When you buy a stock, you are buying a small piece of ownership in that company. This ownership entitles you to a portion of the company\'s assets and profits.\n\nThe concept of stock markets dates back to the 1600s when the Dutch East India Company issued shares to fund voyages. Today, stock markets exist in virtually every country, with the largest being the New York Stock Exchange (NYSE), Nasdaq, and in India, the National Stock Exchange (NSE) and Bombay Stock Exchange (BSE).\n\nWhy do companies list on stock markets? The primary reason is to raise capital for growth and expansion. By selling shares to the public through an Initial Public Offering (IPO), companies can access funds from thousands of investors without taking on debt. For investors, the stock market offers the opportunity to earn returns through capital appreciation (price increase) and dividends (profit sharing).\n\nStock markets serve several crucial functions in the economy: 1) Capital Formation — Companies raise money for expansion, research, and operations. 2) Price Discovery — The market determines fair prices for securities based on supply and demand. 3) Liquidity — Investors can buy and sell shares easily. 4) Risk Distribution — Risk is spread across millions of investors. 5) Economic Indicator — Stock market performance often reflects the overall health of the economy.\n\nIn India, the Securities and Exchange Board of India (SEBI) regulates the stock market to protect investor interests and ensure fair trading practices.',
    duration: '20 min', completed: true,
    quiz: {
      id: 'q1', title: 'Market Basics Quiz', score: 80, passed: true,
      questions: [
        { id: 'q1_1', question: 'What does buying a stock represent?', options: ['A loan to the company', 'Partial ownership in the company', 'A type of insurance', 'A government bond'], correctAnswer: 1, explanation: 'A stock represents a share of ownership in a company. Shareholders are part-owners of the business.' },
        { id: 'q1_2', question: 'Which organization regulates the Indian stock market?', options: ['RBI', 'SEBI', 'IRDAI', 'CCC'], correctAnswer: 1, explanation: 'SEBI (Securities and Exchange Board of India) is the regulatory body for the Indian securities market.' },
        { id: 'q1_3', question: 'What is an IPO?', options: ['Internal Public Offering', 'Initial Public Offering', 'Indian Public Option', 'Investment Portfolio Objective'], correctAnswer: 1, explanation: 'An IPO is when a company first sells its shares to the public to raise capital from investors.' },
        { id: 'q1_4', question: 'Which of these is a major Indian stock exchange?', options: ['NYSE', 'NSE', 'NASDAQ', 'LSE'], correctAnswer: 1, explanation: 'The National Stock Exchange (NSE) is one of India\'s two major stock exchanges, along with the BSE.' },
      ],
    },
  },
  {
    id: 'l2', courseId: 'c1',
    title: 'Key Market Participants',
    content: 'The stock market ecosystem involves various participants, each playing a unique role in ensuring smooth functioning and liquidity.\n\nRetail Investors — Individual investors like you and me who buy and sell shares for personal accounts. Retail investors typically invest smaller amounts and trade through brokerage platforms. In India, the number of retail investors has grown enormously, with over 10 crore Demat accounts as of 2025.\n\nInstitutional Investors — Large organizations that invest significant capital. These include: Foreign Institutional Investors (FIIs) — International investment funds, pension funds, and sovereign wealth funds. Domestic Institutional Investors (DIIs) — Indian mutual funds, insurance companies, and pension funds. Foreign Portfolio Investors (FPIs) — A broader category that includes FIIs and other foreign entities.\n\nMutual Funds — Pooled investment vehicles where professional fund managers invest money collected from thousands of retail investors. When you invest in a mutual fund, you own units that represent a portion of the fund\'s portfolio.\n\nMarket Makers — Entities that provide liquidity by continuously quoting buy and sell prices for securities. They profit from the bid-ask spread and help ensure that trades can be executed quickly.\n\nStock Brokers — SEBI-registered intermediaries who facilitate buying and selling of securities on behalf of investors. Brokers can be full-service (offering research, advice, and services) or discount brokers (offering execution-only at lower costs).\n\nDepositories — Organizations that hold securities in electronic (Demat) form. In India, the two depositories are NSDL and CDSL.\n\nUnderstanding who participates in the market helps you understand what drives price movements. For example, when FIIs are net buyers, markets tend to rally, and when they sell, markets may decline.',
    duration: '20 min', completed: true,
    quiz: {
      id: 'q2', title: 'Market Participants Quiz', score: 100, passed: true,
      questions: [
        { id: 'q2_1', question: 'What does FII stand for?', options: ['Federal Investment Institution', 'Foreign Institutional Investor', 'Financial Investment Index', 'Fixed Income Instrument'], correctAnswer: 1, explanation: 'FII stands for Foreign Institutional Investor — international entities that invest in Indian markets.' },
        { id: 'q2_2', question: 'Which depositories operate in India?', options: ['NSDL and CDSL', 'RBI and SEBI', 'NSE and BSE', 'SBI and HDFC'], correctAnswer: 0, explanation: 'NSDL and CDSL are the two depositories in India that hold securities in electronic (Demat) form.' },
      ],
    },
  },
  {
    id: 'l3', courseId: 'c1',
    title: 'Understanding Stock Exchanges',
    content: 'In India, there are two primary stock exchanges: the National Stock Exchange (NSE) and the Bombay Stock Exchange (BSE). Both exchanges facilitate trading in equities, derivatives, ETFs, and other securities.\n\nNSE (National Stock Exchange) — Established in 1992, NSE is India\'s largest exchange by trading volume. Its benchmark index is the Nifty 50, which tracks the performance of the 50 largest and most liquid Indian companies. NSE was the first exchange in India to provide electronic trading through its platform called NEAT.\n\nBSE (Bombay Stock Exchange) — Asia\'s oldest stock exchange, established in 1875. Its benchmark index is the SENSEX (Sensitive Index), comprising 30 well-established and financially sound companies.\n\nTrading Hours — Indian stock markets operate from 9:15 AM to 3:30 PM, Monday through Friday. The trading day has several phases: Pre-Open Session (9:00–9:15 AM) for order collection and price discovery, Continuous Trading (9:15 AM–3:30 PM) for regular trading, and Closing Session (3:30–3:45 PM) for call auction.\n\nMarket Indices — Indices are statistical measures that track the performance of a group of stocks. Besides Nifty 50 and SENSEX, other important indices include Nifty Bank, Nifty Midcap 100, Nifty Smallcap 100, and India VIX.\n\nCircuit Breakers — Exchanges have mechanisms to halt trading if markets move too sharply. If the Nifty 50 falls by 10%, 15%, or 20%, trading is halted for specific periods.',
    duration: '25 min', completed: true,
    quiz: {
      id: 'q3', title: 'Exchanges & Indices Quiz', score: 75, passed: true,
      questions: [
        { id: 'q3_1', question: 'What are the trading hours for Indian stock markets?', options: ['9:00 AM to 3:00 PM', '9:15 AM to 3:30 PM', '10:00 AM to 4:00 PM', '9:30 AM to 3:30 PM'], correctAnswer: 1, explanation: 'Indian stock markets trade from 9:15 AM to 3:30 PM, Monday through Friday.' },
        { id: 'q3_2', question: 'How many companies are in the Nifty 50 index?', options: ['30', '50', '100', '500'], correctAnswer: 1, explanation: 'The Nifty 50 tracks the performance of 50 large, liquid Indian companies listed on the NSE.' },
      ],
    },
  },
  {
    id: 'l4', courseId: 'c1',
    title: 'How to Read Stock Prices',
    content: 'When you open a trading platform, you see various numbers and terms associated with each stock. Understanding these is essential for making informed decisions.\n\nLast Traded Price (LTP) — The most recent price at which the stock was traded. This is what most people refer to as the "current price."\n\nDay Open — The price at which the stock first trades when the market opens. This may differ from the previous day\'s closing price.\n\nDay High/Low — The highest and lowest prices at which the stock has traded during the current trading session.\n\nPrevious Close — The closing price of the stock from the previous trading day.\n\nChange — The difference between the current price and the previous close. A positive change means the stock is up, and a negative change means it is down.\n\nChange Percent — The change expressed as a percentage of the previous close.\n\nBid & Ask — The bid is the highest price a buyer is willing to pay, and the ask is the lowest price a seller is willing to accept. The difference between them is called the bid-ask spread.\n\nVolume — The number of shares traded during a session. High volume confirms the strength of a price move.\n\nMarket Depth — Also called the order book, this shows all pending buy and sell orders at different price levels. It helps you understand supply and demand at various prices.\n\n52-Week High/Low — The highest and lowest prices at which the stock has traded over the past 52 weeks.\n\nMarket Capitalization — The total value of a company\'s outstanding shares, calculated as Stock Price multiplied by Total Number of Shares.',
    duration: '25 min', completed: true,
  },
  {
    id: 'l5', courseId: 'c1',
    title: 'Order Types Explained',
    content: 'Placing the right type of order is crucial for executing your trading strategy effectively. Different order types serve different purposes and offer different levels of price control.\n\nMarket Order — An order to buy or sell a stock immediately at the best available current price. Market orders guarantee execution but not the price.\n\nLimit Order — An order to buy or sell a stock at a specific price or better. A buy limit order will only execute at the limit price or lower. A sell limit order will only execute at the limit price or higher. Limit orders guarantee price but not execution.\n\nStop-Loss Order (Stop Market) — An order that becomes a market order when the stock reaches a specified price (the stop price). Used to limit losses or protect profits.\n\nStop-Limit Order — A combination of stop and limit orders. When the stop price is reached, a limit order is placed instead of a market order.\n\nGood Till Cancelled (GTC) — An order that remains active until executed or cancelled. Note: Most Indian brokers do not support GTC orders for more than one trading session.\n\nGood For Day (GFD) — The default order type. The order is valid only for the current trading session and expires if not filled by market close.\n\nAfter Market Order (AMO) — Orders placed after trading hours that are queued for execution when the market opens the next day.\n\nIntraday Orders (MIS) — Orders that must be squared off (closed) by the end of the trading day.\n\nDelivery Orders (CNC) — Orders where you pay the full amount and take delivery of shares.\n\nCover Order — A type of stop-loss order where you must specify both the target and stop-loss when placing the order.',
    duration: '25 min', completed: true,
  },
  {
    id: 'l6', courseId: 'c1',
    title: 'Demat & Trading Accounts',
    content: 'To start investing in Indian stock markets, you need two essential accounts — a Demat account and a Trading account.\n\nWhat is a Demat Account? — A Demat (Dematerialized) account holds your shares and securities in electronic form. Before dematerialization, shares were held as physical certificates, which was cumbersome and risky.\n\nWhat is a Trading Account? — A Trading account is linked to your Demat account and is used to place buy and sell orders on stock exchanges.\n\nHow to Open an Account: 1) Choose a SEBI-registered stock broker. 2) Complete the KYC process with PAN card, Aadhaar card, address proof, and bank account details. 3) Sign the account opening forms (now largely digital through e-sign). 4) Complete In-Person Verification (IPV) via video call. 5) Your Demat account is opened with NSDL or CDSL through the broker.\n\nAccount Types: Regular Account, Joint Account, Corporate Account.\n\nCharges: Account Opening Charges (free to few hundred rupees), Annual Maintenance Charges (AMC) of Rs 150 to Rs 750 per year, Brokerage (Rs 0 to Rs 20 per trade for discount brokers), STT of 0.1% of turnover for delivery trades, DP Charges of Rs 15–Rs 25 per transaction, and GST of 18% on brokerage and transaction fees.',
    duration: '20 min', completed: false,
  },
  {
    id: 'l7', courseId: 'c1',
    title: 'Taxation of Stock Market Income',
    content: 'Understanding how your stock market profits are taxed is essential for accurate tax filing and maximizing your post-tax returns.\n\nCapital Gains Tax: Short-Term Capital Gains (STCG) — If you hold listed equity shares for 12 months or less, the profit is treated as STCG and taxed at 15% (plus surcharge and cess). Long-Term Capital Gains (LTCG) — If you hold listed equity shares for more than 12 months, LTCG exceeding Rs 1 lakh in a financial year is taxed at 10% (plus surcharge and cess). Gains up to Rs 1 lakh are tax-free.\n\nSetting off and carrying forward losses: Short-term capital losses can be set off against any capital gains. Long-term capital losses can only be set off against long-term capital gains. Unadjusted losses can be carried forward for up to 8 assessment years.\n\nSecurities Transaction Tax (STT): Delivery trades: 0.1% of turnover. Intraday trades: 0.025% on sell side. Futures: 0.01% on sell side. Options: 0.05% on premium (sell side).\n\nOther Income: Dividends are added to your total income and taxed as per your income tax slab. Companies deduct TDS at 10% on dividends exceeding Rs 5,000.\n\nELSS Tax Saving: Investments up to Rs 1.5 lakh in ELSS mutual funds qualify for tax deduction under Section 80C. Returns are treated as capital gains and taxed accordingly.',
    duration: '20 min', completed: false,
  },
  {
    id: 'l8', courseId: 'c1',
    title: 'Building Your First Portfolio',
    content: 'Building a well-diversified investment portfolio is the foundation of long-term wealth creation.\n\nStep 1: Define Your Financial Goals. What am I investing for? Retirement, house, education, or wealth creation? What is my time horizon? Short-term (< 3 years), Medium-term (3–7 years), or Long-term (> 7 years)? How much risk can I tolerate?\n\nStep 2: Understand Asset Allocation. Asset allocation is dividing your investments among Equities, Debt, Gold, Real Estate, and Cash. A common rule of thumb: Subtract your age from 100 to get the percentage in equities.\n\nStep 3: Diversification Within Equities. Diversify across Sectors (Finance, IT, Pharma, Auto, Energy, Consumer), Market Caps (Large-cap, Mid-cap, Small-cap), and Investment Style (Value, Growth, Dividend).\n\nStep 4: Choose Your Investment Approach. Active Investing — Research and select individual stocks. Passive Investing — Invest in index funds or ETFs. Hybrid Approach — Core portfolio of index funds plus satellite of individual stocks.\n\nStep 5: Start Small and Systematic. Begin with a small amount you are comfortable with. Use SIPs for regular investing. Time in the market beats timing the market. Rebalance your portfolio annually.\n\nStep 6: Monitor and Review. Check your portfolio quarterly, not daily. Review if investments are on track to meet goals. Make adjustments based on life changes, not market noise.',
    duration: '25 min', completed: false,
    quiz: {
      id: 'q4', title: 'Portfolio Building Quiz', score: 0, passed: false,
      questions: [
        { id: 'q4_1', question: 'What is asset allocation?', options: ['Buying assets at low prices', 'Dividing investments among different asset classes', 'Selling all assets at once', 'Investing only in gold'], correctAnswer: 1, explanation: 'Asset allocation is the strategy of dividing your investments among different asset classes (equities, debt, gold, etc.) based on your goals and risk tolerance.' },
        { id: 'q4_2', question: 'What is the recommended emergency fund size?', options: ['1 month of expenses', '3–6 months of expenses', '1 year of expenses', 'No emergency fund needed'], correctAnswer: 1, explanation: 'Financial experts recommend keeping 3–6 months of living expenses in liquid assets as an emergency fund.' },
        { id: 'q4_3', question: 'What does "time in the market beats timing the market" mean?', options: ['You should trade every day', 'Long-term investing is better than trying to predict short-term moves', 'Market timing is the best strategy', 'You should only invest at market close'], correctAnswer: 1, explanation: 'This famous investing adage means that staying invested for the long term typically produces better results than trying to predict short-term market movements.' },
      ],
    },
  },

  // ─── Course 2: Technical Analysis Mastery (8 lessons) ───
  {
    id: 'l9', courseId: 'c2',
    title: 'Introduction to Technical Analysis',
    content: 'Technical analysis is the study of market action through the use of charts and indicators to forecast future price movements. Unlike fundamental analysis which examines a company\'s financial health, technical analysis focuses solely on price, volume, and market psychology.\n\nThe Core Philosophy: 1) Market Discounts Everything — All information is already reflected in the price. 2) Price Moves in Trends — Once a trend is established, it tends to continue. 3) History Tends to Repeat Itself — Market participants react similarly to similar situations.\n\nDow Theory — The foundation of modern technical analysis by Charles Dow: The market has three trends (Primary, Secondary, Minor). Trends have three phases (Accumulation, Public Participation, Distribution). Volume confirms the trend.\n\nTypes of Charts: Line Chart (closing prices), Bar Chart (OHLC), and Candlestick Chart (most popular).\n\nTime Frames: Intraday (for day traders), Short-term hourly/daily (for swing traders), Medium-term weekly (for position traders), and Long-term monthly (for investors).\n\nTechnical analysis works because it studies human psychology. Fear and greed drive markets, creating repetitive patterns that can be identified and traded.',
    duration: '25 min', completed: true,
    quiz: {
      id: 'q5', title: 'Technical Analysis Basics Quiz', score: 100, passed: true,
      questions: [
        { id: 'q5_1', question: 'What is the primary focus of technical analysis?', options: ['Company financial statements', 'Price and volume data', 'Management quality', 'Industry trends'], correctAnswer: 1, explanation: 'Technical analysis focuses on price, volume, and market psychology rather than company fundamentals.' },
        { id: 'q5_2', question: 'Which theory is considered the foundation of modern technical analysis?', options: ['Efficient Market Theory', 'Dow Theory', 'Random Walk Theory', 'Modern Portfolio Theory'], correctAnswer: 1, explanation: 'Dow Theory, developed by Charles Dow, is the foundation of modern technical analysis.' },
      ],
    },
  },
  {
    id: 'l10', courseId: 'c2',
    title: 'Candlestick Patterns',
    content: 'Candlestick charting was developed by Japanese rice traders in the 18th century and popularized in the West by Steve Nison. It is now the most widely used charting method among traders worldwide.\n\nCandlestick Anatomy: Each candlestick represents price action over a specific time period. The Body is the area between open and close. Bullish candles have close above open (green/white). Bearish candles have close below open (red/black). The Upper Wick is the highest price reached, and the Lower Wick is the lowest price reached.\n\nSingle Candlestick Patterns: Doji (open and close nearly equal, indicating indecision), Hammer (small body with long lower wick in downtrend, bullish reversal), Shooting Star (small body with long upper wick in uptrend, bearish reversal), and Marubozu (no wicks, strong signal).\n\nDouble Candlestick Patterns: Bullish Engulfing, Bearish Engulfing, Piercing Pattern, and Dark Cloud Cover.\n\nTriple Candlestick Patterns: Morning Star (bullish reversal), Evening Star (bearish reversal), Three White Soldiers (bullish continuation), and Three Black Crows (bearish continuation).\n\nTrading with candlestick patterns requires confirmation from volume and support/resistance levels.',
    duration: '30 min', completed: true,
    quiz: {
      id: 'q6', title: 'Candlestick Patterns Quiz', score: 80, passed: true,
      questions: [
        { id: 'q6_1', question: 'What does a Doji candlestick indicate?', options: ['Strong buying pressure', 'Market indecision', 'Strong selling pressure', 'Gap up opening'], correctAnswer: 1, explanation: 'A Doji forms when open and close prices are nearly equal, indicating indecision in the market.' },
        { id: 'q6_2', question: 'Which pattern consists of three candles: long bearish, small doji, and long bullish?', options: ['Evening Star', 'Three White Soldiers', 'Morning Star', 'Bullish Engulfing'], correctAnswer: 2, explanation: 'The Morning Star is a bullish reversal pattern consisting of a long bearish candle, a small indecisive candle, and a long bullish candle.' },
      ],
    },
  },
  {
    id: 'l11', courseId: 'c2',
    title: 'Support & Resistance',
    content: 'Support and resistance are fundamental concepts in technical analysis. They represent price levels where the market has historically reacted.\n\nSupport — A price level where buying pressure is strong enough to prevent the price from falling further. Think of it as a floor.\n\nResistance — A price level where selling pressure is strong enough to prevent the price from rising further. Think of it as a ceiling.\n\nHow Support and Resistance Form: Previous Highs and Lows, Round Numbers (psychological levels like Rs 500, Rs 1,000), Moving Averages (50-day, 100-day, 200-day), Trendlines, and Fibonacci Levels.\n\nRole Reversal — One of the most important concepts: When a resistance level is broken to the upside, it often becomes support. When a support level is broken to the downside, it often becomes resistance.\n\nStrength of Levels: The more times a level has been tested, the stronger it becomes. The longer the time frame, the more significant the level. High volume at a level increases its significance.\n\nBreakouts vs. Fakeouts: A true breakout is accompanied by high volume and strong momentum. To avoid fakeouts, wait for a close above/below the level or use a volume filter.',
    duration: '30 min', completed: true,
  },
  {
    id: 'l12', courseId: 'c2',
    title: 'Moving Averages',
    content: 'Moving averages are one of the most versatile and widely used technical indicators. They smooth out price data to help traders identify trends and potential reversal points.\n\nWhat is a Moving Average? It calculates the average price over a specified number of periods. As new data becomes available, the oldest data point is dropped.\n\nTypes: Simple Moving Average (SMA) — Gives equal weight to all data points. Exponential Moving Average (EMA) — Gives more weight to recent prices, making it more responsive.\n\nCommon Periods: 20-day (short-term), 50-day (intermediate), 100-day (medium-term), and 200-day (long-term, bull/bear market line).\n\nUsing Moving Averages: Trend Identification — When price is above the MA, the trend is up. Crossovers — Golden Cross (50-day SMA crosses above 200-day SMA, strong bullish) and Death Cross (50-day crosses below 200-day, strong bearish). Dynamic Support and Resistance — MAs often act as support in uptrends.\n\nMoving Average Ribbons: Using multiple MAs (10, 20, 30, 40, 50, 60) creates a ribbon. Expanding and ordered ribbon confirms strong trend. Contraction signals trend change.\n\nLimitations: Lagging indicator (based on past prices), false signals in sideways markets, no single period works for all markets.',
    duration: '25 min', completed: false,
    quiz: {
      id: 'q7', title: 'Moving Averages Quiz', score: 0, passed: false,
      questions: [
        { id: 'q7_1', question: 'What is the key difference between SMA and EMA?', options: ['SMA is faster than EMA', 'EMA gives more weight to recent prices', 'SMA only uses closing prices', 'EMA is only for daily charts'], correctAnswer: 1, explanation: 'The Exponential Moving Average (EMA) gives more weight to recent price data, making it more responsive to new information compared to the Simple Moving Average (SMA).' },
        { id: 'q7_2', question: 'What does a Golden Cross indicate?', options: ['Bearish reversal', 'Bullish signal when 50-day MA crosses above 200-day MA', 'Market is about to crash', 'Moving average convergence'], correctAnswer: 1, explanation: 'A Golden Cross occurs when the 50-day moving average crosses above the 200-day moving average and is considered a strong bullish signal.' },
      ],
    },
  },
  {
    id: 'l13', courseId: 'c2',
    title: 'RSI & MACD',
    content: 'RSI (Relative Strength Index) and MACD (Moving Average Convergence Divergence) are two of the most popular momentum indicators.\n\nRSI (Relative Strength Index) — Developed by J. Welles Wilder, RSI measures the speed and magnitude of recent price changes. RSI ranges from 0 to 100. RSI above 70 = Overbought (potential reversal). RSI below 30 = Oversold (potential bounce). RSI around 50 = Neutral.\n\nAdvanced RSI Signals: Divergence — When price makes a higher high but RSI makes a lower high = Bearish divergence (trend weakening). When price makes a lower low but RSI makes a higher low = Bullish divergence.\n\nMACD — Developed by Gerald Appel, MACD shows the relationship between two moving averages. Components: MACD Line (12-day EMA minus 26-day EMA), Signal Line (9-day EMA of MACD Line), and Histogram (MACD Line minus Signal Line).\n\nMACD Signals: MACD Line crossing above Signal Line = Bullish. MACD Line crossing below Signal Line = Bearish. MACD crossing above zero line = Bullish momentum. MACD crossing below zero line = Bearish momentum.\n\nUsing RSI and MACD Together: MACD identifies the trend direction. RSI identifies overbought/oversold conditions within the trend. In a strong uptrend, buy on RSI pullbacks to 40–50. In a strong downtrend, sell on RSI rallies to 60–70.',
    duration: '30 min', completed: false,
    quiz: {
      id: 'q8', title: 'RSI & MACD Quiz', score: 0, passed: false,
      questions: [
        { id: 'q8_1', question: 'What RSI level is typically considered oversold?', options: ['Above 70', 'Below 30', 'At 50', 'Below 20'], correctAnswer: 1, explanation: 'RSI below 30 is generally considered oversold, suggesting the price may be due for a bounce or reversal.' },
        { id: 'q8_2', question: 'What are the three components of MACD?', options: ['RSI, Signal Line, Histogram', 'MACD Line, Signal Line, Histogram', 'MACD Line, RSI, Moving Average', 'Signal Line, Stochastic, Histogram'], correctAnswer: 1, explanation: 'MACD consists of three components: the MACD Line, the Signal Line, and the Histogram showing the difference between them.' },
      ],
    },
  },
  {
    id: 'l14', courseId: 'c2',
    title: 'Chart Patterns',
    content: 'Chart patterns are specific formations that appear on price charts and signal potential future price movements. They are created by the collective psychology of market participants.\n\nReversal Patterns: Head and Shoulders (Top) — Three peaks with a higher middle peak (head) between two lower shoulders. A break below the neckline confirms a bearish reversal. Inverse Head and Shoulders (Bottom) — A break above the neckline confirms a bullish reversal.\n\nDouble Top and Double Bottom: Double Top — Price reaches resistance twice but fails to break through. A break below support confirms a bearish reversal. Double Bottom — Price reaches support twice but fails to break through. A break above resistance confirms a bullish reversal.\n\nCup and Handle: A gradual U-shaped bottom followed by a small consolidation (handle). One of the most reliable bullish patterns.\n\nContinuation Patterns: Bullish Flag (sharp upward move followed by downward consolidation), Bearish Flag (sharp downward move followed by upward consolidation), Symmetrical Triangle (converging trendlines, breakout in either direction), Ascending Triangle (flat resistance, rising support, typically bullish), and Descending Triangle (flat support, falling resistance, typically bearish).\n\nKey Principles: Larger patterns = more significant moves. Higher time frame patterns are more reliable. Volume should expand on the breakout. Wait for a confirmed close beyond the pattern boundary.',
    duration: '30 min', completed: false,
  },
  {
    id: 'l15', courseId: 'c2',
    title: 'Volume Analysis',
    content: 'Volume is one of the most important indicators available to traders. It measures the number of shares traded during a given period and reveals the strength behind price movements.\n\nWhy Volume Matters: Volume confirms trends — Strong trends have increasing volume. Volume signals reversals — Climax volume can mark the end of a trend. Volume validates breakouts — Breakouts on high volume are more likely to succeed.\n\nKey Volume Patterns: Uptrend with rising volume = Healthy trend. Uptrend with declining volume = Weakening trend. Downtrend with rising volume = Strong selling pressure. Downtrend with declining volume = Selling pressure diminishing.\n\nBreakout Volume: Breakout with 50%+ increase in average volume = Strong breakout. Breakout with below-average volume = False breakout (fakeout).\n\nVolume Indicators: On-Balance Volume (OBV) — A cumulative indicator adding volume on up days and subtracting on down days. Volume Price Trend (VPT) — Similar to OBV but uses percentage price changes. Accumulation/Distribution Line — Uses close relative to day\'s range. VWAP — Volume-Weighted Average Price, used by institutional traders.\n\nPutting It All Together: Price making higher highs + OBV making higher highs = Strong uptrend. Price making higher highs + OBV making lower highs = Bearish divergence (sell). Price making lower lows + OBV making higher lows = Bullish divergence (buy).',
    duration: '25 min', completed: false,
  },
  {
    id: 'l16', courseId: 'c2',
    title: 'Building a Trading System',
    content: 'A trading system is a set of rules that defines when to enter, when to exit, and how much to risk on each trade. Having a system removes emotion from trading.\n\nComponents: Market Selection — Which markets or stocks will you trade? Consider liquidity, volatility, and available time. Entry Rules — Specific conditions that must be met before entering. Exit Rules — When to close a position (profit target, stop loss, trailing stop). Position Sizing — How much to risk on each trade.\n\nExample Swing Trading System: Time Frame: Daily. Universe: Nifty 200 stocks. Entry: Price closes above 20-day EMA AND RSI(14) crosses above 50. Stop Loss: 2x ATR(14) below entry. Target: Previous resistance level or 3x risk. Position Size: Risk max 1% of capital per trade.\n\nBacktesting: Test your system on historical data before trading with real money. Calculate win rate, average win, average loss, and maximum drawdown. Aim for a profit factor above 1.5. Test across different market conditions.\n\nKeeping a Trading Journal: Record every trade with entry, exit, stop loss, target, and rationale. Analyze what worked and what didn\'t. Track your emotional state during trades.\n\nRemember: No trading system works all the time. The goal is to have a system that is profitable over many trades, not to win every trade.',
    duration: '30 min', completed: false,
  },

  // ─── Course 3: Fundamental Analysis (8 lessons) ───
  {
    id: 'l17', courseId: 'c3',
    title: 'Introduction to Fundamental Analysis',
    content: 'Fundamental analysis is the process of evaluating a company\'s intrinsic value by examining its financial health, business model, competitive advantages, industry position, and economic environment.\n\nTop-Down vs. Bottom-Up Approach: Top-Down starts with the global economy, then narrows to industries, and finally selects individual companies. Bottom-Up focuses on individual companies regardless of the macro environment.\n\nThe Value Investing Philosophy by Benjamin Graham and Warren Buffett: Buy a stock as if buying the entire business. Look for a margin of safety — buying at a significant discount to intrinsic value. Focus on the long term. Ignore market noise.\n\nKey Questions: Is the company profitable and growing? Does it have a competitive advantage? Is management capable and shareholder-friendly? Is it financially stable? Is the stock reasonably priced?\n\nWhere to Find Information: Company Annual Reports, Quarterly Results, Analyst Reports, Regulatory Filings, Financial News.',
    duration: '25 min', completed: false,
    quiz: {
      id: 'q9', title: 'Fundamental Analysis Intro Quiz', score: 0, passed: false,
      questions: [
        { id: 'q9_1', question: 'What does "margin of safety" mean in value investing?', options: ['Using stop-loss orders', 'Buying at a significant discount to intrinsic value', 'Investing only in government bonds', 'Diversifying across 20+ stocks'], correctAnswer: 1, explanation: 'Margin of safety is the difference between a stock\'s intrinsic value and its market price. A larger margin of safety provides a buffer against errors in analysis.' },
        { id: 'q9_2', question: 'What is the first step in the top-down approach?', options: ['Analyze the company', 'Analyze the global economy', 'Analyze the industry', 'Read the annual report'], correctAnswer: 1, explanation: 'The top-down approach starts with the global economy, then moves to domestic economy, industry, and finally the specific company.' },
      ],
    },
  },
  {
    id: 'l18', courseId: 'c3',
    title: 'Reading Financial Statements',
    content: 'Financial statements are the language of business. There are three primary statements.\n\n1. Balance Sheet — A snapshot of what the company owns (assets) and owes (liabilities). Assets = Liabilities + Shareholders\' Equity. Key components: Current Assets (cash, receivables, inventory), Non-Current Assets (PP&E, intangible assets, goodwill), Current Liabilities (payables, short-term debt), Long-Term Liabilities (long-term debt), and Shareholders\' Equity.\n\n2. Profit & Loss Statement — Shows revenues, expenses, and profits over a period. Revenue minus COGS = Gross Profit. Minus Operating Expenses = Operating Profit (EBIT). Minus Interest and Taxes = Net Profit. Key ratios: Gross Margin, Operating Margin, Net Margin.\n\n3. Cash Flow Statement — Shows how cash moves in and out. Operating Cash Flow (core business, should be positive), Investing Cash Flow (asset purchases, usually negative), Financing Cash Flow (debt/equity, buybacks/dividends).\n\nRed Flags: Revenue growing but operating cash flow declining. Increasing accounts receivable. Goodwill growing faster than total assets. One-time gains masking underlying weakness. Related party transactions. Auditor qualifications.',
    duration: '30 min', completed: false,
  },
  {
    id: 'l19', courseId: 'c3',
    title: 'Key Financial Ratios',
    content: 'Financial ratios help you quickly assess a company\'s performance and compare it with peers.\n\nValuation Ratios: P/E Ratio (Price / Earnings Per Share) — A high P/E suggests high growth expectations. P/B Ratio (Price / Book Value) — Relevant for financial companies. P/S Ratio (Market Cap / Revenue) — Useful for companies with negative earnings. Dividend Yield (Annual Dividend / Stock Price).\n\nProfitability Ratios: ROE (Net Profit / Shareholders\' Equity) — Look for consistent ROE above 15%. ROCE (EBIT / (Total Assets — Current Liabilities)) — Should be higher than cost of capital. Net Profit Margin (Net Profit / Revenue).\n\nFinancial Health Ratios: Debt-to-Equity Ratio (Total Liabilities / Shareholders\' Equity) — Above 1 is risky. Current Ratio (Current Assets / Current Liabilities) — Above 1.5 is healthy. Interest Coverage Ratio (EBIT / Interest Expense) — Below 1.5 is a red flag.\n\nGrowth Ratios: Revenue Growth (YoY), EPS Growth (YoY), Book Value Growth.\n\nNo single ratio tells the complete story. Always analyze ratios in context — compare with industry peers, historical trends, and the economic environment.',
    duration: '30 min', completed: false,
  },
  {
    id: 'l20', courseId: 'c3',
    title: 'Discounted Cash Flow (DCF) Valuation',
    content: 'DCF analysis is the most rigorous method for estimating a company\'s intrinsic value. It is based on the principle that a company is worth all the cash it can generate in the future, discounted back to the present.\n\nSteps in DCF Valuation: 1) Project Free Cash Flows for 5–10 years. FCF = Operating Cash Flow — Capital Expenditures. 2) Calculate the Terminal Value assuming stable growth (typically 2–4%). Terminal Value = Final Year FCF × (1 + Growth Rate) / (Discount Rate — Growth Rate). 3) Determine WACC (Weighted Average Cost of Capital), typically 10–15% for Indian companies. 4) Discount everything to present value. 5) Calculate Intrinsic Value Per Share.\n\nEnterprise Value = Sum of discounted FCFs + Discounted Terminal Value. Equity Value = Enterprise Value — Net Debt. Intrinsic Value Per Share = Equity Value / Total Shares.\n\nIf intrinsic value > market price = Undervalued (potential buy). If intrinsic value < market price = Overvalued (avoid or sell).\n\nLimitations: Highly sensitive to assumptions. Less useful for cyclical companies. Does not account for acquisitions or restructuring. Small changes in assumptions can produce very different valuations.',
    duration: '35 min', completed: false,
    quiz: {
      id: 'q10', title: 'DCF Valuation Quiz', score: 0, passed: false,
      questions: [
        { id: 'q10_1', question: 'What does DCF stand for?', options: ['Discounted Cash Flow', 'Direct Cash Finance', 'Derived Cash Formula', 'Discretionary Cash Flow'], correctAnswer: 0, explanation: 'DCF stands for Discounted Cash Flow — a valuation method that estimates intrinsic value by discounting projected future cash flows.' },
        { id: 'q10_2', question: 'What does WACC represent in DCF analysis?', options: ['The growth rate of the company', 'The discount rate reflecting the company\'s cost of capital', 'The terminal growth rate', 'The inflation rate'], correctAnswer: 1, explanation: 'WACC (Weighted Average Cost of Capital) is the discount rate that reflects the company\'s blended cost of equity and debt capital.' },
      ],
    },
  },
  {
    id: 'l21', courseId: 'c3',
    title: 'Industry Analysis',
    content: 'A company\'s performance is heavily influenced by the industry it operates in. Even the best-managed company struggles in a declining industry.\n\nPorter\'s Five Forces: 1) Threat of New Entrants — High barriers (patents, capital requirements, brand loyalty) mean more pricing power. 2) Bargaining Power of Suppliers — Few suppliers with unique products = high power = lower margins. 3) Bargaining Power of Buyers — Few large buyers with undifferentiated products = high power = lower prices. 4) Threat of Substitutes — More substitutes = lower pricing power. 5) Industry Rivalry — Intense competition = price wars and lower profits.\n\nIndustry Life Cycle: Introduction (early stage, high risk), Growth (rapid expansion, improving profits), Maturity (stable growth, strong cash flows), Decline (shrinking market, consolidation).\n\nAnalyzing Industry Structure in India: Regulatory environment (government policies, licensing), Cyclical vs defensive (auto/metals/real estate vs FMCG/pharma/IT), Organized vs unorganized sectors, Input cost sensitivity.',
    duration: '25 min', completed: false,
  },
  {
    id: 'l22', courseId: 'c3',
    title: 'Economic Moats',
    content: 'An economic moat is a company\'s sustainable competitive advantage that protects it from competitors. The term was popularized by Warren Buffett.\n\nTypes of Economic Moats: Cost Advantage — Lower production costs through economies of scale (Reliance Industries), proprietary technology, or efficient processes. Switching Costs — High costs that prevent customers from switching (software ecosystems, banking relationships). Network Effects — Value increases as more people use it (Zerodha\'s platform, payment systems). Intangible Assets — Brands, patents, and regulatory licenses (Hindustan Unilever, pharma companies). Efficient Scale — Markets that only support a few profitable players (utilities, telecom).\n\nEvaluating Moat Strength: Wide moat (20+ years) — HDFC Bank, Asian Paints. Narrow moat (10–20 years). No moat.\n\nMoat Threats: Technological disruption, regulatory changes, changing consumer preferences, poor management decisions. The best investments are companies with wide moats that are getting wider.',
    duration: '25 min', completed: false,
  },
  {
    id: 'l23', courseId: 'c3',
    title: 'Annual Report Analysis',
    content: 'The annual report is the most comprehensive source of information about a company.\n\nStructure: Management Discussion & Analysis (MD&A), Director\'s Report, Financial Statements, Auditor\'s Report, Corporate Governance Report, Shareholding Pattern.\n\nWhat to Look For: MD&A — Key growth drivers, risks, competitive landscape. Notes to Accounts (Critical!) — Revenue recognition policy, depreciation method, contingent liabilities, related party transactions, off-balance sheet items.\n\nRed Flags: Frequent changes in accounting policies. Revenue growing but receivables growing faster. Inventory buildup without sales growth. Capitalization of expenses. Write-offs. Unusual related party transactions. Auditor qualifications. CEO/CFO resignation without clear reason.\n\nKey Sections to Read First: MD&A (management\'s perspective), Auditor\'s Report (qualifications), Notes on Revenue and Related Party Transactions (potential red flags), Segment Reporting (business drivers).',
    duration: '30 min', completed: false,
  },
  {
    id: 'l24', courseId: 'c3',
    title: 'Building a Value Investing Checklist',
    content: 'Value investing is about buying great companies at reasonable prices. A systematic checklist helps you evaluate opportunities consistently.\n\nBusiness Quality: Does the business have a durable competitive advantage? Is it simple and understandable? Consistent operating history of 10+ years? Generates strong free cash flow? ROE > 15%? Pricing power? Industry leader?\n\nManagement Quality: Competent and shareholder-friendly? Significant ownership stake? Wise capital allocation? Transparent communication? Proven integrity?\n\nFinancial Health: Debt-to-equity manageable? Interest coverage > 3? Current ratio > 1.5? Operating cash flow positive and growing? Efficient working capital?\n\nValuation: P/E ratio reasonable vs history and peers? Margin of safety > 20% from DCF? PEG ratio below 1.5?\n\nRisk: What could permanently impair the business? Technological disruption? Regulatory risk? Concentration risk?\n\nFinal Decision: Score well on all checklists = investigate as potential investment. Multiple red flags = pass. "It is far better to buy a wonderful company at a fair price than a fair company at a wonderful price." — Warren Buffett.',
    duration: '30 min', completed: false,
  },

  // ─── Course 4: Mutual Funds & SIP Investing (6 lessons) ───
  {
    id: 'l25', courseId: 'c4',
    title: 'What are Mutual Funds?',
    content: 'A mutual fund is a pooled investment vehicle that collects money from multiple investors and invests it in a diversified portfolio of stocks, bonds, or other securities.\n\nHow Mutual Funds Work: An Asset Management Company creates a fund with a specific objective. Investors buy units at the Net Asset Value (NAV). The fund manager invests according to the stated strategy. You can redeem units at the prevailing NAV.\n\nNAV = (Total Assets — Total Liabilities) / Total Number of Units Outstanding. NAV changes daily.\n\nTypes by Structure: Open-Ended Funds (buy/sell at any time, most common), Close-Ended Funds (fixed maturity), Interval Funds (hybrid).\n\nTypes by Asset Class: Equity (stocks), Debt (bonds), Hybrid (equity + debt), Money Market (short-term instruments), Commodity (gold, silver), Real Estate (REITs).\n\nExpense Ratio — The annual fee for management, expressed as a percentage of assets. Lower is better. Entry Load was banned by SEBI in 2009. Exit Load of 0.5–1% may apply for early redemption within 1 year.',
    duration: '20 min', completed: true,
    quiz: {
      id: 'q11', title: 'Mutual Funds Basics Quiz', score: 100, passed: true,
      questions: [
        { id: 'q11_1', question: 'What does NAV stand for in mutual funds?', options: ['Net Asset Value', 'National Asset Verification', 'Net Annual Value', 'Nominal Asset Volume'], correctAnswer: 0, explanation: 'NAV (Net Asset Value) is the price per unit of a mutual fund, calculated daily based on the market value of the fund\'s holdings.' },
        { id: 'q11_2', question: 'What is the expense ratio?', options: ['The rate of return promised', 'The annual fee charged for fund management as a percentage', 'The minimum investment amount', 'The exit load percentage'], correctAnswer: 1, explanation: 'The expense ratio is the annual fee charged by the fund for management and operations, expressed as a percentage of the fund\'s assets.' },
      ],
    },
  },
  {
    id: 'l26', courseId: 'c4',
    title: 'Equity Mutual Funds',
    content: 'Equity mutual funds invest primarily in stocks. They offer the highest return potential but come with higher risk.\n\nBy Market Cap: Large-Cap Funds (top 100 companies, lower risk, 12–15% CAGR). Mid-Cap Funds (101–250, higher growth and volatility). Small-Cap Funds (251+, highest potential and risk, 7+ year horizon).\n\nBy Strategy: Flexi-Cap Funds (can invest across market caps, maximum flexibility). Multi-Cap Funds (25% each in large, mid, small). Value Funds (undervalued stocks). Growth Funds (high earnings growth).\n\nELSS (Equity Linked Savings Scheme): Tax-saving funds with 3-year lock-in. Up to Rs 1.5 lakh qualifies for Section 80C deduction. Lowest lock-in among tax-saving options.\n\nSectoral/Thematic Funds: Invest in specific sectors (IT, Pharma, Banking). Higher risk due to lack of diversification.\n\nIndex Funds & ETFs: Passive funds tracking indices (Nifty 50, Sensex). Lowest expense ratios (0.05–0.50%). Best for investors who believe markets are efficient.\n\nBeginners should start with large-cap or flexi-cap funds. Add mid/small-cap as risk appetite increases.',
    duration: '25 min', completed: true,
  },
  {
    id: 'l27', courseId: 'c4',
    title: 'Debt Mutual Funds',
    content: 'Debt mutual funds invest in fixed-income securities like government bonds, corporate bonds, treasury bills, and money market instruments.\n\nTypes: Liquid Funds (maturity up to 91 days, 3–5% returns, best for parking emergency funds). Ultra-Short Duration Funds (3–6 month duration, 4–6% returns). Short Duration Funds (1–3 year duration, 5–7% returns). Corporate Bond Funds (AA+ rated, 6–8% returns). Gilt Funds (government securities, no credit risk, interest rate risk). Credit Risk Funds (lower-rated bonds, 7–10% returns, higher default risk).\n\nKey Concepts: Yield to Maturity (YTM) — Expected return if held to maturity. Macaulay Duration — Sensitivity to interest rate changes. Credit Rating — AAA (highest safety) to below BBB (junk).\n\nInterest Rate Cycle: When RBI cuts rates, bond prices rise and NAVs increase. When RBI raises rates, bond prices fall and NAVs decrease.\n\nDebt funds are ideal for capital preservation and regular income, but they are not risk-free as the Franklin Templeton crisis of 2020 demonstrated.',
    duration: '25 min', completed: true,
  },
  {
    id: 'l28', courseId: 'c4',
    title: 'SIP vs Lump Sum',
    content: 'Systematic Investment Plan (SIP): Invest a fixed amount at regular intervals. Builds discipline. Uses rupee cost averaging — buys more units when NAV is low, fewer when high. Start with as little as Rs 500 per month.\n\nLump Sum: Invest the entire amount at once. Potentially higher returns if timed right. Requires market timing. Higher risk of investing at market peak.\n\nResearch shows: In rising markets, lump sum generally outperforms SIP. In falling markets, SIP generally outperforms. In volatile markets, SIP provides peace of mind.\n\nRecommendation: New investors should start with SIP. Experienced investors can use SIP + lump sum combination. For large windfalls, invest in staggered SIP over 6–12 months.\n\nPower of Compounding: Rs 10,000/month SIP at 12% returns: After 10 years = Rs 23.2 lakhs (invested Rs 12 lakhs). After 20 years = Rs 99.9 lakhs (invested Rs 24 lakhs). After 30 years = Rs 3.52 crores (invested Rs 36 lakhs).\n\nStep-Up SIP: Increase SIP amount by a fixed percentage every year to align with income growth.',
    duration: '20 min', completed: false,
    quiz: {
      id: 'q12', title: 'SIP vs Lump Sum Quiz', score: 0, passed: false,
      questions: [
        { id: 'q12_1', question: 'What is rupee cost averaging?', options: ['Buying more units when prices are high and fewer when low', 'Buying more units when prices are low and fewer when high through regular investments', 'Averaging the cost of all your investments at year-end', 'A tax-saving strategy'], correctAnswer: 1, explanation: 'Rupee cost averaging happens through SIP — when the market is down, your fixed investment buys more units, and when the market is up, it buys fewer units, averaging out your purchase cost.' },
        { id: 'q12_2', question: 'What happens investing Rs 10,000/month at 12% returns for 20 years?', options: ['You get back exactly what you invested', '~Rs 25 lakhs', '~Rs 1 crore', '~Rs 50 lakhs'], correctAnswer: 2, explanation: 'At 12% annual returns, investing Rs 10,000/month for 20 years grows to approximately Rs 99.9 lakhs (almost Rs 1 crore), demonstrating the power of compounding.' },
      ],
    },
  },
  {
    id: 'l29', courseId: 'c4',
    title: 'How to Select Mutual Funds',
    content: 'With thousands of mutual funds available, here is a systematic selection approach.\n\n1. Define Your Objective: Capital appreciation (equity funds), Regular income (debt funds), Tax saving (ELSS).\n\n2. Past Performance: Look at 3-year, 5-year, and 10-year returns. Compare with benchmark and category average. Consistency matters more than spectacular one-year returns.\n\n3. Fund Manager: Who manages the fund? How long? What experience? Has the manager changed recently?\n\n4. Expense Ratio: Lower is better. Direct plans are 0.5–1% cheaper than regular plans. Index funds have the lowest ratios.\n\n5. Portfolio Holdings: Does the portfolio match the stated objective? Is it diversified or concentrated? What is the turnover ratio? Any style drift?\n\n6. Risk Metrics: Standard Deviation (volatility), Beta (market sensitivity), Sharpe Ratio (risk-adjusted returns), Alpha (returns above benchmark).\n\n7. AUM: Very small funds (< Rs 100 crore) may not be viable. Very large funds (> Rs 10,000 crore) may struggle to find opportunities.\n\nA good beginner portfolio: 2–3 equity funds + 1 debt fund + 1 index fund.',
    duration: '25 min', completed: false,
  },
  {
    id: 'l30', courseId: 'c4',
    title: 'Taxation of Mutual Fund Investments',
    content: 'Understanding mutual fund taxation helps maximize post-tax returns.\n\nEquity Funds (>65% equity): STCG (< 12 months) — 15% tax. LTCG (> 12 months) — 10% tax on gains above Rs 1 lakh. Gains up to Rs 1 lakh are tax-free.\n\nDebt Funds (<65% equity): STCG (< 36 months) — Taxed as per income slab. LTCG (> 36 months) — 20% with indexation benefit.\n\nHybrid Funds: Aggressive (65–80% equity) — Taxed like equity. Conservative (10–40% equity) — Taxed like debt.\n\nELSS: 3-year lock-in. Taxed like equity funds after lock-in. Section 80C deduction up to Rs 1.5 lakh.\n\nDividends: Added to income, taxed as per slab. TDS at 10% on dividends exceeding Rs 5,000.\n\nTax Harvesting Strategy: If LTCG is close to Rs 1 lakh, sell and repurchase the same fund to reset cost basis without paying tax.',
    duration: '20 min', completed: false,
  },

  // ─── Course 5: Options Trading Strategies (8 lessons) ───
  {
    id: 'l31', courseId: 'c5',
    title: 'Options Basics',
    content: 'Options are derivative instruments that give you the right, but not the obligation, to buy or sell an underlying asset at a predetermined price (strike price) on or before a specific date (expiry).\n\nCall Option — Right to BUY. Bullish strategy. Max loss = Premium paid. Max profit = Unlimited.\n\nPut Option — Right to SELL. Bearish strategy. Max loss = Premium paid. Max profit = Strike price minus premium.\n\nKey Terms: Strike Price (predetermined price), Premium (price of the option), Expiry (last exercise date, Thursdays in India).\n\nMoneyness: ITM (Call: Spot > Strike | Put: Spot < Strike), ATM (Spot close to Strike), OTM (Call: Spot < Strike | Put: Spot > Strike).\n\nOption Premium = Intrinsic Value + Time Value. Intrinsic Value = Max(0, Spot — Strike) for calls. Time Value decays as expiry approaches.\n\nWhy Trade Options: Leverage (control large positions with small premium), Defined Risk (max loss = premium for buyers), Flexibility (profit in any market), Hedging (protect portfolio).\n\nImportant: Options selling carries significant risk. Beginners should start by buying options, not selling them.',
    duration: '30 min', completed: false,
    quiz: {
      id: 'q13', title: 'Options Basics Quiz', score: 0, passed: false,
      questions: [
        { id: 'q13_1', question: 'What is the maximum loss for a call option buyer?', options: ['Unlimited', 'The premium paid', 'The strike price', 'The underlying asset value'], correctAnswer: 1, explanation: 'The maximum loss for an option buyer is limited to the premium paid.' },
        { id: 'q13_2', question: 'When is a call option In the Money?', options: ['When spot is below strike', 'When spot is above strike', 'When spot equals strike', 'When time value is zero'], correctAnswer: 1, explanation: 'A call option is ITM when the spot price is above the strike price.' },
        { id: 'q13_3', question: 'What does ATM stand for in options?', options: ['Automated Teller Machine', 'At The Money', 'All Time Market', 'Above The Market'], correctAnswer: 1, explanation: 'ATM (At The Money) means the strike price is approximately equal to the current spot price.' },
      ],
    },
  },
  {
    id: 'l32', courseId: 'c5',
    title: 'Options Pricing & Greeks',
    content: 'Options pricing is complex but understanding the fundamentals helps you make better trading decisions.\n\nThe Option Premium consists of Intrinsic Value (real value if exercised) and Time Value (extra premium for possibility of future movement). OTM options have only time value. ATM options have the highest time value.\n\nFactors Affecting Premium: Underlying Price, Strike Price, Time to Expiry, Volatility, Interest Rates, Dividends.\n\nThe Greeks: Delta (change in option price relative to underlying — 0 to 1 for calls, -1 to 0 for puts). Gamma (change in Delta). Theta (time decay — always negative for buyers). Vega (sensitivity to implied volatility). Rho (sensitivity to interest rates, least important).\n\nImplied Volatility (IV): Market\'s expectation of future volatility. High IV = expensive options (fear). Low IV = cheap options (complacency). IV is mean-reverting.',
    duration: '35 min', completed: false,
  },
  {
    id: 'l33', courseId: 'c5',
    title: 'Covered Call Strategy',
    content: 'The covered call is popular among income-focused investors who already own the underlying stock. You sell a call option on stock you already own and collect the premium.\n\nWhen to Use: You own a stock and expect sideways or slightly higher movement. You want additional income. You are willing to sell at a specific price.\n\nExample: Own RELIANCE at Rs 2,800. Sell Rs 2,900 Call for Rs 45 premium. Income: Rs 4,500. If stock stays below Rs 2,900, keep premium. If stock rises above, shares are called away at Rs 2,900.\n\nRisk: If stock falls significantly, the small premium does not compensate for the loss. Upside is capped if stock rallies above the strike.\n\nConsidered a conservative strategy, but it does not eliminate downside risk.',
    duration: '25 min', completed: false,
  },
  {
    id: 'l34', courseId: 'c5',
    title: 'Protective Put Strategy',
    content: 'A protective put is like buying insurance for your stock portfolio. You buy a put option on stock you already own.\n\nWhen to Use: You have unrealized gains and want to protect them. You are bullish long-term but concerned about short-term volatility. Before earnings announcements.\n\nExample: Own TCS at Rs 3,900. Buy Rs 3,850 Put for Rs 30 premium. Cost: Rs 3,000. If stock falls to Rs 3,500, you can still sell at Rs 3,850 (limited loss). If stock rises to Rs 4,200, the put expires worthless but your stock gains significantly.\n\nThe cost of protection: ATM puts cost more but offer full protection. OTM puts cost less but offer partial protection.\n\nThe protective put is essential for managing downside risk without selling core holdings.',
    duration: '25 min', completed: false,
  },
  {
    id: 'l35', courseId: 'c5',
    title: 'Vertical Spreads',
    content: 'Vertical spreads involve buying and selling options of the same type with different strike prices but the same expiry.\n\nBull Call Spread (debit): Buy ATM call + Sell OTM call. Bullish with defined risk/reward. Max loss = net premium paid.\n\nBear Put Spread (debit): Buy ATM put + Sell OTM put. Bearish with defined risk/reward.\n\nBull Put Spread (credit): Sell OTM put + Buy further OTM put. Bullish (expect price to stay above short strike). Profit = net credit received.\n\nBear Call Spread (credit): Sell OTM call + Buy further OTM call. Bearish (expect price to stay below short strike).\n\nCredit spreads: Receive premium upfront, higher probability of profit, limited but substantial risk. Debit spreads: Pay premium upfront, lower probability, risk limited to premium paid.\n\nAdvantages: Defined maximum risk, lower margin, cheaper than outright options, useable in any market condition.',
    duration: '30 min', completed: false,
  },
  {
    id: 'l36', courseId: 'c5',
    title: 'Iron Condor Strategy',
    content: 'The Iron Condor is the quintessential range-bound market strategy. It profits when the underlying stays within a defined price range.\n\nFour legs: Sell OTM put, Buy further OTM put (protection), Sell OTM call, Buy further OTM call (protection). All same expiry.\n\nProfits in the middle range between the two short strikes. Max profit = net credit received. Max loss = width between strikes minus credit received.\n\nBest for low-volatility environments and range-bound markets.\n\nAvoid in: High volatility, trending markets, before major events (budget, RBI policy, earnings).\n\nA professional strategy offering high probability of profit with defined risk.',
    duration: '30 min', completed: false,
  },
  {
    id: 'l37', courseId: 'c5',
    title: 'Straddle & Strangle Strategies',
    content: 'Straddles and strangles are volatility strategies that profit from large price movements regardless of direction.\n\nLong Straddle: Buy ATM Call + Buy ATM Put (same strike and expiry). Profits from large move in either direction. Max loss = total premium paid.\n\nLong Strangle: Buy OTM Call + Buy OTM Put (different strikes). Cheaper than straddle but needs larger move to profit.\n\nUse for: Earnings announcements, major economic data releases, binary events, when implied volatility is low.\n\nRisk: Time decay works against you. You need the move to happen before expiry. If IV is already high, you may overpay. Volatility crush after events can kill profits.\n\nPowerful for event-driven trading but requires careful timing and volatility analysis.',
    duration: '30 min', completed: false,
  },
  {
    id: 'l38', courseId: 'c5',
    title: 'Options Trading Risk Management',
    content: 'Options trading can be highly leveraged. Professional traders prioritize risk management above all else.\n\nFirst Rule: Never risk more than you can afford to lose. Use the Fixed Percentage Method — risk no more than 1–2% of total capital on any single trade.\n\nCommon Mistakes: Buying deep OTM options (lottery tickets). Holding losing positions too long (time decay). Over-leverage. Ignoring implied volatility. Not managing winners. Trading illiquid options.\n\nThe 60/40 Rule: 60% of option value from time to expiry, 40% from underlying movement. Never buy options with less than 7 days to expiry. Sweet spot: 3–8 weeks.\n\nMax Pain Theory: The strike where most option buyers lose money at expiry. Markets often gravitate toward max pain on expiry day.\n\nBefore every trade: What is my max loss? Target profit? Stop loss? Have I checked IV percentile? Is the option liquid?',
    duration: '30 min', completed: false,
  },

  // ─── Course 6: Risk Management & Trading Psychology (6 lessons) ───
  {
    id: 'l39', courseId: 'c6',
    title: 'Position Sizing',
    content: 'Position sizing is the single most important factor in long-term trading success.\n\nThe Fixed Percentage Rule: Risk no more than 1% of capital on any single trade. If capital = Rs 5,00,000, max risk = Rs 5,000. Position Size = (Account x Risk%) / (Entry — Stop Loss).\n\nAdvanced Methods: Kelly Criterion (based on win rate and average win/loss ratio). Volatility-Based Sizing (ATR Method) — more volatile stocks get smaller positions. Equal Risk Method — every position has equal risk.\n\nCritical Rule: Never increase position size after a loss (Martingale). Stick to standard size or reduce after losses. After a win streak, consider reducing (due for a loss).\n\nConsistency is key. Use the same method every time on every trade.',
    duration: '25 min', completed: false,
    quiz: {
      id: 'q14', title: 'Position Sizing Quiz', score: 0, passed: false,
      questions: [
        { id: 'q14_1', question: 'What is the recommended risk per trade as a percentage of capital?', options: ['5–10%', '1–2%', '15–20%', '25–30%'], correctAnswer: 1, explanation: 'Most professional traders recommend risking no more than 1–2% of total capital on any single trade.' },
        { id: 'q14_2', question: 'How do you calculate position size?', options: ['Account balance + stop distance', '(Account x Risk%) / (Entry — Stop Loss)', 'Total capital / number of positions', 'ATR x 100'], correctAnswer: 1, explanation: 'Position size = (Account x Risk%) / (Entry — Stop Loss). This ensures your loss equals your predetermined risk if stopped out.' },
      ],
    },
  },
  {
    id: 'l40', courseId: 'c6',
    title: 'Stop Loss Strategies',
    content: 'A stop loss is your most important risk management tool — a predetermined price at which you exit a losing trade.\n\nWhy traders avoid them: Hope ("it will come back"), Ego (refusing to admit wrong), Fear (stopped out before the turn), Overconfidence.\n\nTypes: Technical Stop Loss (below swing low/support/moving average). Volatility-Based (2–3x ATR below entry). Fixed Percentage (5–8% for equities, 1–3% for intraday). Time Stop Loss (exit if thesis hasn\'t played out in set time). Trailing Stop Loss (moves up as price rises, locking in profits).\n\nWhere NOT to place: Too tight (hit by noise). At round numbers (hunted by market makers). At exact support levels.\n\nGolden Rule: Every trade must have a stop loss before entry. Decide your exit before you enter. Non-negotiable.',
    duration: '25 min', completed: false,
  },
  {
    id: 'l41', courseId: 'c6',
    title: 'Risk-Reward Ratio',
    content: 'The risk-reward ratio (R:R) is the comparison of potential profit to potential loss on a trade.\n\nR:R = Potential Loss / Potential Profit. 1:3 means risk 1 to make 3. Lower is better.\n\nWhy R:R Matters: Even with 30% win rate, 1:3 R:R can be profitable. Even with high win rate, poor R:R can lose money.\n\nSetting Targets: Support/Resistance Levels, Fibonacci Extensions, Fixed Multiple (2x or 3x risk), Volatility-Based (2–3x ATR), Trailing Target.\n\nMinimum Thresholds: Day Trading 1:1.5, Swing Trading 1:2, Position Trading 1:3, Options Buying 1:3.\n\nExpected Value (EV): EV = (Win Rate x Avg Win) — (Loss Rate x Avg Loss). Focus on EV, not individual outcomes.\n\nAlways know your risk and reward BEFORE entering a trade. If R:R is not favorable, skip the trade.',
    duration: '20 min', completed: false,
  },
  {
    id: 'l42', courseId: 'c6',
    title: 'Trading Psychology',
    content: 'Trading psychology studies how emotions and cognitive biases affect trading decisions. Most traders fail due to poor psychology, not bad strategies.\n\nThe Emotional Cycle: Excitement (entry) → Euphoria (profit) → Anxiety (turns against) → Denial (refuses loss) → Fear (mounting losses) → Capitulation (exit at worst) → Despair (regret) → Hope (next trade).\n\nCommon Biases: Confirmation Bias (ignoring contradictory evidence). Anchoring (fixating on a price). Loss Aversion (losses hurt 2x more than gains). Recency Bias (overweighting recent events). Overconfidence (luck vs skill). FOMO (chasing moves). Revenge Trading (impulsive recovery attempts).\n\nBuilding a Routine: Before trading — check physical state, review plan, set risk limits, meditate. During trading — stick to plan, take breaks, size down if losing. After trading — journal every trade, review entries/exits, separate process from outcome.\n\nFocus on process, not outcome. A well-executed loss is still a good trade. A lucky win on a poorly planned trade is a bad trade.',
    duration: '25 min', completed: false,
    quiz: {
      id: 'q15', title: 'Trading Psychology Quiz', score: 0, passed: false,
      questions: [
        { id: 'q15_1', question: 'What is loss aversion in trading?', options: ['Not wanting to trade when volatile', 'Feeling losses more intensely than equivalent gains', 'Avoiding high-risk stocks', 'Preferring long-term trading'], correctAnswer: 1, explanation: 'Loss aversion is the tendency to feel the pain of losses about twice as intensely as the pleasure of equivalent gains.' },
        { id: 'q15_2', question: 'What should you do after a significant losing trade?', options: ['Double down to recover', 'Take a break and step away', 'Ignore it and keep trading', 'Change your entire strategy'], correctAnswer: 1, explanation: 'After a significant loss, take a break to reset your emotional state. Trading while emotional often leads to revenge trading.' },
      ],
    },
  },
  {
    id: 'l43', courseId: 'c6',
    title: 'Building a Trading Journal',
    content: 'A trading journal is the single most effective tool for improving performance. It transforms subjective feelings into objective data.\n\nWhat to Record: Pre-Trade — Date, instrument, direction, entry price, size, stop loss, target, setup type, reason. During Trade — Did you move stop? Trail target? Emotional state? Post-Trade — Exit price, P&L, holding period, emotional state, plan compliance.\n\nKey Metrics: Total trades, win rate, average win/loss, profit factor, max consecutive wins/losses, max drawdown.\n\nProcess Metrics (more important than P&L): Plan compliance rate, trades with predefined stop loss, impulsive trades.\n\nWeekly Review: Review all trades, calculate metrics, identify what worked, note psychological patterns, adjust plan.\n\nIf you are not journaling, you are not serious about improving as a trader.',
    duration: '20 min', completed: false,
  },
  {
    id: 'l44', courseId: 'c6',
    title: 'Building a Complete Risk Management Framework',
    content: 'A comprehensive risk management framework covers trade-level, portfolio-level, and lifestyle-level risk.\n\nLayer 1 — Trade-Level: Every trade has a predefined stop loss. Position size based on risk (1% of capital). R:R at least 1:2 before entry. Max 10% portfolio per position.\n\nLayer 2 — Portfolio-Level: Max total risk 3–5% of capital. Max sector exposure 20%. Max correlated positions 25%. Daily loss limit 3% (stop trading). Weekly loss limit 6%.\n\nLayer 3 — Lifestyle-Level: Never trade money you cannot afford to lose. Never trade when emotionally distressed. Take break after 3 consecutive losses. Take week off after 5 consecutive losses or 10% drawdown.\n\nDrawdown Management: 0–5% — Normal, review. 5–10% — Reduce size 25%, increase selectivity. 10–15% — Reduce size 50%, trade only highest-conviction. 15–20% — Stop entirely, paper trade to rebuild. >20% — Reassess strategy entirely.\n\nThe Ultimate Iron Law: The market can remain irrational longer than you can remain solvent. Protect your capital first, profits second.',
    duration: '25 min', completed: false,
    quiz: {
      id: 'q16', title: 'Risk Management Framework Quiz', score: 0, passed: false,
      questions: [
        { id: 'q16_1', question: 'What should you do at 10% drawdown?', options: ['Double down to recover', 'Reduce size 50%, increase selectivity', 'Stop trading permanently', 'Ignore it'], correctAnswer: 1, explanation: 'At 10% drawdown, reduce position size by 50%, increase selectivity, and review your journal for patterns.' },
        { id: 'q16_2', question: 'What is the recommended daily loss limit?', options: ['5% of portfolio', '10% of portfolio', '3% of portfolio', '15% of portfolio'], correctAnswer: 2, explanation: 'The recommended daily loss limit is 3% of portfolio. If hit, stop trading entirely for the day.' },
        { id: 'q16_3', question: 'What is the first layer of the three-layer risk framework?', options: ['Lifestyle-level', 'Portfolio-level', 'Trade-level', 'Market-level'], correctAnswer: 2, explanation: 'The three layers are: 1) Trade-level (individual stops and sizing), 2) Portfolio-level (overall exposure), and 3) Lifestyle-level (personal well-being).' },
      ],
    },
  },
];
