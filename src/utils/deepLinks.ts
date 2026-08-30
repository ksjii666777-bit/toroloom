// =============================================================================
// Toroloom — Deep Link URL Utility
// Generates shareable deep links for stocks, posts, and other content
// =============================================================================

const DEEP_LINK_PREFIX = 'toroloom://';
const UNIVERSAL_LINK_PREFIX = 'https://toroloom.com';
const UNIVERSAL_LINK_BASE = 'https://toroloom.com/';
const OG_BASE = 'https://toroloom.com/og';

export interface DeepLinkOptions {
  /** Use universal link (https://toroloom.com) instead of custom scheme (toroloom://) */
  universal?: boolean;
}

/**
 * Generate a deep link for a stock detail screen
 * @param symbol Stock symbol (e.g., 'RELIANCE')
 * @param stockId Optional stock ID for precise routing
 * @param options Deep link options
 * @returns Deep link URL string
 */
export function stockDeepLink(
  symbol: string,
  stockId?: string,
  options?: DeepLinkOptions
): string {
  const base = options?.universal ? UNIVERSAL_LINK_BASE : DEEP_LINK_PREFIX;
  const params = new URLSearchParams();
  params.set('symbol', symbol);
  if (stockId) params.set('id', stockId);
  return `${base}stock/${encodeURIComponent(symbol)}?${params.toString()}`;
}

/**
 * Generate an OG preview URL for a stock (shows rich preview on social media)
 * @param symbol Stock symbol
 * @returns OG preview URL string
 */
export function stockOGUrl(symbol: string): string {
  return `${OG_BASE}/stock/${encodeURIComponent(symbol)}`;
}

/**
 * Generate a deep link for a community post
 * @param postId Post ID
 * @param options Deep link options
 * @returns Deep link URL string
 */
export function postDeepLink(
  postId: string,
  options?: DeepLinkOptions
): string {
  const base = options?.universal ? UNIVERSAL_LINK_BASE : DEEP_LINK_PREFIX;
  return `${base}post/${postId}`;
}

/**
 * Generate an OG preview URL for a post (shows rich preview on social media)
 * @param postId Post ID
 * @returns OG preview URL string
 */
export function postOGUrl(postId: string): string {
  return `${OG_BASE}/post/${postId}`;
}

/**
 * Generate a deep link for a course
 * @param courseId Course ID
 * @param options Deep link options
 * @returns Deep link URL string
 */
export function courseDeepLink(
  courseId: string,
  options?: DeepLinkOptions
): string {
  const base = options?.universal ? UNIVERSAL_LINK_BASE : DEEP_LINK_PREFIX;
  return `${base}course/${courseId}`;
}

/**
 * Generate a deep link for a referral signup
 * @param referralCode Referral code
 * @param options Deep link options
 * @returns Deep link URL string
 */
export function referralDeepLink(
  referralCode: string,
  options?: DeepLinkOptions
): string {
  const base = options?.universal ? UNIVERSAL_LINK_BASE : DEEP_LINK_PREFIX;
  return `${base}signup?ref=${encodeURIComponent(referralCode)}`;
}

/**
 * Generate a deep link for an advisor profile
 * @param advisorId Advisor ID
 * @param options Deep link options
 * @returns Deep link URL string
 */
export function advisorDeepLink(
  advisorId: string,
  options?: DeepLinkOptions
): string {
  const base = options?.universal ? UNIVERSAL_LINK_BASE : DEEP_LINK_PREFIX;
  return `${base}advisor/${advisorId}`;
}

/**
 * Parse a deep link URL and extract route information
 * @param url Deep link URL
 * @returns Parsed route info or null if invalid
 */
export function parseDeepLink(
  url: string
): { route: string; params: Record<string, string> } | null {
  try {
    // Handle both custom scheme and universal links
    let path: string;
    let searchParams: URLSearchParams;

    if (url.startsWith(DEEP_LINK_PREFIX)) {
      // Custom scheme: toroloom://stock/RELIANCE?symbol=RELIANCE&id=123
      const withoutScheme = url.slice(DEEP_LINK_PREFIX.length);
      const [pathPart, queryPart] = withoutScheme.split('?');
      path = pathPart;
      searchParams = new URLSearchParams(queryPart || '');
    } else if (url.startsWith(UNIVERSAL_LINK_PREFIX)) {
      // Universal link: https://toroloom.com/stock/RELIANCE?symbol=RELIANCE&id=123
      const parsed = new URL(url);
      path = parsed.pathname.replace(/^\//, '');
      searchParams = parsed.searchParams;
    } else {
      return null;
    }

    const params: Record<string, string> = {};
    searchParams.forEach((value, key) => {
      params[key] = value;
    });

    // Extract route from path
    const segments = path.split('/').filter(Boolean);
    if (segments.length === 0) return null;

    const route = segments[0];

    // For routes like 'post/abc123', extract the second segment as ID
    if (segments.length >= 2 && !params.id) {
      const idMap: Record<string, string> = {
        post: 'postId',
        course: 'courseId',
        advisor: 'advisorId',
      };
      const paramKey = idMap[route];
      if (paramKey) {
        params[paramKey] = segments[1];
      }
    }

    return { route, params };
  } catch {
    return null;
  }
}

/**
 * Get the navigation route name from a deep link route
 * @param deepLinkRoute Route from parseDeepLink
 * @returns Navigation route name or null
 */
export function getNavigationRoute(
  deepLinkRoute: string
): string | null {
  const routeMap: Record<string, string> = {
    stock: 'StockDetail',
    post: 'CommunityPost',
    course: 'CourseDetail',
    signup: 'Signup',
    advisor: 'AdvisorDetail',
  };
  return routeMap[deepLinkRoute] || null;
}

/**
 * Get navigation params from deep link params
 * @param route Navigation route name
 * @param deepLinkParams Parsed deep link params
 * @returns Navigation params
 */
export function getNavigationParams(
  route: string,
  deepLinkParams: Record<string, string>
): Record<string, string> {
  switch (route) {
    case 'StockDetail':
      return {
        stockId: deepLinkParams.id || '',
        symbol: deepLinkParams.symbol || '',
      };
    case 'CommunityPost':
      return {
        postId: deepLinkParams.postId || deepLinkParams.id || '',
      };
    case 'CourseDetail':
      return {
        courseId: deepLinkParams.courseId || deepLinkParams.id || '',
      };
    case 'AdvisorDetail':
      return {
        advisorId: deepLinkParams.advisorId || deepLinkParams.id || '',
      };
    default:
      return deepLinkParams;
  }
}
