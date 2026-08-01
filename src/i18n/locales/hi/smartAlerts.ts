// स्मार्ट प्राइस अलर्ट namespace — SmartPriceAlertsScreen द्वारा उपयोग की गई पूरी key set
export default {
    // Screen / header
    title: 'स्मार्ट प्राइस अलर्ट',
    activeAlerts: 'सक्रिय अलर्ट ({{count}})',
    pausedAlerts: 'रुके हुए अलर्ट ({{count}})',
    newTriggers: '{{count}} नए ट्रिगर',
    sectionActive: 'सक्रिय',
    sectionPaused: 'रुके हुए ({{count}})',
    alertHistory: 'अलर्ट इतिहास',
    alertTemplates: 'अलर्ट टेम्पलेट्स',

    // Empty states
    noAlerts: 'कोई सक्रिय अलर्ट नहीं',
    noAlertsSub: 'अपनी शर्तें पूरी होने पर सूचना पाने के लिए अलर्ट बनाएं',
    noConditions: 'अभी कोई शर्त नहीं जोड़ी गई। शर्त जोड़ें पर टैप करें।',
    noHistory: 'कोई अलर्ट ट्रिगर नहीं',
    noHistorySub: 'ट्रिगर किए गए अलर्ट यहां दिखेंगे',

    // Quick create
    quickCreate: 'त्वरित बनाएं',
    quickCreateSub: 'तुरंत अलर्ट बनाने के लिए शर्त पर टैप करें',

    // Info card
    infoText: 'स्मार्ट अलर्ट हर प्राइस टिक पर आपकी शर्तों की जांच करते हैं।',
    infoLongPress: 'अलर्ट हटाने के लिए देर तक दबाएं, या संपादित करने के लिए टैप करें।',

    // Form labels
    alertName: 'अलर्ट का नाम',
    alertNamePlaceholder: 'अलर्ट का नाम',
    symbol: 'सिंबल',
    symbolPlaceholder: 'RELIANCE',
    stockName: 'स्टॉक का नाम',
    stockNamePlaceholder: 'रिलायंस इंडस्ट्रीज',
    conditionLogic: 'शर्त लॉजिक',
    condition: '{{count}} शर्त(एं)',
    conditions: 'शर्तें ({{count}})',
    cooldownMin: 'कूलडाउन (मिनट)',
    cooldownMinShort: '{{count}}मि',
    cooldownHourShort: '{{count}}घं',
    badgeCount: 'बैज',
    addCondition: 'शर्त जोड़ें',
    addConditionTitle: 'शर्त जोड़ें',

    // Modal / actions
    newAlert: 'नया अलर्ट',
    editAlert: 'अलर्ट संपादित करें',
    save: 'सहेजें',
    testAlert: 'अलर्ट टेस्ट करें',
    testTitle: 'अलर्ट टेस्ट: {{name}}',
    testWouldFire: 'ट्रिगर होगा',
    testNoTrigger: 'ट्रिगर नहीं होगा',
    deleteTitle: 'अलर्ट हटाएं',
    deleteConfirm: '{{name}} ({{symbol}}) हटाएं?',

    // Validation
    errorNameRequired: 'अलर्ट का नाम आवश्यक है',
    errorSymbolRequired: 'सिंबल आवश्यक है',
    errorConditionsRequired: 'कम से कम एक शर्त जोड़ें',

    // Condition kinds — labels
    priceAbove: 'मूल्य ऊपर पार करे',
    priceBelow: 'मूल्य नीचे पार करे',
    priceChangePct: 'मूल्य परिवर्तन %',
    gapUp: 'गैप अप',
    gapDown: 'गैप डाउन',
    volumeSpike: 'वॉल्यूम स्पाइक',
    volumeDrop: 'वॉल्यूम गिरावट',
    rsiOversold: 'RSI ओवरसोल्ड',
    rsiOverbought: 'RSI ओवरबॉट',
    rsiCrossAbove: 'RSI ऊपर पार करे',
    rsiCrossBelow: 'RSI नीचे पार करे',
    maCrossover: 'MA क्रॉसओवर',
    maCrossunder: 'MA क्रॉसअंडर',
    candlePattern: 'कैंडल पैटर्न',
    consecGains: 'लगातार लाभ',
    consecLosses: 'लगातार हानि',
    breakoutHigh: 'ब्रेकआउट हाई',
    breakoutLow: 'ब्रेकआउट लो',

    // Condition kinds — descriptions
    descPriceAbove: 'जब मूल्य निर्धारित सीमा से ऊपर पार करे तब ट्रिगर होगा',
    descPriceBelow: 'जब मूल्य निर्धारित सीमा से नीचे पार करे तब ट्रिगर होगा',
    descPriceChangePct: 'जब मूल्य निर्धारित प्रतिशत से बदले तब ट्रिगर होगा',
    descGapUp: 'जब मूल्य निर्धारित प्रतिशत से गैप अप करे तब ट्रिगर होगा',
    descGapDown: 'जब मूल्य निर्धारित प्रतिशत से गैप डाउन करे तब ट्रिगर होगा',
    descVolumeSpike: 'जब वॉल्यूम गुणक से ऊपर बढ़े तब ट्रिगर होगा',
    descVolumeDrop: 'जब वॉल्यूम गुणक से नीचे गिरे तब ट्रिगर होगा',
    descRsiOversold: 'जब RSI ओवरसोल्ड स्तर से नीचे आए तब ट्रिगर होगा',
    descRsiOverbought: 'जब RSI ओवरबॉट स्तर से ऊपर जाए तब ट्रिगर होगा',
    descRsiCrossAbove: 'जब RSI स्तर से ऊपर पार करे तब ट्रिगर होगा',
    descRsiCrossBelow: 'जब RSI स्तर से नीचे पार करे तब ट्रिगर होगा',
    descMaCrossover: 'जब फास्ट MA स्लो MA से ऊपर पार करे तब ट्रिगर होगा',
    descMaCrossunder: 'जब फास्ट MA स्लो MA से नीचे पार करे तब ट्रिगर होगा',
    descCandlePattern: 'जब कैंडल पैटर्न दिखे तब ट्रिगर होगा',
    descConsecutiveGain: 'लगातार N दिन लाभ के बाद ट्रिगर होगा',
    descConsecutiveLoss: 'लगातार N दिन हानि के बाद ट्रिगर होगा',
    descBreakoutHigh: 'जब मूल्य N-दिन के हाई से ऊपर ब्रेक करे तब ट्रिगर होगा',
    descBreakoutLow: 'जब मूल्य N-दिन के लो से नीचे ब्रेक करे तब ट्रिगर होगा',

    // Condition chip short formats
    fmtAvg: 'औसत',
    fmtDays: 'दिन',
    fmtBarHigh: 'बार हाई',
    fmtBarLow: 'बार लो',

    // Category tabs
    catPrice: 'मूल्य',
    catVolume: 'वॉल्यूम',
    catIndicator: 'इंडिकेटर',
    catPattern: 'पैटर्न',
    catTrend: 'रुझान',

    // Time ago
    justNow: 'अभी अभी',
    minAgo: '{{count}} मिनट पहले',
    hourAgo: '{{count}} घंटे पहले',
    dayAgo: '{{count}} दिन पहले',

    // Triggered state
    triggered: '{{time}} पर ट्रिगर हुआ',
};
