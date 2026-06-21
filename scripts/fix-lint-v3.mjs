import fs from 'fs';

function fix(filePath, callback) {
  if (!fs.existsSync(filePath)) {
    console.log('NOT FOUND:', filePath);
    return;
  }
  let content = fs.readFileSync(filePath, 'utf8');
  const orig = content;
  content = callback(content);
  if (content !== orig) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('FIXED:', filePath);
  } else {
    console.log('NO CHANGE:', filePath);
  }
}

// ====================================================================

fix('src/__tests__/BrokerConnectScreen.test.tsx', (c) => {
  // Remove 'const { getByText }' from: "renders the subtitle asking to switch broker"
  c = c.replace(
    "    const { getByText } = render(\n      <BrokerConnectScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />,\n    );\n    await advanceAndFlush();\n\n    expect(getByText('Switch to a different broker below')).toBeDefined();",
    "    render(\n      <BrokerConnectScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />,\n    );\n    await advanceAndFlush();\n\n    expect(getByText('Switch to a different broker below')).toBeDefined();"
  );
  // Remove 'const { getByText }' from: "still renders Connect text"
  c = c.replace(
    "    const { getByText } = render(\n      <BrokerConnectScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />,\n    );\n    await advanceAndFlush();\n\n    // Zerodha and Groww are not the connected broker (Angel is), so they show Connect\n    expect(getByText('Connect via OAuth')).toBeDefined();",
    "    render(\n      <BrokerConnectScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />,\n    );\n    await advanceAndFlush();\n\n    // Zerodha and Groww are not the connected broker (Angel is), so they show Connect\n    expect(getByText('Connect via OAuth')).toBeDefined();"
  );
  return c;
});

fix('src/__tests__/Button.test.tsx', (c) => {
  c = c.replace(
    "    const { getByText, root } = render(\n      <Button title=\"Disabled\" onPress={() => {}} disabled />\n    );",
    "    const { root } = render(\n      <Button title=\"Disabled\" onPress={() => {}} disabled />\n    );"
  );
  c = c.replace(
    "    const { getByText } = render(\n      <Button title=\"Loading\" onPress={onPress} loading />\n    );",
    "    render(\n      <Button title=\"Loading\" onPress={onPress} loading />\n    );"
  );
  return c;
});

fix('src/__tests__/ContractNoteUploadScreen.test.tsx', (c) => {
  c = c.replace(
    "      let resolveExport!: (v: any) => void;\n      mockExportSingle.mockImplementationOnce(() => new Promise(r => { resolveExport = r; }));",
    "      mockExportSingle.mockImplementationOnce(() => new Promise(() => {}));"
  );
  return c;
});

fix('src/__tests__/IronLockOverlay.test.tsx', (c) => {
  c = c.replace(
    "    const { getByText } = renderAndTransition(\n      { lockdown: { status: 'active', triggeredAt: '2025-06-01T10:00:00Z', liftsAt: new Date(Date.now() + 3600000).toISOString(), triggerLoss: 55000, breachedLimit: 'daily_loss' } },\n    );\n    expect(getByText('Financial Bodyguard engaged')).toBeDefined();",
    "    renderAndTransition(\n      { lockdown: { status: 'active', triggeredAt: '2025-06-01T10:00:00Z', liftsAt: new Date(Date.now() + 3600000).toISOString(), triggerLoss: 55000, breachedLimit: 'daily_loss' } },\n    );\n    expect(getByText('Financial Bodyguard engaged')).toBeDefined();"
  );
  return c;
});

fix('src/__tests__/LoginScreen.test.tsx', (c) => {
  c = c.replace(
    "    const { getByText, getByPlaceholderText } = render(<LoginScreen navigation={{ navigate: mockNavigate }} />);\n    advanceAndRender(500);\n\n    act(() => { fireEvent.press(getByText('Log In')); });\n    advanceAndRender(100);\n    expect(getByText('Please enter email and password')).toBeDefined();\n    expect(mockLogin).not.toHaveBeenCalled();",
    "    const { getByText } = render(<LoginScreen navigation={{ navigate: mockNavigate }} />);\n    advanceAndRender(500);\n\n    act(() => { fireEvent.press(getByText('Log In')); });\n    advanceAndRender(100);\n    expect(getByText('Please enter email and password')).toBeDefined();\n    expect(mockLogin).not.toHaveBeenCalled();"
  );
  return c;
});

fix('src/__tests__/testUtils.tsx', (c) => {
  c = c.replace("import React, { act } from 'react';", "import { act } from 'react';");
  return c;
});

fix('src/__tests__/mockWebSocketService.test.ts', (c) => {
  c = c.replace(
    "      const changedPrice = mockWebSocket.getCurrentPrice('RELIANCE');\n\n      mockWebSocket.reset();",
    "      mockWebSocket.getCurrentPrice('RELIANCE');\n\n      mockWebSocket.reset();"
  );
  return c;
});

