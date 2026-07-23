#!/usr/bin/env python3
"""
Add videoUrl, videoThumbnail, and transcript to lessons in courseContent.ts
that don't already have them. Uses a simple state-machine approach with line-by-line processing.
"""
import re, sys
from pathlib import Path

SAMPLE_VIDEO = 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4'

# Topic-specific transcript templates
TRANSCRIPTS = {
    'default': [
        "Welcome to this lesson. Let us explore the key concepts together.",
        "This topic is fundamental to understanding how markets and investing work.",
        "We will break down complex ideas into simple, actionable knowledge.",
        "Pay close attention to the examples as they illustrate real-world scenarios.",
        "Take notes and revisit any section you find challenging.",
        "By the end of this lesson, you will have a solid understanding of this topic.",
        "Let us begin our learning journey for today's lesson.",
    ],
    'Market Participants': [
        "Understanding how market participants interact is crucial for every investor.",
        "The market ecosystem includes retail investors, institutions, and market makers.",
        "Each participant plays a unique role in price discovery and liquidity.",
        "Foreign institutional investors often drive market trends in India.",
        "Stock brokers are SEBI-registered intermediaries who facilitate trading.",
        "Depositories like NSDL and CDSL hold your securities in electronic form.",
        "Knowing who participates helps you understand what drives price movements.",
    ],
    'Stock Exchanges': [
        "India has two primary stock exchanges: NSE and BSE.",
        "The NSE is India's largest exchange by trading volume.",
        "The BSE is Asia's oldest exchange, established in 1875.",
        "Nifty 50 and Sensex are the benchmark indices.",
        "Trading hours are from 9:15 AM to 3:30 PM on weekdays.",
        "Circuit breakers halt trading during extreme market movements.",
        "Understanding exchanges helps you navigate the market structure.",
    ],
    'Read Stock Prices': [
        "Every number on your trading screen tells a story about market activity.",
        "The last traded price is the most recent price at which shares traded.",
        "Day high and low show the price range for the current session.",
        "Change percent compares current price to the previous close.",
        "Bid and ask prices reveal supply and demand at each level.",
        "Volume confirms the strength behind price movements.",
        "Market capitalization helps you understand a company's size.",
    ],
    'Order Types': [
        "Choosing the right order type is critical for executing your strategy.",
        "Market orders guarantee execution but not the price.",
        "Limit orders guarantee price but not execution.",
        "Stop-loss orders help you manage risk automatically.",
        "Intraday orders must be closed by end of trading day.",
        "Delivery orders are for long-term investing with full payment.",
        "Understanding order types prevents costly execution mistakes.",
    ],
    'Demat': [
        "A Demat account holds your shares in electronic form.",
        "A trading account is linked to your Demat account for placing orders.",
        "Opening an account requires KYC with PAN and Aadhaar documents.",
        "Annual maintenance charges range from 150 to 750 rupees.",
        "STT or securities transaction tax is applied on every trade.",
        "The KYC process is now unified across the financial system.",
        "Understanding account charges helps you choose the right broker.",
    ],
    'Taxation of Stock': [
        "Capital gains tax depends on your holding period and income type.",
        "Short-term gains on equity held under 12 months are taxed at 15 percent.",
        "Long-term gains exceeding one lakh rupees are taxed at 10 percent.",
        "Short-term losses can offset both short and long-term capital gains.",
        "Securities transaction tax is automatically deducted on trades.",
        "Dividends are added to your income and taxed as per your slab.",
        "Tax-efficient investing can significantly improve your net returns.",
    ],
    'First Portfolio': [
        "Building a diversified portfolio is the foundation of wealth creation.",
        "Asset allocation between equities and debt determines most returns.",
        "Diversification across sectors reduces portfolio risk.",
        "Start with a small amount and invest systematically.",
        "Time in the market beats timing the market.",
        "Review your portfolio quarterly, not daily.",
        "Let compound interest work its magic over the long term.",
    ],
    'Candlestick': [
        "Candlestick patterns reveal the battle between buyers and sellers.",
        "Each candlestick shows the open, high, low, and close for a period.",
        "Single patterns like Doji and Hammer signal potential reversals.",
        "Multiple patterns like engulfing provide stronger trading signals.",
        "The Morning Star and Evening Star are powerful reversal patterns.",
        "Always confirm patterns with volume and support or resistance levels.",
        "Candlestick patterns have been trusted by traders for centuries.",
    ],
    'Support': [
        "Support acts as a floor where buying pressure exceeds selling.",
        "Resistance acts as a ceiling where selling pressure dominates.",
        "Role reversal turns broken resistance into new support.",
        "The more times a level is tested, the stronger it becomes.",
        "Breakouts with high volume are more likely to succeed.",
        "Round numbers often act as psychological support or resistance.",
        "Mastering these concepts is essential for technical analysis.",
    ],
    'Moving Average': [
        "Moving averages smooth price data to reveal underlying trends.",
        "The simple moving average gives equal weight to all prices.",
        "The exponential moving average responds faster to recent prices.",
        "Golden cross and death cross are powerful trend signals.",
        "The 200-day moving average is the bull or bear market line.",
        "Moving averages act as dynamic support and resistance.",
        "Combine moving averages with other indicators for best results.",
    ],
    'RSI': [
        "RSI measures the speed and magnitude of recent price changes.",
        "RSI above 70 indicates overbought conditions.",
        "RSI below 30 indicates oversold conditions.",
        "Divergence between RSI and price signals trend weakness.",
        "MACD shows the relationship between two moving averages.",
        "MACD crossovers generate reliable buy and sell signals.",
        "Using RSI and MACD together provides powerful trading insights.",
    ],
    'Chart Pattern': [
        "Chart patterns reveal collective market psychology.",
        "Reversal patterns signal that the current trend may change.",
        "Head and shoulders is one of the most reliable reversal patterns.",
        "Flags and pennants indicate brief pauses in strong trends.",
        "Triangles suggest consolidation before a breakout in either direction.",
        "Larger patterns on higher time frames are more significant.",
        "Always wait for a confirmed breakout before taking a trade.",
    ],
    'Volume Analysis': [
        "Volume measures the number of shares traded in a period.",
        "Rising volume confirms the strength of a trend.",
        "Climax volume often marks the end of a trend.",
        "On-balance volume provides leading signals of trend changes.",
        "Low volume breakouts are often false breakouts or fakeouts.",
        "VWAP helps evaluate trade execution quality.",
        "Volume analysis is essential for confirming price movements.",
    ],
    'Trading System': [
        "A trading system removes emotion from your decisions.",
        "Every system needs clear entry and exit rules.",
        "Position sizing determines how much to risk per trade.",
        "Backtesting validates your system before trading real money.",
        "Aim for a profit factor above 1.5 in your backtests.",
        "A trading journal helps you continuously refine your system.",
        "Focus on process, not individual trade outcomes.",
    ],
    'Financial Statement': [
        "Financial statements are the language of business.",
        "The balance sheet shows what a company owns and owes.",
        "The profit and loss statement reveals profitability.",
        "The cash flow statement shows how money moves through the business.",
        "Operating cash flow should be positive and growing.",
        "Red flags include revenue growing but cash flow declining.",
        "Mastering financial statements is essential for value investing.",
    ],
    'Financial Ratio': [
        "Financial ratios help evaluate a company's performance quickly.",
        "The P/E ratio shows how much investors pay for each rupee of earnings.",
        "ROE measures how efficiently a company uses shareholder capital.",
        "The debt-to-equity ratio indicates financial leverage and risk.",
        "Profit margins reveal pricing power and cost efficiency.",
        "Always compare ratios within the same industry.",
        "No single ratio tells the complete story by itself.",
    ],
    'Discounted Cash Flow': [
        "DCF analysis estimates a company's intrinsic value.",
        "Free cash flow is the foundation of DCF valuation.",
        "Terminal value often represents most of the total valuation.",
        "WACC is the discount rate reflecting the cost of capital.",
        "Small changes in assumptions can significantly change the valuation.",
        "DCF is most useful for stable, predictable businesses.",
        "Compare intrinsic value to market price for investment decisions.",
    ],
    'Industry Analysis': [
        "A company's performance is heavily influenced by its industry.",
        "Porter's Five Forces framework evaluates industry attractiveness.",
        "High barriers to entry protect profitable companies.",
        "Supplier and buyer power affect industry profitability.",
        "Industry life cycles help identify growth opportunities.",
        "Regulatory environment varies significantly by industry.",
        "Understanding industry dynamics is crucial for stock selection.",
    ],
    'Economic Moat': [
        "An economic moat protects a company from competitors.",
        "Cost advantages allow companies to undercut competitors.",
        "Switching costs keep customers locked into the ecosystem.",
        "Network effects make platforms more valuable as they grow.",
        "Strong brands command premium prices and loyalty.",
        "Wide moats lead to sustainable competitive advantages.",
        "Warren Buffett looks for companies with wide economic moats.",
    ],
    'Annual Report': [
        "Annual reports contain comprehensive company information.",
        "The management discussion reveals strategic thinking.",
        "Notes to accounts often hide important details.",
        "Auditor qualifications should never be ignored.",
        "Related party transactions can reveal governance issues.",
        "Revenue recognition policies affect reported earnings.",
        "Reading annual reports is a superpower for investors.",
    ],
    'Value Investing': [
        "Value investing is buying great companies at fair prices.",
        "A systematic checklist ensures consistent evaluation.",
        "Business quality, management, and financial health are key.",
        "Margin of safety protects you from errors in analysis.",
        "Patience is essential for value investing success.",
        "The best investments come from thorough research.",
        "Build your own investing checklist for consistent decisions.",
    ],
    'Equity Mutual': [
        "Equity mutual funds invest primarily in stocks.",
        "Large-cap funds offer stability with moderate returns.",
        "Mid-cap funds offer higher growth with more volatility.",
        "Small-cap funds offer the highest potential returns and risk.",
        "Flexi-cap funds give managers maximum flexibility.",
        "ELSS funds offer tax savings with a three-year lock-in.",
        "Index funds provide market returns at the lowest cost.",
    ],
    'Debt Mutual': [
        "Debt funds invest in fixed-income securities.",
        "Liquid funds are ideal for parking emergency savings.",
        "Duration determines sensitivity to interest rate changes.",
        "Credit quality affects both returns and default risk.",
        "Gilt funds have no credit risk but carry interest rate risk.",
        "Yield to maturity helps set return expectations.",
        "Debt funds are not risk-free as the Franklin crisis showed.",
    ],
    'SIP vs': [
        "SIP investing builds wealth through discipline and compounding.",
        "Rupee cost averaging buys more units when markets are low.",
        "The power of compounding creates exponential wealth over time.",
        "SIPs remove the need to time the market.",
        "In rising markets, lump sum generally outperforms SIP.",
        "In volatile markets, SIP provides peace of mind.",
        "Start early to maximize the benefits of compounding.",
    ],
    'Select Mutual': [
        "Selecting mutual funds requires systematic analysis.",
        "Past performance provides useful context but is not guaranteed.",
        "Fund manager experience and track record matter significantly.",
        "Lower expense ratios lead to higher net returns.",
        "Portfolio holdings should match the fund's stated objective.",
        "Risk metrics like Sharpe ratio help evaluate risk-adjusted returns.",
        "A good beginner portfolio includes two to three funds.",
    ],
    'Mutual Fund Tax': [
        "Mutual fund taxation varies by type and holding period.",
        "Equity funds enjoy favorable tax treatment for long-term gains.",
        "Debt funds are taxed at your income slab for short holdings.",
        "Indexation benefit reduces tax on long-term debt fund gains.",
        "ELSS offers dual tax saving and wealth creation benefits.",
        "Tax harvesting can optimize your mutual fund tax liability.",
        "Understanding taxation helps maximize post-tax returns.",
    ],
    'Greeks': [
        "Options Greeks measure different dimensions of price risk.",
        "Delta measures how much the option price moves with the stock.",
        "Gamma measures the rate of change of delta.",
        "Theta captures the impact of time decay on option prices.",
        "Vega shows sensitivity to changes in implied volatility.",
        "Rho measures sensitivity to interest rate changes.",
        "Understanding Greeks is essential for advanced options trading.",
    ],
    'Covered Call': [
        "The covered call generates income from stocks you already own.",
        "You sell a call option and collect premium as income.",
        "This strategy works best in sideways or slightly bullish markets.",
        "Your upside is capped in exchange for the premium received.",
        "Covered calls are popular among income-focused investors.",
        "Downside risk is not eliminated by the premium collected.",
        "This is considered a conservative options strategy.",
    ],
    'Protective Put': [
        "A protective put is like insurance for your stock portfolio.",
        "You buy a put option to protect against downside risk.",
        "The premium paid is the cost of insurance protection.",
        "This strategy is useful before earnings or uncertain events.",
        "ATM puts offer full protection at a higher cost.",
        "Protective puts let you hold stocks with peace of mind.",
        "This is essential for managing downside risk.",
    ],
    'Vertical Spread': [
        "Vertical spreads define both risk and reward in advance.",
        "Debit spreads cost premium with defined maximum loss.",
        "Credit spreads receive premium with defined risk.",
        "Bull call spreads profit from upward price movement.",
        "Bear put spreads profit from downward price movement.",
        "Vertical spreads require less capital than outright options.",
        "They are versatile strategies for any market view.",
    ],
    'Iron Condor': [
        "The iron condor profits in range-bound markets.",
        "It combines a bear call spread and a bull put spread.",
        "Maximum profit is the net credit received upfront.",
        "Risk is defined between the outer strike prices.",
        "Iron condors work best in low volatility environments.",
        "Avoid iron condors before major market events.",
        "This strategy is ideal for consistent income generation.",
    ],
    'Straddle': [
        "Straddles and strangles profit from large price moves in either direction.",
        "A long straddle buys both a call and a put at the same strike.",
        "Strangles use out-of-the-money options for lower cost.",
        "These strategies are ideal before earnings announcements.",
        "Implied volatility expansion can boost profits significantly.",
        "Time decay works against long volatility positions.",
        "These are the go-to strategies for high-event days.",
    ],
    'Options Trading Risk': [
        "Risk management is the most important aspect of options trading.",
        "Position sizing limits the impact of any single trade.",
        "Understanding leverage helps prevent catastrophic losses.",
        "Greeks help measure your portfolio's risk exposures.",
        "Stop losses are essential even for options positions.",
        "Portfolio-level risk management protects your entire account.",
        "Professional traders prioritize risk management above all else.",
    ],
    'Stop Loss': [
        "A stop loss is your most important risk management tool.",
        "It automatically exits losing trades at a predetermined level.",
        "Technical stop losses are placed below support levels.",
        "Volatility-based stops use ATR for appropriate distances.",
        "Percentage stops limit losses to a fixed percentage of capital.",
        "Trailing stops lock in profits as the trade moves favorably.",
        "Always set a stop loss before entering any trade.",
    ],
    'Risk-Reward': [
        "The risk-reward ratio measures potential profit versus potential loss.",
        "A minimum one to three risk-reward ratio is recommended.",
        "Position sizing should be based on risk, not potential reward.",
        "Favorable risk-reward ratios lead to long-term profitability.",
        "Win rate matters less than the average win to loss ratio.",
        "Consistently using good risk-reward ratios is key to success.",
        "Let us learn to optimize our risk-reward calculations.",
    ],
    'Trading Psychology': [
        "Trading psychology is the most overlooked factor in success.",
        "Fear and greed are the two emotions that drive market cycles.",
        "Discipline means following your plan even when uncomfortable.",
        "Emotional detachment allows you to trade objectively.",
        "Accepting losses as part of the business is essential.",
        "A trading journal helps identify psychological patterns.",
        "Mastering psychology is more important than any strategy.",
    ],
    'Trading Journal': [
        "A trading journal is the most effective tool for improvement.",
        "Record every trade including your emotional state.",
        "Analyze patterns to identify strengths and weaknesses.",
        "Review your journal weekly for continuous improvement.",
        "Track your plan compliance and mistake frequency.",
        "Consistent journaling accelerates the learning curve.",
        "Let us build an effective trading journal system.",
    ],
    'Risk Management Framework': [
        "A complete risk management framework covers all aspects of trading.",
        "Portfolio-level risk limits prevent catastrophic drawdowns.",
        "Correlation between positions affects overall portfolio risk.",
        "Drawdown management rules tell you when to stop trading.",
        "Scenario analysis prepares you for extreme market events.",
        "Psychological safeguards protect against emotional decisions.",
        "Build your risk management framework before you start trading.",
    ],
    'Credit Score': [
        "Your credit score affects your financial life significantly.",
        "Payment history is the most important factor in your score.",
        "Keep credit utilization below thirty percent for a good score.",
        "A longer credit history improves your credit score.",
        "Too many credit inquiries can lower your score temporarily.",
        "Check your credit report annually for errors.",
        "Building good credit takes time and discipline.",
    ],
    'Insurance': [
        "Insurance protects you and your family from financial catastrophe.",
        "Term life insurance is the most cost-effective life cover.",
        "Health insurance is essential given rising medical costs.",
        "Buy insurance for protection, not as an investment.",
        "Adequate coverage is more important than low premiums.",
        "Disclose all pre-existing conditions to prevent claim rejection.",
        "Understand the different types of insurance you need.",
    ],
    'What are Derivatives': [
        "Derivatives are instruments whose value comes from an underlying asset.",
        "They are used for hedging, speculation, and risk management.",
        "Forwards are customized contracts traded over the counter.",
        "Futures are standardized contracts traded on exchanges.",
        "Options provide the right but not the obligation to trade.",
        "Swaps involve exchanging cash flows between parties.",
        "Derivatives are powerful tools that require careful understanding.",
    ],
    'Futures Trading': [
        "Futures are standardized exchange-traded agreements for future delivery.",
        "Margin requirements allow traders to use leverage.",
        "Daily mark-to-market settlement ensures both parties meet obligations.",
        "Open interest shows the number of active contracts.",
        "Most futures positions are closed before expiry.",
        "Futures are used for hedging, speculation, and arbitrage.",
        "Understanding futures is essential for derivative trading.",
    ],
    'Options Strategies for Beginners': [
        "Options offer flexibility and defined risk for new traders.",
        "Long calls are the simplest bullish options strategy.",
        "Long puts are the simplest bearish options strategy.",
        "Options allow profiting from price moves with limited capital.",
        "Time decay works against option buyers over time.",
        "Implied volatility significantly affects option prices.",
        "Start with buying options before exploring selling strategies.",
    ],
    'Margin': [
        "Margin and leverage amplify both gains and losses significantly.",
        "Initial margin is the minimum deposit to open a position.",
        "Maintenance margin must be maintained to keep positions open.",
        "Leverage allows controlling larger positions with less capital.",
        "Excessive leverage is a common cause of trading losses.",
        "Understanding margin is essential before trading derivatives.",
        "Always use leverage conservatively to manage risk.",
    ],
    'Hedging with Derivatives': [
        "Hedging reduces risk by taking offsetting positions.",
        "Derivatives were originally created for hedging purposes.",
        "Index futures can hedge a diversified equity portfolio.",
        "Options provide more precise hedging with limited cost.",
        "The cost of hedging must be weighed against the protection.",
        "Perfect hedges are rare but partial hedges are practical.",
        "Hedging is essential for professional portfolio management.",
    ],
    'Derivatives Trading Regul': [
        "SEBI regulates derivatives trading to protect investors.",
        "Position limits prevent excessive concentration in contracts.",
        "Margin requirements are set by exchanges and regulators.",
        "Only qualified investors can trade derivatives in India.",
        "Reporting requirements ensure market transparency.",
        "Understanding regulations helps you trade compliantly.",
        "Stay informed about regulatory changes in derivatives markets.",
    ],
    'Behavioral Finance': [
        "Behavioral finance explains why investors make irrational decisions.",
        "Traditional finance assumes rational behavior and efficient markets.",
        "Cognitive biases systematically affect our financial decisions.",
        "Loss aversion makes us feel losses more than equivalent gains.",
        "Overconfidence leads to excessive trading and poor returns.",
        "Understanding biases is the first step to overcoming them.",
        "Behavioral finance helps us become better investors.",
    ],
    'Market Bubbles': [
        "Market bubbles have occurred throughout financial history.",
        "Bubbles follow a pattern of euphoria followed by panic.",
        "The Tulip Mania was one of the first recorded bubbles.",
        "The dot-com bubble showed extreme speculation in technology stocks.",
        "Identifying bubbles requires understanding investor psychology.",
        "Bubbles eventually burst, causing significant wealth destruction.",
        "Learn to recognize and avoid speculative bubbles.",
    ],
    'Herding': [
        "Herding behavior amplifies market movements in both directions.",
        "People follow the crowd because it feels psychologically safe.",
        "Information cascades occur when people assume others know more.",
        "Social pressure makes it difficult to go against the crowd.",
        "Professional fund managers herd to avoid career risk.",
        "Contrarian investing means going against herding behavior.",
        "Understanding herding helps you make independent decisions.",
    ],
    'Mental Accounting': [
        "Mental accounting affects how we treat different money sources.",
        "We tend to spend windfalls more freely than regular income.",
        "Framing effects show that presentation matters in decisions.",
        "How information is presented affects our choices significantly.",
        "Understanding these biases helps us make better decisions.",
        "Recognize when mental accounting is affecting your choices.",
        "Apply rational thinking to all financial decisions equally.",
    ],
    'Nudging': [
        "Choice architecture influences our financial decisions significantly.",
        "Default options are the most powerful type of behavioral nudge.",
        "Automatic enrollment dramatically increases retirement savings.",
        "Smart defaults improve outcomes without restricting freedom.",
        "Small changes in presentation can lead to big behavior changes.",
        "Understanding nudges helps design better financial systems.",
        "Use choice architecture to improve your own financial habits.",
    ],
    'Applied Behavioral': [
        "Knowing about biases is not enough without practical strategies.",
        "An investment policy statement keeps you grounded during volatility.",
        "Pre-commitment devices help you stick to your long-term plan.",
        "Cooling-off periods prevent impulsive financial decisions.",
        "Mental checklists help evaluate decisions systematically.",
        "Accountability partners help you stay disciplined.",
        "Build practical strategies to overcome behavioral biases.",
    ],
    'Advanced Spread': [
        "Advanced spreads allow precise risk-reward customization.",
        "Calendar spreads profit from time decay at different expiries.",
        "Butterfly spreads target a specific price range for profit.",
        "Condors create wide profit zones for range-bound markets.",
        "Diagonal spreads combine different strikes and expiries.",
        "These require deep understanding of options mechanics.",
        "Master these strategies for professional-level trading.",
    ],
    'Volatility Trading': [
        "Volatility trading profits from changes in implied volatility.",
        "Implied volatility reflects market fear and complacency.",
        "Volatility is mean-reverting and tends to return to average.",
        "Vega measures sensitivity to changes in implied volatility.",
        "Volatility strategies can be directional or market neutral.",
        "Understanding volatility is essential for advanced options.",
        "Learn to trade volatility like a professional trader.",
    ],
    'Delta Neutral': [
        "Delta neutral positions have no directional price bias.",
        "Profits come from time decay and volatility changes.",
        "Gamma scalping profits from small price movements.",
        "Delta neutral strategies require active ongoing management.",
        "Short straddles and strangles are classic delta neutral trades.",
        "Iron condors are delta neutral when properly structured.",
        "Master delta neutral strategies for consistent returns.",
    ],
    'Earnings': [
        "Earnings announcements create significant trading opportunities.",
        "Implied volatility rises before earnings announcements.",
        "Volatility crush after earnings hurts long option positions.",
        "Straddles and strangles are popular earnings strategies.",
        "Expected move can be estimated from option prices.",
        "Post-earnings drift can create directional opportunities.",
        "Trade earnings events with a clear plan and risk management.",
    ],
    'Portfolio Hedging': [
        "Portfolio hedging protects your entire investment portfolio.",
        "Index put options are the most common hedging instrument.",
        "Hedging cost typically ranges from half to two percent annually.",
        "Static hedges buy protection and hold to expiry.",
        "Rolling hedges continuously adjust protection levels.",
        "Tail risk hedging protects against extreme market events.",
        "Hedge your portfolio like institutional investors do.",
    ],
    'Option Seller': [
        "Option selling generates income but carries significant risk.",
        "Theta decay works in your favor when selling options.",
        "Most options expire worthless, benefiting sellers.",
        "Margin requirements for sellers can be substantial.",
        "Black swan events pose the greatest risk to sellers.",
        "Risk management is critical for option sellers.",
        "Learn the art and science of professional option selling.",
    ],
    'Capital Gains Taxation': [
        "Capital gains tax depends on holding period and asset type.",
        "Short-term equity gains under 12 months are taxed at 15 percent.",
        "Long-term equity gains over one lakh rupees are taxed at 10 percent.",
        "Debt funds need 36 months for long-term treatment.",
        "Offset losses against gains to reduce tax liability.",
        "Tax loss harvesting is a powerful year-end strategy.",
        "Understanding taxation helps maximize your net returns.",
    ],
    'Dividend & Interest': [
        "Dividends and interest are taxed as per your income slab.",
        "TDS is deducted on dividends exceeding five thousand rupees.",
        "Fixed deposit interest is fully taxable annually.",
        "Savings account interest up to ten thousand is deductible.",
        "Tax-saving FDs have a five-year lock-in period.",
        "Understanding passive income taxation helps with planning.",
        "Structure your investments for tax efficiency.",
    ],
    'Tax-Efficient': [
        "Tax-efficient investing improves your post-tax returns significantly.",
        "Asset location means placing assets in tax-advantaged accounts.",
        "Equity investments benefit from favorable LTCG tax treatment.",
        "Debt investments work well in retirement accounts.",
        "Sovereign gold bonds offer tax-free maturity proceeds.",
        "Tax harvesting at year-end reduces your tax bill.",
        "Plan your investments with tax efficiency in mind.",
    ],
    'Real Estate Taxation': [
        "Real estate has complex tax implications at every stage.",
        "Stamp duty and registration add significant purchase costs.",
        "Rental income is taxed with a thirty percent standard deduction.",
        "Capital gains on property depend on the holding period.",
        "Indexation benefit reduces tax on long-term property gains.",
        "Section 54 allows exemption by reinvesting in another property.",
        "Real estate tax planning requires careful consideration.",
    ],
    'International Investing': [
        "International investing offers diversification beyond Indian markets.",
        "US stocks can be bought through international brokerages.",
        "International mutual funds provide easy global diversification.",
        "US dividends are subject to TDS under the DTAA treaty.",
        "Foreign tax credits can offset double taxation.",
        "Reporting foreign assets is mandatory in tax returns.",
        "International investing requires understanding cross-border taxes.",
    ],
    'Tax Compliance': [
        "Proper tax compliance is essential for every investor.",
        "Choose the correct ITR form based on your income sources.",
        "Capital gains must be reported with accurate cost basis.",
        "Advance tax is due if your total tax exceeds ten thousand rupees.",
        "Filing before the due date allows carry-forward of losses.",
        "Maintain proper records for easy tax filing.",
        "Compliance protects you from penalties and legal issues.",
    ],
    'IPO Basics': [
        "An IPO is when a private company first sells shares to the public.",
        "Companies go public to raise capital for growth and expansion.",
        "The DRHP contains detailed information about the company.",
        "Applying for IPOs is now completely digital through UPI.",
        "GMP or grey market premium indicates expected listing gains.",
        "Having a listing day strategy is essential before applying.",
        "Understand the complete IPO investing process before applying.",
    ],
    'Analyzing IPO': [
        "Before applying for an IPO, analyze the company thoroughly.",
        "Read the DRHP to understand the business model and risks.",
        "Evaluate financial health including revenue and profit growth.",
        "Compare the IPO valuation with industry peers.",
        "Assess the use of funds and management quality.",
        "Check the quality of lead managers and the registrar.",
        "A systematic framework helps evaluate IPO prospects.",
    ],
    'IPO Application': [
        "Applying for an IPO in India is now fully digital.",
        "You need a Demat account, trading account, and UPI ID.",
        "Log in to your broker app and enter your bid details.",
        "Approve the UPI mandate to block funds in your account.",
        "You can bid at the cut-off price or a specific price.",
        "Multiple applications from the same PAN are not allowed.",
        "The allotment process is computerized and transparent.",
    ],
    'Listing Day': [
        "Listing day is when IPO shares begin trading on the exchange.",
        "Decide your strategy before the listing day arrives.",
        "Strong listing gains may be a good time to book profits.",
        "Moderate listing allows holding for long-term appreciation.",
        "Flat or weak listing does not mean the company is bad.",
        "Have a clear plan for what you will do at listing.",
        "Avoid emotional decisions on listing day.",
    ],
    'FPO': [
        "FPOs and OFS are ways for public companies to raise more capital.",
        "Dilutive FPOs issue new shares to raise fresh capital.",
        "OFS involves existing shareholders selling their shares.",
        "Rights issues give existing shareholders first priority.",
        "FPO pricing is typically at a discount to market price.",
        "Analyze the purpose of the fundraise before investing.",
        "FPOs can be opportunities if proceeds are used wisely.",
    ],
    'IPO Portfolio': [
        "A systematic approach to IPO investing manages risk effectively.",
        "Some investors apply for all IPOs and sell on listing day.",
        "Others apply only for quality IPOs and hold long term.",
        "A hybrid approach sells part and holds the rest.",
        "Track your IPO applications and allotment status regularly.",
        "Maintain a portfolio of allotted shares for performance review.",
        "Develop your own consistent IPO investing strategy.",
    ],
    'Budgeting': [
        "Budgeting is the foundation of personal financial success.",
        "Track every expense to understand your spending patterns.",
        "The 50-30-20 rule helps allocate income effectively.",
        "Build an emergency fund of three to six months of expenses.",
        "Pay off high-interest debt before investing aggressively.",
        "Small savings add up significantly over time.",
        "Start budgeting today for a secure financial future.",
    ],
    'Modern Portfolio': [
        "Modern Portfolio Theory revolutionized investing with mathematics.",
        "Diversification reduces risk without sacrificing returns.",
        "The efficient frontier shows optimal portfolios for each risk level.",
        "Asset allocation determines most of your portfolio returns.",
        "Rebalancing maintains your target risk profile over time.",
        "Correlation between assets determines diversification benefits.",
        "Build your portfolio based on Modern Portfolio Theory principles.",
    ],
}

