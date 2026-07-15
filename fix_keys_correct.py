import os

root = r"C:\Users\Karan\Desktop\New folder\Toroloom"

prefix_map = {
    "src/screens/achievements/AchievementsScreen.tsx": "ach",
    "src/screens/ai/AIChatScreen.tsx": "chat",
    "src/screens/ai/AIInsightsScreen.tsx": "insight",
    "src/screens/ai/AITradeAssistantScreen.tsx": "assist",
    "src/screens/ai/EarningsCallScreen.tsx": "earn",
    "src/screens/broker/BrokerConnectScreen.tsx": "broker",
    "src/screens/broker/ConnectBrokerView.tsx": "cbv",
    "src/screens/community/PostDetailScreen.tsx": "post",
    "src/screens/education/GlossaryScreen.tsx": "gloss",
    "src/screens/funds/FundsDashboardScreen.tsx": "fund",
    "src/screens/kyc/DigiLockerScreen.tsx": "digi",
    "src/screens/news/IPOCalendarScreen.tsx": "ipo",
    "src/screens/onboarding/OnboardingScreen.tsx": "onbd",
    "src/screens/reports/ContractNoteUploadScreen.tsx": "cntr",
    "src/screens/reports/ReportsScreen.tsx": "rpt",
    "src/screens/settings/TelegramConnectScreen.tsx": "tele",
    "src/screens/settings/TwoFactorSetupScreen.tsx": "tfa",
    "src/screens/settings/WidgetSettingsScreen.tsx": "wgt",
    "src/screens/social/TraderProfileScreen.tsx": "tp",
    "src/screens/stock/StockScreenerScreen.tsx": "scr",
    "src/screens/support/HelpScreen.tsx": "help",
    "src/screens/tabs/LearnScreen.tsx": "learn",
    "src/screens/tabs/MarketsScreen.tsx": "mkt",
    "src/screens/tabs/PortfolioScreen.tsx": "port",
    "src/screens/tabs/WatchlistScreen.tsx": "watch",
}

for rel_path, prefix in prefix_map.items():
    full_path = os.path.join(root, rel_path)
    if not os.path.exists(full_path):
        print(f"MISSING: {rel_path}")
        continue
    
    with open(full_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Fix: key={prefix_$i} -> key={`prefix_${i}`}
    # The broken pattern is: key={PREFIX_$i}
    # The correct replacement: key={`PREFIX_${i}`}
    
    old = 'key={' + prefix + '_$i}'
    # Build replacement: key={`PREFIX_${i}`}
    # In JSX: key={`prefix_${i}`}
    new = 'key={`' + prefix + '_${i}`}'
    
    if old in content:
        count = content.count(old)
        content = content.replace(old, new)
        with open(full_path, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"FIXED: {rel_path} ({count} occ)")
    else:
        print(f"NO MATCH: {rel_path}")

print("\nDone! All files should now have correct key={`prefix_${i}`} syntax.")