fix('src/__tests__/portfolioAnalyticsStore.test.ts', (c) => {
  c = c.replace(
    "      const currentPrice = ws.getCurrentPrice('RELIANCE');\n      const newValue = Math.round(currentPrice * 50 * 100) / 100;\n\n      // Manually trigger a portfolioStore change",
    "      const currentPrice = ws.getCurrentPrice('RELIANCE');\n\n      // Manually trigger a portfolioStore change"
  );
  c = c.replace(
    "    // Read current WS price for RELIANCE\n    const livePrice = ws.getCurrentPrice('RELIANCE');\n\n    // Trigger portfolioStore update",
    "    // Trigger portfolioStore update"
  );
  return c;
});

// Component files
fix('src/components/IronLockOverlay.tsx', (c) => {
  c = c.replace("import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';", "import React, { useState, useEffect, useRef, useMemo } from 'react';");
  c = c.replace("    const { colors } = useTheme();\n    const { isDark } = useTheme();", "    const { isDark } = useTheme();");
  return c;
});

fix('src/components/PnLChart.tsx', (c) => {
  c = c.replace("import { Svg, G, Path, Defs, LinearGradient, Stop, Rect, Text as SvgText } from 'react-native-svg';", "import { Svg, Path, Defs, LinearGradient, Stop, Rect, Text as SvgText } from 'react-native-svg';");
  return c;
});

fix('src/components/StockChart.tsx', (c) => {
  c = c.replace("import { Svg, G, Path, Line, Defs, LinearGradient, Stop, Rect, Text as SvgText } from 'react-native-svg';", "import { Svg, Path, Line, Defs, LinearGradient, Stop, Rect, Text as SvgText } from 'react-native-svg';");
  return c;
});

fix('src/components/TechnicalIndicators.tsx', (c) => {
  c = c.replace("import { Svg, G, Path, Line, Defs, LinearGradient, Stop, Text as SvgText } from 'react-native-svg';", "import { Svg, Path, Line, Defs, LinearGradient, Stop } from 'react-native-svg';");
  c = c.replace("const lastHistogram =", "const _lastHistogram =");
  c = c.replace("const lastIdx =", "const _lastIdx =");
  c = c.replace("const lastMiddle =", "const _lastMiddle =");
  c = c.replace("compact,", "compact: _compact,");
  return c;
});

fix('src/components/gateway/SecureSessionSync.tsx', (c) => {
  c = c.replace("const isMfaUrl =", "const _isMfaUrl =");
  c = c.replace("} catch (err) {", "} catch (_err) {");
  return c;
});

fix('src/components/ui/Button.tsx', (c) => {
  c = c.replace("import React, { useCallback, useMemo, useRef } from 'react';", "import React, { useMemo, useRef } from 'react';");
  return c;
});

fix('src/components/ui/SkeletonLoader.tsx', (c) => {
  c = c.replace("import React, { useMemo, useRef, useEffect } from 'react';", "import React, { useRef, useEffect } from 'react';");
  return c;
});

// Hooks
fix('src/hooks/useNotificationSetup.ts', (c) => {
  c = c.replace("function getScreenForType(type: NotificationType): string {", "function _getScreenForType(type: NotificationType): string {");
  return c;
});

// Navigation
fix('src/navigation/AppNavigator.tsx', (c) => {
  c = c.replace("import React, { useMemo, useEffect, useState } from 'react';", "import React, { useEffect, useState } from 'react';");
  return c;
});

// Screen files
fix('src/screens/NotificationsScreen.tsx', (c) => {
  c = c.replace("const addPriceAlertRule =", "const _addPriceAlertRule =");
  return c;
});

fix('src/screens/chat/ChatRoomListScreen.tsx', (c) => {
  c = c.replace("import React, { useState, useEffect, useCallback, Animated, Platform } from 'react';", "import React, { useState, useEffect, useCallback } from 'react';");
  c = c.replace("const { activeRoomId, typingUsers }", "const { activeRoomId: _activeRoomId, typingUsers: _typingUsers }");
  return c;
});

fix('src/screens/community/CommunityScreen.tsx', (c) => {
  c = c.replace("import Card from '../../components/ui/Card';\n", "");
  return c;
});

fix('src/screens/education/CourseDetailScreen.tsx', (c) => {
  c = c.replace("const { currentLesson }", "const { currentLesson: _currentLesson }");
  c = c.replace("const handleMarkComplete =", "const _handleMarkComplete =");
  return c;
});

fix('src/screens/funds/FundsDashboardScreen.tsx', (c) => {
  c = c.replace("import React, { useState, useEffect, useCallback } from 'react';", "import React, { useEffect, useCallback } from 'react';");
  return c;
});

