/**
 * ============================================================================
 * Toroloom Test Setup
 * ============================================================================
 *
 * This file runs before every test suite. It sets up global mocks for native
 * modules that are not available in the Node.js test environment.
 */

// ==================== Global environment polyfills ===========================
// __DEV__ is a React Native / Metro bundler global that vitest's Node
// environment doesn't define by default. expo-modules-core's setUpJsLogger
// references it at import time, causing a ReferenceError in tests that
// transitively load expo modules.
globalThis.__DEV__ = true;

// ==================== Mock react-native-safe-area-context ====================
// Fund screens (AddFundsScreen, TransactionHistoryScreen, TransferScreen,
// UPIScreen, WithdrawScreen) all import useSafeAreaInsets.  This module
// ships with ESM/Flow syntax that vitest cannot transform, so we must
// mock it at the top level.
vi.mock('react-native-safe-area-context', () => ({
  SafeAreaProvider: ({ children }: any) => children,
  SafeAreaView: ({ children }: any) => children,
  SafeAreaConsumer: ({ children }: any) => children({ top: 0, bottom: 0, left: 0, right: 0 }),
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  useSafeAreaFrame: () => ({ width: 390, height: 844 }),
  initialWindowMetrics: { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, bottom: 0, left: 0, right: 0 } },
}));

// ==================== Mock AsyncStorage ====================
const mockStorage: Record<string, string> = {};

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn((key: string) => Promise.resolve(mockStorage[key] ?? null)),
    setItem: vi.fn((key: string, value: string) => {
      mockStorage[key] = value;
      return Promise.resolve();
    }),
    removeItem: vi.fn((key: string) => {
      delete mockStorage[key];
      return Promise.resolve();
    }),
    multiRemove: vi.fn((keys: string[]) => {
      keys.forEach(key => delete mockStorage[key]);
      return Promise.resolve();
    }),
    clear: vi.fn(() => {
      Object.keys(mockStorage).forEach(key => delete mockStorage[key]);
      return Promise.resolve();
    }),
  },
}));

// ==================== Mock react-native-reanimated ====================
// ThemeProvider uses useSharedValue, useAnimatedStyle, withTiming, runOnJS, Easing
vi.mock('react-native-reanimated', () => ({
  useSharedValue: (initial: any) => ({ value: initial }),
  useAnimatedStyle: (updater: any) => updater(),
  withTiming: (toValue: any, _config: any, callback?: any) => {
    callback?.(true);
    return toValue;
  },
  useAnimatedReaction: (_prepare: any, _react: any) => {},
  withDelay: (_delay: number, value: any) => value,
  interpolate: (_value: number, _inputRange: number[], _outputRange: number[]) => _outputRange[0],
  interpolateColor: (_value: number, _inputRange: number[], _outputRange: string[]) => _outputRange[0],
  withSpring: (toValue: any) => toValue,
  withRepeat: (animation: any) => animation,
  withSequence: (...animations: any[]) => animations[animations.length - 1],
  runOnJS: (fn: any) => fn,
  useAnimatedScrollHandler: (handler: any) => handler.onScroll || handler,
  Extrapolation: { CLAMP: 'clamp', EXTEND: 'extend', IDENTITY: 'identity' },
  Easing: { in: (e: any) => e, out: (e: any) => e, inOut: (e: any) => e, ease: undefined },
  default: { View: 'View', Text: 'Text' },
}));

// ==================== Mock React Native ====================
// We import the mock from a separate file to avoid vitest trying to parse
// the real react-native source (which contains Flow-typed syntax like
// "import typeof") during module resolution.
vi.mock('react-native', async () => {
  const mod = await import('./react-native.mock');
  return { ...mod, default: mod.default };
});

// ==================== Mock expo-linear-gradient ====================
vi.mock('expo-linear-gradient', () => ({
  LinearGradient: 'LinearGradient',
}));

