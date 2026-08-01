// Smart Price Alerts namespace — full key set used by SmartPriceAlertsScreen
export default {
    // Screen / header
    title: 'Smart Price Alerts',
    activeAlerts: 'Active Alerts ({{count}})',
    pausedAlerts: 'Paused Alerts ({{count}})',
    newTriggers: '{{count}} new trigger(s)',
    sectionActive: 'Active',
    sectionPaused: 'Paused ({{count}})',
    alertHistory: 'Alert History',
    alertTemplates: 'Alert Templates',

    // Empty states
    noAlerts: 'No Active Alerts',
    noAlertsSub: 'Create an alert to get notified when your conditions are met',
    noConditions: 'No conditions added yet. Tap Add Condition.',
    noHistory: 'No Alerts Triggered',
    noHistorySub: 'Triggered alerts will appear here',

    // Quick create
    quickCreate: 'Quick Create',
    quickCreateSub: 'Tap a condition to create an alert instantly',

    // Info card
    infoText: 'Smart alerts check your conditions on every price tick.',
    infoLongPress: 'Long-press an alert to delete it, or tap to edit.',

    // Form labels
    alertName: 'Alert Name',
    alertNamePlaceholder: 'Alert name',
    symbol: 'Symbol',
    symbolPlaceholder: 'RELIANCE',
    stockName: 'Stock Name',
    stockNamePlaceholder: 'Reliance Industries',
    conditionLogic: 'Condition Logic',
    condition: '{{count}} condition(s)',
    conditions: 'Conditions ({{count}})',
    cooldownMin: 'Cooldown (min)',
    cooldownMinShort: '{{count}}m',
    cooldownHourShort: '{{count}}h',
    badgeCount: 'Badge',
    addCondition: 'Add Condition',
    addConditionTitle: 'Add Condition',

    // Modal / actions
    newAlert: 'New Alert',
    editAlert: 'Edit Alert',
    save: 'Save',
    testAlert: 'Test Alert',
    testTitle: 'Test Alert: {{name}}',
    testWouldFire: 'Would trigger',
    testNoTrigger: 'Would NOT trigger',
    deleteTitle: 'Delete Alert',
    deleteConfirm: 'Delete {{name}} ({{symbol}})?',

    // Validation
    errorNameRequired: 'Alert name is required',
    errorSymbolRequired: 'Symbol is required',
    errorConditionsRequired: 'Add at least one condition',

    // Condition kinds — labels
    priceAbove: 'Price Crosses Above',
    priceBelow: 'Price Crosses Below',
    priceChangePct: 'Price Change %',
    gapUp: 'Gap Up',
    gapDown: 'Gap Down',
    volumeSpike: 'Volume Spike',
    volumeDrop: 'Volume Drop',
    rsiOversold: 'RSI Oversold',
    rsiOverbought: 'RSI Overbought',
    rsiCrossAbove: 'RSI Crosses Above',
    rsiCrossBelow: 'RSI Crosses Below',
    maCrossover: 'MA Crossover',
    maCrossunder: 'MA Crossunder',
    candlePattern: 'Candle Pattern',
    consecGains: 'Consecutive Gains',
    consecLosses: 'Consecutive Losses',
    breakoutHigh: 'Breakout High',
    breakoutLow: 'Breakout Low',

    // Condition kinds — descriptions
    descPriceAbove: 'Fires when price crosses above the set threshold',
    descPriceBelow: 'Fires when price crosses below the set threshold',
    descPriceChangePct: 'Fires when price changes by the set percentage',
    descGapUp: 'Fires when price gaps up by the set percentage',
    descGapDown: 'Fires when price gaps down by the set percentage',
    descVolumeSpike: 'Fires when volume spikes above the multiplier',
    descVolumeDrop: 'Fires when volume drops below the multiplier',
    descRsiOversold: 'Fires when RSI drops below the oversold level',
    descRsiOverbought: 'Fires when RSI rises above the overbought level',
    descRsiCrossAbove: 'Fires when RSI crosses above the level',
    descRsiCrossBelow: 'Fires when RSI crosses below the level',
    descMaCrossover: 'Fires when the fast MA crosses above the slow MA',
    descMaCrossunder: 'Fires when the fast MA crosses below the slow MA',
    descCandlePattern: 'Fires when the candle pattern appears',
    descConsecutiveGain: 'Fires after N consecutive gaining days',
    descConsecutiveLoss: 'Fires after N consecutive losing days',
    descBreakoutHigh: 'Fires when price breaks above the N-period high',
    descBreakoutLow: 'Fires when price breaks below the N-period low',

    // Condition chip short formats
    fmtAvg: 'avg',
    fmtDays: 'days',
    fmtBarHigh: 'bar high',
    fmtBarLow: 'bar low',

    // Category tabs
    catPrice: 'Price',
    catVolume: 'Volume',
    catIndicator: 'Indicators',
    catPattern: 'Patterns',
    catTrend: 'Trend',

    // Time ago
    justNow: 'Just now',
    minAgo: '{{count}}m ago',
    hourAgo: '{{count}}h ago',
    dayAgo: '{{count}}d ago',

    // Triggered state
    triggered: 'Triggered {{time}}',
};
