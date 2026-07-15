import os, re

root = r"C:\Users\Karan\Desktop\New folder\Toroloom"

files_regex = {
    "src/screens/achievements/AchievementsScreen.tsx": r"(nextRewards\.map\s*\([^)]+\)\s*=>\s*\n\s*<View\s+)key=\{i\}",
    "src/screens/funds/FundsDashboardScreen.tsx": r"(quickActions\.map\s*\([^)]+\)\s*=>\s*\n\s*<TouchableOpacity\s+)key=\{i\}",
    "src/screens/education/GlossaryScreen.tsx": r"(tags\.map\s*\([^)]+\)\s*=>\s*\n\s*<View\s+)key=\{i\}",
    "src/screens/community/PostDetailScreen.tsx": r"(\[1,\s*2,\s*3\]\s*\.map\s*\([^)]+\)\s*=>\s*\n\s*<View\s+)key=\{i\}",
    "src/screens/kyc/DigiLockerScreen.tsx": r"(DOCUMENT_TYPES\.map\s*\([^)]+\)\s*=>\s*\n\s*<View\s+)key=\{i\}",
    "src/screens/kyc/DigiLockerScreen_ben": r"(\[.*?\])\s*\.map\s*\([^)]+\)\s*=>\s*\n\s*<View\s+)key=\{i\}",
    "src/screens/settings/TwoFactorSetupScreen.tsx": r"(\].map\s*\([^)]+\)\s*=>\s*\n\s*<View\s+)key=\{i\}",
    "src/screens/settings/TelegramConnectScreen.tsx": r"(\].map\s*\([^)]+\)\s*=>\s*\n\s*<View\s+)key=\{i\}",
    "src/screens/settings/WidgetSettingsScreen.tsx": r"(\].map\s*\([^)]+\)\s*=>\s*\n\s*<View\s+)key=\{i\}",
    "src/screens/social/TraderProfileScreen.tsx": r"(metrics\.map\s*\([^)]+\)\s*=>\s*\n\s*<View\s+)key=\{i\}",
    "src/screens/broker/BrokerConnectScreen.tsx": r"(broker\.features\.map\s*\([^)]+\)\s*=>\s*\n\s*<View\s+)key=\{i\}",
    "src/screens/broker/ConnectBrokerView.tsx": r"(broker\.features\.map\s*\([^)]+\)\s*=>\s*\n\s*<View\s+)key=\{i\}",
    "src/screens/tabs/WatchlistScreen.tsx": r"(\[1,\s*2,\s*3\]\s*\.map\s*\(\s*i\s*\)\s*=>\s*<SkeletonCard\s+)key=\{i\}",
    "src/screens/tabs/MarketsScreen.tsx": r"(\[1,\s*2,\s*3,\s*4\]\s*\.map\s*\(\s*i\s*\)\s*=>\s*<SkeletonCard\s+)key=\{i\}",
    "src/screens/tabs/PortfolioScreen.tsx": r"(\[1,\s*2,\s*3\]\s*\.map\s*\(\s*i\s*\)\s*=>\s*<SkeletonCard\s+)key=\{i\}",
    "src/screens/tabs/LearnScreen.tsx": r"(\[1,\s*2,\s*3\]\s*\.map\s*\(\s*i\s*\)\s*=>\s*\n\s*<View\s+)key=\{i\}",
}

# Actually, simpler approach: just replace key={i} with key={`${fileprefix}_${i}`} 
# in the entire file content for each file

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
    
    # Replace key={i} with key={`${prefix}_${i}`}
    # We need to be careful not to replace already-fixed ones
    new_content = re.sub(r'key=\{i\}', f'key={{{prefix}_$i}}', content)
    
    if new_content != content:
        with open(full_path, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print(f"FIXED: {rel_path}")
    else:
        print(f"NO CHANGE: {rel_path}")