def get_transcript(title):
    """Find best matching transcript for a lesson title."""
    title_lower = title.lower()
    
    # Exact match first
    for key in TRANSCRIPTS:
        if key.lower() == title_lower:
            return TRANSCRIPTS[key]
    
    # Partial match
    for key, lines in TRANSCRIPTS.items():
        if key.lower() in title_lower or title_lower in key.lower():
            return lines
    
    # Keyword match - check individual words
    words = set(title_lower.split())
    for key, lines in TRANSCRIPTS.items():
        key_words = set(key.lower().split())
        if words & key_words:
            return lines
    
    return TRANSCRIPTS['default']

def process_file(filepath):
    """Read file, find lessons without videoUrl, add video+transcript."""
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    lines = content.split('\n')
    new_lines = []
    i = 0
    modified = 0
    total_titles = 0
    skipped_have_video = 0
    skipped_course = 0
    in_lessons_array = False
    
    while i < len(lines):
        line = lines[i]
        stripped = line.strip()
        
        # Track when we enter the realLessons array
        if 'realLessons' in stripped and '[' in stripped:
            in_lessons_array = True
        
        # Check if this is a title line
        if in_lessons_array and stripped.startswith("title: '") and stripped.endswith("',"):
            total_titles += 1
            title_match = re.match(r"\s*title: '(.+?)',", line)
            if title_match:
                title = title_match.group(1)
                
                # Scan forward up to 30 lines to see if videoUrl exists
                has_video_url = False
                found_content = False
                for scan in range(1, 30):
                    if i + scan >= len(lines):
                        break
                    check = lines[i + scan].strip()
                    if check.startswith('videoUrl:'):
                        has_video_url = True
                        break
                    if check.startswith('content:'):
                        found_content = True
                        break
                
                if has_video_url:
                    skipped_have_video += 1
                    new_lines.append(line)
                    i += 1
                    continue
                
                if not found_content:
                    skipped_course += 1
                    new_lines.append(line)
                    i += 1
                    continue
                
                # Add video fields
                transcript_lines = get_transcript(title)
                indent = '    '
                video_block = (
                    f"{indent}videoUrl: '{SAMPLE_VIDEO}',\n"
                    f"{indent}videoThumbnail: '\U0001f4f9',\n"
                    f"{indent}transcript: [\n"
                )
                for idx, tl in enumerate(transcript_lines):
                    start = idx * 10
                    end = start + 10
                    safe_tl = tl.replace("'", "\\'")
                    video_block += f"{indent}  {{ startTime: {start}, endTime: {end}, text: '{safe_tl}', speaker: 'Instructor' }},\n"
                video_block += f"{indent}],\n"
                
                new_lines.append(line)
                new_lines.append(video_block)
                modified += 1
                if modified <= 10:
                    print(f"  OK: Added to '{title}'")
                i += 1
                continue
        
        new_lines.append(line)
        i += 1
    
    result = '\n'.join(new_lines)
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(result)
    
    return modified, total_titles, skipped_have_video, skipped_course

if __name__ == '__main__':
    filepath = Path(__file__).parent.parent / 'src' / 'constants' / 'courseContent.ts'
    if not filepath.exists():
        print(f"Error: {filepath} not found")
        sys.exit(1)
    
    m, total, sv, sc = process_file(str(filepath))
    print(f"Total titles: {total}")
    print(f"Already had video: {sv}")
    print(f"Course titles (skipped): {sc}")
    print(f"Modified: {m}")
