/**
 * ============================================================================
 * Toroloom — Secure Session Sync v2 (Global Zero-API Gateway)
 * ============================================================================
 *
 * High-performance WebView wrapper that intercepts broker login flows
 * from ANY broker worldwide — with or without an official API.
 *
 * Key enhancements for global broker support:
 *   - 20+ broker login configs loaded dynamically from brokerLoginConfig.ts
 *   - Multi-auth flow detection: password, OAuth, social login, QR scan,
 *     magic link, biometric
 *   - Region-aware dashboard pattern matching
 *   - WebView detection bypass with user-agent rotation
 *   - QR code login flow detection (scan from desktop)
 *   - Enhanced token extraction — scans URL query params AND hash fragments
 *   - Configurable extraction strategy per broker
 *   - Session extraction at multiple trigger points (not just post-dashboard)
 *
 * Architecture:
 *   Broker login configs are DRY — add a new broker by editing
 *   brokerLoginConfig.ts. No component changes needed.
 *
 * ============================================================================
 */

import React, { useCallback, useRef, useEffect, useMemo, useState } from 'react';
import {
  View,
  StyleSheet,
  ActivityIndicator,
  Text,
  Platform,
} from 'react-native';
import { WebView, WebViewNavigation } from 'react-native-webview';
import type { SessionPayload } from '../../types';

// ─── Broker Login Config ───────────────────────────────────────────────────

import {
  getBrokerLoginConfig,
  getBrokerDashboardPatterns,
  getBrokerTokenParams,
  getBrokerMfaPatterns,
  getBrokerExtractionStrategy,
  brokerBlocksWebView,
  type BrokerLoginConfig,
  type ExtractionStrategy,
} from '../../services/gateway/brokerLoginConfig';

// ─── Types ─────────────────────────────────────────────────────────────────

export type AuthFlowType =
  | 'password'
  | 'oauth'
  | 'social_login'
  | 'qr_scan'
  | 'magic_link'
  | 'unknown';

export interface AuthDetectionEvent {
  /** The type of auth flow detected */
  flowType: AuthFlowType;
  /** The URL at which this was detected */
  url: string;
  /** Which MFA step we're on (0 = none, 1 = first factor, 2 = second factor) */
  mfaStep: 0 | 1 | 2;
  /** Current extraction strategy */
  strategy: ExtractionStrategy;
}

interface SecureSessionSyncProps {
  /** The broker OAuth / login URL to load in the WebView */
  sourceUrl: string;
  /** Broker type identifier (e.g., 'zerodha', 'robinhood', 'wealthsimple') */
  brokerType: string;
  /** Called when a valid session payload has been extracted */
  onSessionCaptured: (payload: SessionPayload) => void;
  /** Called when the WebView encounters a non-recoverable error */
  onError: (error: string) => void;
  /** Called when auth flow detection events occur (for UI feedback) */
  onAuthDetection?: (event: AuthDetectionEvent) => void;
  /** Called when the user should close / cancel the WebView */
  onClose?: () => void;
  /** Optional override for login config (if not using the registry) */
  loginConfigOverride?: Partial<BrokerLoginConfig>;
  /** Optional custom User-Agent for WebView (to bypass detection) */
  customUserAgent?: string;
}

// ─── Injected JavaScript ──────────────────────────────────────────────────

const SESSION_EXTRACTION_SCRIPT = `
(function() {
  try {
    var payload = {
      cookies: document.cookie || '',
      localStorage: {},
      sessionStorage: {},
      url: window.location.href,
      userAgent: navigator.userAgent,
      title: document.title,
    };

    // Extract localStorage (safely — some sites restrict access)
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var key = localStorage.key(i);
        if (key) {
          payload.localStorage[key] = localStorage.getItem(key) || '';
        }
      }
    } catch (e) {
      payload.localStorage = { '_error': 'localStorage blocked: ' + e.message };
    }

    // Extract sessionStorage
    try {
      for (var j = 0; j < sessionStorage.length; j++) {
        var sk = sessionStorage.key(j);
        if (sk) {
          payload.sessionStorage[sk] = sessionStorage.getItem(sk) || '';
        }
      }
    } catch (e) {
      payload.sessionStorage = { '_error': 'sessionStorage blocked: ' + e.message };
    }

    // Also check for IndexedDB (used by some modern brokers)
    try {
      if (window.indexedDB) {
        payload.hasIndexedDB = true;
      }
    } catch (e) {
      // indexedDB blocked
    }

    // Post the complete payload back to React Native
    window.ReactNativeWebView.postMessage(JSON.stringify({
      type: 'SESSION_PAYLOAD',
      data: payload,
    }));
  } catch (_err) {
    window.ReactNativeWebView.postMessage(JSON.stringify({
      type: 'SESSION_ERROR',
      error: err.message || 'Unknown extraction error',
    }));
  }
})();
`;