fix('src/screens/journal/BehavioralJournalScreen.tsx', (c) => {
  c = c.replace(
    "  const [showEntryModal, setShowEntryModal, editingEntry, setEditingEntry] = useState(false);",
    "  const [_showEntryModal, _setShowEntryModal, _editingEntry, _setEditingEntry] = useState(false);"
  );
  return c;
});

fix('src/screens/mutual-funds/MutualFundsScreen.tsx', (c) => {
  c = c.replace("const riskColors =", "const _riskColors =");
  return c;
});

fix('src/screens/onboarding/OnboardingScreen.tsx', (c) => {
  c = c.replace("import React, { useRef, useState, useMemo } from 'react';", "import React, { useRef, useState } from 'react';");
  c = c.replace("import { View, Text, StyleSheet, Dimensions, Platform } from 'react-native';", "import { View, Text, StyleSheet, Dimensions } from 'react-native';");
  c = c.replace("const _MAX_CARDS = 10;", "// const _MAX_CARDS = 10;");
  return c;
});

fix('src/screens/reports/ContractNoteUploadScreen.tsx', (c) => {
  c = c.replace("const _SCREEN_WIDTH =", "const SCREEN_WIDTH =");
  return c;
});

fix('src/screens/reports/ReportsScreen.tsx', (c) => {
  c = c.replace("import AnimatedPressable from '../../components/ui/AnimatedPressable';\n", "");
  c = c.replace("const [showAllMetrics, setShowAllMetrics] =", "const [_showAllMetrics, _setShowAllMetrics] =");
  c = c.replace("const coloredValue =", "const _coloredValue =");
  c = c.replace("} catch (err) {", "} catch (_err) {");
  return c;
});

fix('src/screens/settings/PortfolioAlertsScreen.tsx', (c) => {
  c = c.replace("const holdingInfos =", "const _holdingInfos =");
  c = c.replace("const hi =", "const _hi =");
  return c;
});

fix('src/screens/settings/RiskSettingsScreen.tsx', (c) => {
  c = c.replace("const canTrade =", "const _canTrade =");
  c = c.replace("const exitOnly =", "const _exitOnly =");
  return c;
});

fix('src/screens/settings/TenantConfigScreen.tsx', (c) => {
  c = c.replace("import React, { useState, useEffect } from 'react';", "import React, { useState } from 'react';");
  return c;
});

fix('src/screens/stock/StockDetailScreen.tsx', (c) => {
  c = c.replace("const { symbol }", "const { symbol: _symbol }");
  c = c.replace("const changeColor =", "const _changeColor =");
  return c;
});

fix('src/screens/tabs/HomeScreen.tsx', (c) => {
  c = c.replace("const totalPnlPercent =", "const _totalPnlPercent =");
  return c;
});

fix('src/screens/tabs/LearnScreen.tsx', (c) => {
  c = c.replace("import React, { useRef } from 'react';", "import React from 'react';");
  c = c.replace("import Card from '../../components/ui/Card';\n", "");
  return c;
});

fix('src/screens/tabs/PortfolioScreen.tsx', (c) => {
  c = c.replace("const pnlPercent =", "const _pnlPercent =");
  return c;
});

fix('src/screens/tabs/WatchlistScreen.tsx', (c) => {
  c = c.replace("import React, { useRef, useState, useCallback } from 'react';", "import React, { useState, useCallback } from 'react';");
  c = c.replace("const activeAlertSymbols =", "const _activeAlertSymbols =");
  return c;
});

fix('src/screens/trade/PlaceOrderScreen.tsx', (c) => {
  c = c.replace("import React, { useRef, useState, useCallback, useMemo } from 'react';", "import React, { useState, useCallback, useMemo } from 'react';");
  c = c.replace("import Card from '../../components/ui/Card';\n", "");
  c = c.replace("const [showOrderTypes, setShowOrderTypes] =", "const [_showOrderTypes, _setShowOrderTypes] =");
  c = c.replace("const [showProductTypes, setShowProductTypes] =", "const [_showProductTypes, _setShowProductTypes] =");
  c = c.replace("} catch (err) {", "} catch (_err) {");
  return c;
});

// Service/Store files
fix('src/services/gateway/tradeLedgerParser.ts', (c) => {
  c = c.replace("const PATTERNS =", "const _PATTERNS =");
  return c;
});

fix('src/store/fundStore.ts', (c) => {
  c = c.replace("const makeDateLabel =", "const _makeDateLabel =");
  c = c.replace("const yesterday =", "const _yesterday =");
  return c;
});

fix('src/store/notificationStore.ts', (c) => {
  c = c.replace("let [h, m] = date", "const [h, _m] = date");
  return c;
});

fix('src/store/portfolioAnalyticsStore.ts', (c) => {
  c = c.replace("const winningHoldings =", "const _winningHoldings =");
  c = c.replace("const losingHoldings =", "const _losingHoldings =");
  c = c.replace("const buyTrades =", "const _buyTrades =");
  return c;
});

console.log('Script executed successfully!');
