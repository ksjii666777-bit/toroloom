/**
 * ============================================================================
 * Toroloom Test Setup
 * ============================================================================
 *
 * This file runs before every test suite. It sets up global mocks for native
 * modules that are not available in the Node.js test environment.
 */

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
  withSpring: (toValue: any) => toValue,
  runOnJS: (fn: any) => fn,
  Easing: { in: (e: any) => e, out: (e: any) => e, ease: undefined },
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
  },
  setNotificationHandler: vi.fn(),
  scheduleNotificationAsync: vi.fn(() => Promise.resolve('scheduled-id')),
  cancelScheduledNotificationAsync: vi.fn(() => Promise.resolve()),
  cancelAllScheduledNotificationsAsync: vi.fn(() => Promise.resolve()),
  getPermissionsAsync: vi.fn(() => Promise.resolve({ status: 'granted' })),
  requestPermissionsAsync: vi.fn(() => Promise.resolve({ status: 'granted' })),
  setNotificationChannelAsync: vi.fn(() => Promise.resolve()),
  addNotificationReceivedListener: vi.fn(() => ({ remove: vi.fn() })),
  addNotificationResponseReceivedListener: vi.fn(() => ({ remove: vi.fn() })),
}));

// ==================== Mock expo-haptics ====================
vi.mock('expo-haptics', () => ({
  impactAsync: vi.fn(),
  selectionAsync: vi.fn(),
  notificationAsync: vi.fn(),
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
    onPnLUpdateCallback: vi.fn((cb) => {}),
    onLockdownCallback: vi.fn((cb) => {}),
    setLossLimit: vi.fn(),
  })),
}));

// ==================== Mock notification service ====================
vi.mock('../services/notificationService', () => ({
  sendPriceAlert: vi.fn(),
  sendTradeConfirmation: vi.fn(),
  sendEducationalReminder: vi.fn(),
  sendLocalNotification: vi.fn(() => Promise.resolve('mock-scheduled-id')),
  cancelNotification: vi.fn(),
  cancelAllNotifications: vi.fn(),
  setupChannels: vi.fn(),
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