// ==================== Mock expo-notifications ====================
vi.mock('expo-notifications', () => ({
  default: {
    scheduleNotificationAsync: vi.fn(() => Promise.resolve('scheduled-id')),
    cancelScheduledNotificationAsync: vi.fn(() => Promise.resolve()),
    cancelAllScheduledNotificationsAsync: vi.fn(() => Promise.resolve()),
    setNotificationHandler: vi.fn(),
    getPermissionsAsync: vi.fn(() => Promise.resolve({ status: 'granted' })),
    requestPermissionsAsync: vi.fn(() => Promise.resolve({ status: 'granted' })),
    setNotificationChannelAsync: vi.fn(() => Promise.resolve()),
    addNotificationReceivedListener: vi.fn(() => ({ remove: vi.fn() })),
    addNotificationResponseReceivedListener: vi.fn(() => ({ remove: vi.fn() })),
    getExpoPushTokenAsync: vi.fn(() => Promise.resolve({ data: 'mock-push-token' })),
  },
  setNotificationHandler: vi.fn(),
  getExpoPushTokenAsync: vi.fn(() => Promise.resolve({ data: 'mock-push-token' })),
  scheduleNotificationAsync: vi.fn(() => Promise.resolve('scheduled-id')),
  cancelScheduledNotificationAsync: vi.fn(() => Promise.resolve()),
  cancelAllScheduledNotificationsAsync: vi.fn(() => Promise.resolve()),
  getPermissionsAsync: vi.fn(() => Promise.resolve({ status: 'granted' })),
  requestPermissionsAsync: vi.fn(() => Promise.resolve({ status: 'granted' })),
  setNotificationChannelAsync: vi.fn(() => Promise.resolve()),
  addNotificationReceivedListener: vi.fn(() => ({ remove: vi.fn() })),
  addNotificationResponseReceivedListener: vi.fn(() => ({ remove: vi.fn() })),
  AndroidImportance: { HIGH: 'high', DEFAULT: 'default', LOW: 'low', NONE: 'none' },
  IosAuthorizationStatus: { GRANTED: 1, DENIED: 0 },
  Importance: { NONE: 0, LOW: 1, UNSPECIFIED: 2, DEFAULT: 3, HIGH: 4 },
}));

// ==================== Mock expo-document-picker ====================
// The package triggers expo-modules-core EventEmitter on import
vi.mock('expo-document-picker', () => ({
  getDocumentAsync: vi.fn(() => Promise.resolve({ canceled: true })),
}));

// ==================== Mock expo-haptics ====================
vi.mock('expo-haptics', () => ({
  impactAsync: vi.fn(() => Promise.resolve()),
  selectionAsync: vi.fn(() => Promise.resolve()),
  notificationAsync: vi.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
  NotificationFeedbackType: { Success: 'success', Error: 'error', Warning: 'warning' },
}));

// ==================== Mock @expo/vector-icons ====================
// MarketCard, StockItem, PortfolioHolding, and other components use
// @expo/vector-icons icon sets.  Each icon is rendered as a plain
// React element with the icon name as children, so getByText queries
// can target icon names.
vi.mock('@expo/vector-icons', () => {
  // We must NOT require('react-native') here — doing so would bypass
  // vitest's mock system and load the real Flow-typed source.
  return {
    AntDesign: 'IonAntDesign',
    Ionicons: 'IonIonicons',
    MaterialIcons: 'IonMaterialIcons',
    MaterialCommunityIcons: 'IonMaterialCommunityIcons',
    Feather: 'IonFeather',
    FontAwesome: 'IonFontAwesome',
    FontAwesome5: 'IonFontAwesome5',
    Fontisto: 'IonFontisto',
    EvilIcons: 'IonEvilIcons',
    Entypo: 'IonEntypo',
    SimpleLineIcons: 'IonSimpleLineIcons',
    Octicons: 'IonOcticons',
    Zocial: 'IonZocial',
    createIconSet: vi.fn(() => 'IonCustomIcon'),
    createMultiStyleIconSet: vi.fn(() => 'IonCustomIcon'),
  };
});

// ==================== Mock react-native-svg ====================
vi.mock('react-native-svg', () => {
  const SvgMock = (props: any) => props.children ?? null;
  SvgMock.displayName = 'Svg';
  return {
    default: SvgMock,
    Svg: SvgMock,
    Path: 'Path',
    Line: 'Line',
    Rect: 'Rect',
    G: 'G',
    Circle: 'Circle',
    Defs: 'Defs',
    LinearGradient: 'SvgLinearGradient',
    Stop: 'Stop',
    Text: 'SvgText',
    TSpan: 'TSpan',
    ClipPath: 'ClipPath',
    Polygon: 'Polygon',
    Polyline: 'Polyline',
  };
});

