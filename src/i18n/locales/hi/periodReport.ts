// Period Report — साप्ताहिक और मासिक P&L, टैक्स और व्यवहार संबंधी अलर्ट
export default {
  title: 'अवधि रिपोर्ट',
  subtitle: 'साप्ताहिक और मासिक प्रदर्शन अवलोकन',
  weekly: 'साप्ताहिक',
  monthly: 'मासिक',
  yearly: 'वार्षिक',
  all: 'सभी',

  // P&L Summary
  pnlSummary: 'P&L सारांश',
  totalPnl: 'कुल P&L',
  realizedPnl: 'वास्तविक P&L',
  unrealizedPnl: 'अवास्तविक P&L',
  dayPnl: 'दिवसीय P&L',
  periodReturn: 'अवधि रिटर्न',
  bestTrade: 'सबसे अच्छा ट्रेड',
  worstTrade: 'सबसे खराब ट्रेड',
  winRate: 'जीत दर',
  totalTrades: 'कुल ट्रेड',

  // Tax Section
  taxSummary: 'कर सारांश',
  estimatedTax: 'अनुमानित कर',
  stcgLabel: 'अल्पकालिक (15%)',
  ltcgLabel: 'दीर्घकालिक (10%)',
  taxableGains: 'कर योग्य लाभ',
  taxExemptLimit: '₹1L छूट',
  taxHarvestingTip: 'पूंजीगत लाभ को ऑफसेट करने के लिए वर्ष के अंत से पहले अवास्तविक घाटे की कटाई करें।',

  // Behavioral / Overtrading
  behavioralInsights: 'व्यवहार संबंधी जानकारी',
  overTradingAlert: 'ओवर-ट्रेडिंग अलर्ट',
  overTradingDesc: 'दैनिक ट्रेड संख्या अनुशंसित सीमा से अधिक',
  brokerageLeakage: 'ब्रोकरेज लीकेज',
  brokerageLeakageDesc: 'शुल्क P&L का महत्वपूर्ण हिस्सा खा रहे हैं',
  concentrationRisk: 'एकाग्रता जोखिम',
  concentrationRiskDesc: 'पोर्टफोलियो एक क्षेत्र में अत्यधिक केंद्रित',
  behavioralCritique: 'व्यवहार समीक्षा',
  noAlerts: 'कोई व्यवहार अलर्ट नहीं — संतुलित ट्रेडिंग',

  // Period breakdown
  weekLabel: 'सप्ताह {{label}}',
  monthLabel: '{{month}} {{year}}',
  profitLabel: 'लाभ',
  lossLabel: 'हानि',
  tradesCount: '{{count}} ट्रेड',
  pnlAmount: '₹{{amount}}',
  returnPercent: '{{percent}}%',

  // Period details
  periodDetails: 'अवधि विवरण',
  noData: 'इस अवधि के लिए कोई ट्रेड डेटा नहीं',
  loading: 'रिपोर्ट लोड हो रही है...',
  refresh: 'रीफ्रेश करें',
  avgWin: 'औसत जीत',
  avgLoss: 'औसत हानि',
  profitFactor: 'लाभ कारक',
  sharpeRatio: 'शार्प अनुपात',
  maxDrawdown: 'अधिकतम गिरावट',
  avgHoldingDays: 'औसत होल्डिंग दिन',
  bestPerformer: 'सर्वश्रेष्ठ प्रदर्शनकर्ता',
  worstPerformer: 'सबसे खराब प्रदर्शनकर्ता',

  // Period comparison
  comparison: 'अवधि तुलना',
  previousPeriod: 'पिछली अवधि',
  currentPeriod: 'वर्तमान अवधि',
  changeLabel: 'परिवर्तन',
  improving: 'सुधार',
  declining: 'गिरावट',

  // Loss breakdown
  lossBreakdown: 'हानि विवरण',
  lossByStock: 'स्टॉक के अनुसार हानि',
  topLosers: 'शीर्ष हानि',
  lossBySector: 'सेक्टर के अनुसार हानि',
  totalSectorLoss: 'कुल सेक्टर हानि',
  sectorsWithLoss: '{{count}} सेक्टर हानि में',
  noLosers: 'इस अवधि में कोई हानि वाली पोजीशन नहीं',
  lossAmount: 'हानि: {{amount}}',
  lossPercent: '{{percent}}% नीचे',
  sectorLossAmount: '{{sector}}: {{amount}}',
  tapToExpand: 'विस्तार करें',
  tapToCollapse: 'संक्षिप्त करें',
  showDetails: 'विवरण दिखाएं',
  hideDetails: 'विवरण छुपाएं',
  holdingDays: '{{days}} दिन होल्ड',

  // Sector-wise metrics
  sectorMetrics: 'सेक्टर-वार मेट्रिक्स',
  sectorWins: 'जीत',
  sectorLosses: 'हार',
  winLossLabel: 'जी/हा',
  sectorAvgWin: 'औसत जीत',
  sectorAvgLoss: 'औसत हानि',
  sectorProfitFactor: 'PF',
  noTradeData: 'कोई सेक्टर ट्रेड डेटा नहीं',

  // Export PDF
  exportPdf: 'PDF एक्सपोर्ट करें',
  exportingPdf: 'PDF जनरेट हो रहा है...',
  pdfGenerated: 'PDF सफलतापूर्वक सेव हो गया',
  pdfFailed: 'PDF जनरेट नहीं हो सका',
  pdfSharingUnavailable: 'इस डिवाइस पर शेयरिंग उपलब्ध नहीं है',

  // Empty state
  emptyTitle: 'अभी तक कोई डेटा नहीं',
  emptySubtitle: 'अपनी अवधि रिपोर्ट देखने के लिए ट्रेडिंग शुरू करें',
};