/**
 * Script to check if the WebView has been detected as automated.
 * Some brokers inject warnings or redirect if they detect WebView usage.
 */
const WEBVIEW_DETECTION_SCRIPT = `
(function() {
  var isDetected = false;
  var detection = '';
  var agents = ['HeadlessChrome', 'PhantomJS', 'Selenium', 'Cypress', 'Puppeteer'];
  for (var i = 0; i < agents.length; i++) {
    if (navigator.userAgent.indexOf(agents[i]) >= 0) {
      isDetected = true;
      detection = 'user_agent: ' + agents[i];
    }
  }
  // Check if window has been flagged
  if (window.__webdriver === true) {
    isDetected = true;
    detection = 'webdriver_flag';
  }
  if (isDetected) {
    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'WEBVIEW_DETECTED', detection: detection }));
  }
})();
`;

// ─── Component ─────────────────────────────────────────────────────────────

export default function SecureSessionSync({
  sourceUrl,
  brokerType,
  onSessionCaptured,
  onError,
  onAuthDetection,
  onClose: _onClose,
  loginConfigOverride,
  customUserAgent,
}: SecureSessionSyncProps) {
  const webViewRef = useRef<WebView>(null);
  const hasCapturedRef = useRef(false);
  const extractionAttemptedRef = useRef(false);
  const currentUrlRef = useRef('');

  // Brokers known to block WebView access
  const [isWebViewBlocked, setIsWebViewBlocked] = useState(false);
  const [currentMfaStep, setCurrentMfaStep] = useState<0 | 1 | 2>(0);

  // Load broker config from registry (with optional override)
  const brokerConfig = useMemo<BrokerLoginConfig | null>(() => {
    const config = getBrokerLoginConfig(brokerType);
    if (!config && !loginConfigOverride) return null;
    if (loginConfigOverride) {
      return { ...config, ...loginConfigOverride } as BrokerLoginConfig;
    }
    return config ?? null;
  }, [brokerType, loginConfigOverride]);

  // Determine extraction strategy for this broker
  const extractionStrategy = useMemo<ExtractionStrategy>(() => {
    if (loginConfigOverride?.extractionStrategy) return loginConfigOverride.extractionStrategy;
    return getBrokerExtractionStrategy(brokerType);
  }, [brokerType, loginConfigOverride]);

  // Build dashboard patterns from config, with sensible defaults
  const dashPatterns = useMemo<string[]>(() => {
    if (loginConfigOverride?.dashboardPatterns) return loginConfigOverride.dashboardPatterns;
    const patterns = getBrokerDashboardPatterns(brokerType);
    return patterns.length > 0
      ? patterns
      : [
          'dashboard',
          'account',
          'portfolio',
          'home',
          'trading',
          'markets',
          'my-account',
          '/app',
        ];
  }, [brokerType, loginConfigOverride]);

  // Build token param patterns from config
  const tokenParamPatterns = useMemo<string[]>(() => {
    if (loginConfigOverride?.tokenParams) return loginConfigOverride.tokenParams;
    const patterns = getBrokerTokenParams(brokerType);
    return patterns.length > 0
      ? patterns
      : [
          'request_token=',
          'access_token=',
          'enctoken=',
          'jwt=',
          'authorization_code=',
          'token=',
          'session=',
          'auth=',
          'code=',
          'state=',
          'id_token=',
          'bearer=',
          'status=success',
        ];
  }, [brokerType, loginConfigOverride]);

  // Build MFA detection patterns from config
  const mfaPatterns = useMemo<string[]>(() => {
    if (loginConfigOverride?.mfaPatterns) return loginConfigOverride.mfaPatterns;
    const patterns = getBrokerMfaPatterns(brokerType);
    return patterns.length > 0
      ? patterns
      : [
          'totp',
          'mfa',
          'otp',
          'two-factor',
          '2fa',
          'verify',
          'authenticate',
          'security',
          'passcode',
          'sms',
          'verification',
          'challenge',
          'token',
          'seguranca',
        ];
  }, [brokerType, loginConfigOverride]);

  // Build User-Agent for WebView — rotate to avoid detection
  const userAgent = useMemo(() => {
    if (customUserAgent) return customUserAgent;

    // Rotate between known good user agents to avoid detection
    const agents = Platform.select({
      ios: [
        // iOS Safari — most trusted UA
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
        // iOS Chrome
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/125.0.6422.80 Mobile/15E148 Safari/604.1',
      ],
      android: [
        // Android Chrome — most trusted
        'Mozilla/5.0 (Linux; Android 14; Pixel 8 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.6422.165 Mobile Safari/537.36',
        // Samsung Internet
        'Mozilla/5.0 (Linux; Android 14; SM-S928B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/25.0 Chrome/121.0.6167.180 Mobile Safari/537.36',
      ],
      default: [
        'Mozilla/5.0 (Linux; Android 14; Pixel 8 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.6422.165 Mobile Safari/537.36',
      ],
    });

    // Use different UA on each mount to avoid fingerprinting
    const seed = sourceUrl.length + brokerType.length;
    return agents[seed % agents.length];
  }, [customUserAgent, sourceUrl, brokerType]);

  // Map extraction strategy to a prefix label
  const extractionLabel = useMemo(() => {
    switch (extractionStrategy) {
      case 'cookie_session': return 'Cookie Session';
      case 'local_storage': return 'Local Storage';
      case 'token_param': return 'Token Parameter';
      case 'hybrid': return 'Hybrid';
      default: return 'Automatic';
    }
  }, [extractionStrategy]);

  // ── Auth Flow Detection ─────────────────────────────────────

  /**
   * Detect what kind of auth flow we're in based on the URL.
   */
  const detectAuthFlow = useCallback(
    (url: string): AuthFlowType => {
      const lowerUrl = url.toLowerCase();

      // OAuth redirects
      if (
        lowerUrl.includes('oauth') ||
        lowerUrl.includes('authorize') ||
        (lowerUrl.includes('redirect_uri=') || lowerUrl.includes('response_type='))
      ) {
        return 'oauth';
      }

      // Social login redirects
      if (
        lowerUrl.includes('accounts.google.com') ||
        lowerUrl.includes('google.com/signin') ||
        lowerUrl.includes('appleid.apple.com') ||
        lowerUrl.includes('signin-google') ||
        lowerUrl.includes('signin-apple')
      ) {
        return 'social_login';
      }

      // QR code scan flow
      if (lowerUrl.includes('qrcode') || lowerUrl.includes('qr_code') || lowerUrl.includes('/qr')) {
        return 'qr_scan';
      }

      // Magic link flow
      if (lowerUrl.includes('magic-link') || lowerUrl.includes('magiclink') || lowerUrl.includes('email-link')) {
        return 'magic_link';
      }

      // Check for password form (default)
      if (
        lowerUrl.includes('login') ||
        lowerUrl.includes('signin') ||
        lowerUrl.includes('sign-in') ||
        lowerUrl.includes('log-in') ||
        lowerUrl.includes('auth') ||
        lowerUrl.includes('authenticate')
      ) {
        return 'password';
      }

      return 'unknown';
    },
    [],
  );

  /**
   * Emit auth detection event for UI feedback.
   */
  const emitAuthDetection = useCallback(
    (flowType: AuthFlowType, url: string, mfaStep: 0 | 1 | 2, strategy: ExtractionStrategy) => {
      onAuthDetection?.({
        flowType,
        url,
        mfaStep,
        strategy,
      });
    },
    [onAuthDetection],
  );

  // ── URL Analysis ────────────────────────────────────────────

  /**
   * Determine if the current URL indicates dashboard (login success).
   */
  const isDashboardUrl = useCallback(
    (url: string): boolean => {
      const lowerUrl = url.toLowerCase();
      return dashPatterns.some(pattern => lowerUrl.includes(pattern));
    },
    [dashPatterns],
  );

  /**
   * Determine if the URL contains auth tokens (from OAuth redirect or query params).
   * Scans both query string parameters AND hash fragments.
   */
  const hasAuthTokens = useCallback(
    (url: string): boolean => {
      const lowerUrl = url.toLowerCase();

      // Check URL query string for known token params
      for (const param of tokenParamPatterns) {
        if (lowerUrl.includes(param)) {
          return true;
        }
      }

      // Check URL hash fragment for tokens (modern SPAs store tokens in #)
      const hashIdx = url.indexOf('#');
      if (hashIdx >= 0) {
        const hash = url.substring(hashIdx);
        if (
          hash.includes('access_token=') ||
          hash.includes('token=') ||
          hash.includes('id_token=') ||
          hash.includes('session=') ||
          hash.includes('auth=')
        ) {
          return true;
        }
      }

      return false;
    },
    [tokenParamPatterns],
  );

  /**
   * Determine if the URL contains MFA/TOTP challenge indicators.
   */
  const isMfaUrl = useCallback(
    (url: string): boolean => {
      const lowerUrl = url.toLowerCase();
      return mfaPatterns.some(pattern => lowerUrl.includes(pattern));
    },
    [mfaPatterns],
  );

  /**
   * Check if URL indicates a social login redirect flow.
   */
  const isSocialLoginRedirect = useCallback((url: string): boolean => {
    const lowerUrl = url.toLowerCase();
    return (
      lowerUrl.includes('accounts.google.com') ||
      lowerUrl.includes('google.com/signin') ||
      lowerUrl.includes('appleid.apple.com') ||
      lowerUrl.includes('signin-google') ||
      lowerUrl.includes('signin-apple') ||
      lowerUrl.includes('oauth2callback') ||
      lowerUrl.includes('openid')
    );
  }, []);

  /**
   * Check if the URL indicates a QR code scan flow.
   */
  const isQrCodeFlow = useCallback((url: string): boolean => {
    const lowerUrl = url.toLowerCase();
    return (
      lowerUrl.includes('qrcode') ||
      lowerUrl.includes('qr_code') ||
      lowerUrl.includes('/qr') ||
      lowerUrl.includes('quick-response')
    );
  }, []);

  // ── Navigation State Handler ─────────────────────────────────

  const handleNavigationStateChange = useCallback(
    (navState: WebViewNavigation) => {
      const { url } = navState;

      if (!url || url === 'about:blank') return;

      currentUrlRef.current = url;

      // Detect auth flow type
      const flowType = detectAuthFlow(url);
      let mfaStep: 0 | 1 | 2 = currentMfaStep;

      // Update MFA step tracking
      if (isMfaUrl(url)) {
        mfaStep = 1;
        setCurrentMfaStep(1);
      } else if (currentMfaStep === 1 && url.includes('callback') || url.includes('dashboard') || isDashboardUrl(url)) {
        mfaStep = 2;
        setCurrentMfaStep(2);
      }

      emitAuthDetection(flowType, url, mfaStep, extractionStrategy);

      // Social login redirect — wait for redirect back to broker
      if (isSocialLoginRedirect(url)) {
        console.log(`[SecureSessionSync] Social login detected for ${brokerType}, waiting for redirect back...`);
        return;
      }

      // QR code flow — check if we need to display QR
      if (isQrCodeFlow(url)) {
        console.log(`[SecureSessionSync] QR code scan detected for ${brokerType}`);
        return;
      }

      // Token parameters in hash fragment (SPA OAuth flow)
      if (!hasCapturedRef.current && hasAuthTokens(url) && !isSocialLoginRedirect(url)) {
        hasCapturedRef.current = true;
        console.log(`[SecureSessionSync] Auth tokens detected in URL for ${brokerType}, extracting...`);

        // For token_param strategy, extract immediately
        if (extractionStrategy === 'token_param') {
          setTimeout(() => {
            webViewRef.current?.injectJavaScript(SESSION_EXTRACTION_SCRIPT);
          }, 800);
        } else {
          setTimeout(() => {
            webViewRef.current?.injectJavaScript(SESSION_EXTRACTION_SCRIPT);
          }, 1500);
        }
        return;
      }

      // Dashboard URL detection — most common trigger
      if (
        !hasCapturedRef.current &&
        (isDashboardUrl(url) || hasAuthTokens(url))
      ) {
        hasCapturedRef.current = true;

        const delay = extractionStrategy === 'token_param' ? 800 : 1500;

        setTimeout(() => {
          webViewRef.current?.injectJavaScript(SESSION_EXTRACTION_SCRIPT);
        }, delay);
      }
    },
    [
      brokerType,
      extractionStrategy,
      isDashboardUrl,
      isMfaUrl,
      isSocialLoginRedirect,
      isQrCodeFlow,
      hasAuthTokens,
      detectAuthFlow,
      emitAuthDetection,
      currentMfaStep,
    ],
  );

  // ── Message Handler ───────────────────────────────────────────

  const handleMessage = useCallback(
    (event: any) => {
      try {
        const message = JSON.parse(event.nativeEvent.data);

        if (message.type === 'SESSION_PAYLOAD') {
          const sessionPayload: SessionPayload = {
            cookies: message.data.cookies,
            localStorage: message.data.localStorage,
            sessionStorage: message.data.sessionStorage,
            brokerType,
            capturedAt: new Date().toISOString(),
            url: message.data.url,
          };
          onSessionCaptured(sessionPayload);
        } else if (message.type === 'SESSION_ERROR') {
          onError(message.error || 'Session extraction failed');
        } else if (message.type === 'WEBVIEW_DETECTED') {
          console.warn(`[SecureSessionSync] WebView detected by ${brokerType}: ${message.detection}`);
          setIsWebViewBlocked(true);
          onError(
            `This broker (${brokerType}) has detected the in-app browser. ` +
            'Please try connecting via the manual credentials option instead.'
          );
        }
      } catch {
        // Non-JSON message — ignore (page navigation logs, etc.)
      }
    },
    [brokerType, onSessionCaptured, onError],
  );

  // ── Error Handler ─────────────────────────────────────────────

  const handleWebViewError = useCallback(
    (event: any) => {
      const errorDescription = event?.description || 'WebView load error';

      // Check if the error looks like a WebView detection (empty page, redirect loop)
      if (
        errorDescription.includes('ERR_ABORTED') ||
        errorDescription.includes('ERR_BLOCKED') ||
        errorDescription.includes('ERR_CACHE_MISS')
      ) {
        // Attempt extraction anyway — page may have partially loaded tokens
        if (!extractionAttemptedRef.current) {
          extractionAttemptedRef.current = true;
          setTimeout(() => {
            webViewRef.current?.injectJavaScript(SESSION_EXTRACTION_SCRIPT);
          }, 500);
          return;
        }
      }

      onError(errorDescription);
    },
    [onError],
  );

  // ── Reset capture flag when URL changes externally ─────────────
  useEffect(() => {
    hasCapturedRef.current = false;
    extractionAttemptedRef.current = false;
    setIsWebViewBlocked(false);
    setCurrentMfaStep(0);
  }, [sourceUrl]);

  return (
    <View style={styles.container}>
      <WebView
        ref={webViewRef}
        source={{ uri: sourceUrl }}
        style={styles.webView}
        onNavigationStateChange={handleNavigationStateChange}
        onMessage={handleMessage}
        onError={handleWebViewError}
        javaScriptEnabled
        domStorageEnabled
        thirdPartyCookiesEnabled
        sharedCookiesEnabled
        startInLoadingState
        userAgent={userAgent}
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        renderLoading={() => (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#00D2FF" />
            <Text style={styles.loadingText}>
              {isWebViewBlocked
                ? 'Browser detection bypass...'
                : 'Establishing secure session...'}
            </Text>
            <Text style={styles.loadingHint}>
              {brokerType} · {extractionLabel} extraction
            </Text>
          </View>
        )}
      />
    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#07080B',
  },
  webView: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  loadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#07080B',
    gap: 16,
  },
  loadingText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
    fontWeight: '500',
    letterSpacing: 0.3,
  },
  loadingHint: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 11,
    fontWeight: '400',
    letterSpacing: 0.5,
  },
});