// ==================== Mock expo-task-manager ====================
vi.mock('expo-task-manager', () => ({
  defineTask: vi.fn(),
  isTaskRegisteredAsync: vi.fn(() => Promise.resolve(false)),
  registerTaskAsync: vi.fn(() => Promise.resolve()),
  unregisterTaskAsync: vi.fn(() => Promise.resolve()),
  getRegisteredTasksAsync: vi.fn(() => Promise.resolve([])),
  TaskManager: {
    defineTask: vi.fn(),
    isTaskRegisteredAsync: vi.fn(() => Promise.resolve(false)),
  },
}));

// ==================== Mock expo-background-fetch ====================
vi.mock('expo-background-fetch', () => ({
  registerTaskAsync: vi.fn(() => Promise.resolve()),
  unregisterTaskAsync: vi.fn(() => Promise.resolve()),
  getStatusAsync: vi.fn(() => Promise.resolve(3)),
  BackgroundFetchStatus: { Denied: 0, Restricted: 1, Available: 3 },
  BackgroundFetchResult: { NoData: 1, NewData: 2, Failed: 3 },
}));

// ==================== Mock expo-device ====================
vi.mock('expo-device', () => ({
  deviceName: 'Test Device',
  deviceYearClass: 2023,
  osName: 'iOS',
  osVersion: '16.0',
  isDevice: true,
}));

// ==================== Mock WebSocket service ====================
vi.mock('../services/wsService', () => ({
  wsService: {
    connect: vi.fn(),
    disconnect: vi.fn(),
    subscribe: vi.fn(),
    unsubscribe: vi.fn(),
    onMessage: vi.fn(),
    send: vi.fn(),
    isConnected: vi.fn(() => false),
    onPnLUpdateCallback: vi.fn(() => {}),
    onLockdownCallback: vi.fn(() => {}),
    setLossLimit: vi.fn(),
  },
}));

// ==================== Mock wsRegistry ====================
vi.mock('../services/wsRegistry', () => ({
  getActiveWS: vi.fn(() => ({
    connect: vi.fn(),
    disconnect: vi.fn(),
    subscribe: vi.fn(),
    unsubscribe: vi.fn(),
    onMessage: vi.fn(),
    send: vi.fn(),
    isConnected: vi.fn(() => false),
    onPnLUpdateCallback: vi.fn((_cb: any) => {}),
    onLockdownCallback: vi.fn((_cb: any) => {}),
    setLossLimit: vi.fn(),
    getCurrentPrice: vi.fn((_stockId: string) => 2890.50),
    getCachedCandles: vi.fn(() => []),
    getIsAuthenticated: vi.fn(() => true),
  })),
}));

// ==================== Mock notification service ====================
vi.mock('../services/notificationService', () => ({
  sendPriceAlert: vi.fn(),
  sendTradeConfirmation: vi.fn(),
  sendEducationalReminder: vi.fn(),
  sendPortfolioAlert: vi.fn(),
  sendLocalNotification: vi.fn(() => Promise.resolve('mock-scheduled-id')),
  cancelNotification: vi.fn(),
  cancelAllNotifications: vi.fn(),
  setupChannels: vi.fn(),
  updateAppIconBadge: vi.fn(() => Promise.resolve()),
  useNotificationStore: { getState: vi.fn() },
}));

// ==================== Mock API modules ====================
vi.mock('../services/api/market', () => ({
  marketApi: {
    getIndices: vi.fn(),
    getStocks: vi.fn(),
    search: vi.fn(() => Promise.resolve([])),
  },
}));

vi.mock('../services/api/portfolio', () => ({
  portfolioApi: {
    getHoldings: vi.fn(),
    getTrades: vi.fn(),
  },
}));

vi.mock('../services/api/watchlist', () => ({
  watchlistApi: {
    getAll: vi.fn(),
    addStock: vi.fn(),
    removeStock: vi.fn(),
    create: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('../services/api/auth', () => ({
  authApi: {
    login: vi.fn(),
    signup: vi.fn(),
    getProfile: vi.fn(),
  },
}));

vi.mock('../services/api/notifications', () => ({
  notificationApi: {
    getAll: vi.fn(),
    markRead: vi.fn(),
    markAllRead: vi.fn(),
    getBadgeCount: vi.fn(() => Promise.resolve({ badgeCount: 0 })),
    evaluatePortfolioAlerts: vi.fn(() => Promise.resolve({ evaluated: true, rulesFired: 0, badgeCount: 0, fired: [] })),
    syncPortfolioAlertRules: vi.fn(() => Promise.resolve({ success: true, count: 0 })),
  },
}));

vi.mock('../services/api/education', () => ({
  educationApi: {
    getCourses: vi.fn(),
    getLesson: vi.fn(),
    markLessonProgress: vi.fn(),
  },
}));

vi.mock('../services/api/community', () => ({
  communityApi: {
    getPosts: vi.fn(),
    createPost: vi.fn(),
    likePost: vi.fn(),
  },
}));

vi.mock('../services/api/ai', () => ({
  aiApi: {
    getInsights: vi.fn(),
    analyze: vi.fn(),
  },
}));

vi.mock('../services/api/mutualFunds', () => ({
  mutualFundApi: {
    getFunds: vi.fn(),
    getSIPs: vi.fn(),
    createSIP: vi.fn(),
  },
}));

// ==================== Mock Support API ====================
vi.mock('../services/api/support', () => ({
  supportApi: {
    submitTicket: vi.fn(),
    getFAQs: vi.fn(() => Promise.resolve([])),
  },
}));

// ==================== Mock expo-print ====================
vi.mock('expo-print', () => ({
  Print: {
    printToFileAsync: vi.fn(() => Promise.resolve({ uri: 'file:///tmp/test_report.pdf' })),
  },
  default: {
    printToFileAsync: vi.fn(() => Promise.resolve({ uri: 'file:///tmp/test_report.pdf' })),
  },
  printToFileAsync: vi.fn(() => Promise.resolve({ uri: 'file:///tmp/test_report.pdf' })),
}));

// ==================== Mock expo-sharing ====================
vi.mock('expo-sharing', () => ({
  default: {
    isAvailableAsync: vi.fn(() => Promise.resolve(true)),
    shareAsync: vi.fn(() => Promise.resolve()),
  },
  isAvailableAsync: vi.fn(() => Promise.resolve(true)),
  shareAsync: vi.fn(() => Promise.resolve()),
}));

// ==================== Mock expo-file-system ====================
vi.mock('expo-file-system', () => ({
  default: {
    cacheDirectory: '/tmp/',
    moveAsync: vi.fn(() => Promise.resolve()),
    writeAsStringAsync: vi.fn(() => Promise.resolve()),
    documentDirectory: '/docs/',
    EncodingType: { UTF8: 'utf8' },
  },
  cacheDirectory: '/tmp/',
  documentDirectory: '/docs/',
  moveAsync: vi.fn(() => Promise.resolve()),
  writeAsStringAsync: vi.fn(() => Promise.resolve()),
  EncodingType: { UTF8: 'utf8' },
}));

// ==================== Mock expo-file-system/legacy ====================
// reportExport.ts imports from 'expo-file-system/legacy'. vitest's mock of the
// root module does NOT cover subpath imports. Without this mock, the real module
// loads and triggers expo-modules-core → react-native subpath imports that our
// root react-native mock doesn't intercept (e.g. react-native/Libraries/...),
// causing EventEmitter errors. The test file also has its own mock with local
// vi.fn() refs, but other test files (e.g. ReportsScreen) need this too since
// they import the same reportExport module at render time.
vi.mock('expo-file-system/legacy', () => ({
  cacheDirectory: '/tmp/',
  moveAsync: vi.fn(() => Promise.resolve()),
  writeAsStringAsync: vi.fn(() => Promise.resolve()),
  EncodingType: { UTF8: 'utf8' },
}));

// ==================== Mock react-native-webview ====================
// AppNavigator → store → subscriptionStore → razorpay → react-native-webview
// Avoid SyntaxError transforming the package
vi.mock('react-native-webview', () => ({
  WebView: 'WebView',
  default: 'WebView',
}));

// ==================== Mock react-native-keychain ====================
// The package ships TypeScript source in lib/commonjs/ which vitest cannot
// parse. Mock it to prevent SyntaxError on import.
vi.mock('react-native-keychain', () => ({
  setGenericPassword: vi.fn(() => Promise.resolve()),
  getGenericPassword: vi.fn(() => Promise.resolve({ service: '', username: '', password: '' })),
  resetGenericPassword: vi.fn(() => Promise.resolve()),
  default: {
    setGenericPassword: vi.fn(() => Promise.resolve()),
    getGenericPassword: vi.fn(() => Promise.resolve({ service: '', username: '', password: '' })),
    resetGenericPassword: vi.fn(() => Promise.resolve()),
  },
}));

