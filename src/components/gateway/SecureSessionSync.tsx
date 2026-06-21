/**
 * ============================================================================
 * Toroloom — Secure Session Sync (Zero-API Hybrid Gateway)
 * ============================================================================
 *
 * High-performance WebView wrapper that intercepts broker OAuth/session flows
 * and silently extracts session-state payloads (cookies, localStorage,
 * sessionStorage) after MFA/TOTP completion. Sends the extracted payload
 * back to the React Native main thread via postMessage for encrypted storage
 * in the device keychain.
 *
 * Broker dashboard URLs:
 *   Angel One  → https://smartapi.angelbroking.com/*
 *   Zerodha    → https://kite.zerodha.com/*
 *   Groww      → https://groww.in/*
 *
 * ============================================================================
 */

import React, { useCallback, useRef, useEffect, useMemo } from 'react';
import { View, StyleSheet, ActivityIndicator, Text } from 'react-native';
import { WebView, WebViewNavigation } from 'react-native-webview';
import type { SessionPayload } from '../../types';

// ─── Configuration ─────────────────────────────────────────────────────────

interface SecureSessionSyncProps {
  /** The broker OAuth / login URL to load in the WebView */
  sourceUrl: string;
  /** Broker type identifier for the session record */
  brokerType: string;
  /** Called when a valid session payload has been extracted */
  onSessionCaptured: (payload: SessionPayload) => void;
  /** Called when the WebView encounters a non-recoverable error */
  onError: (error: string) => void;
  /** Called when the user should close / cancel the WebView */
  onClose: () => void;
  /** Optional MFA/TOTP detection URL patterns */
  mfaDetectionPatterns?: string[];
  /** Optional known dashboard URLs that indicate login success */
  dashboardUrlPatterns?: string[];
}

// ─── Injected JavaScript ──────────────────────────────────────────────────
// This silently executes inside the WebView after the page loads and extracts
// every session artifact available in the browser context.

const SESSION_EXTRACTION_SCRIPT = `
(function() {
  try {
    var payload = {
      cookies: document.cookie || '',
      localStorage: {},
      sessionStorage: {},
      url: window.location.href,
      userAgent: navigator.userAgent,
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

// ─── Component ─────────────────────────────────────────────────────────────

export default function SecureSessionSync({
  sourceUrl,
  brokerType,
  onSessionCaptured,
  onError,
  onClose,
  mfaDetectionPatterns,
  dashboardUrlPatterns,
}: SecureSessionSyncProps) {
  const webViewRef = useRef<WebView>(null);
  const hasCapturedRef = useRef(false);

  // Default dashboard & MFA URL patterns for supported brokers
  const dashPatterns = useMemo(
    () =>
      dashboardUrlPatterns ?? [
        'kite.zerodha.com/',
        'smartapi.angelbroking.com/',
        'groww.in/dashboard',
        'groww.in/stocks',
        'groww.in/account',
      ],
    [dashboardUrlPatterns],
  );

  const mfaPatterns = useMemo(
    () =>
      mfaDetectionPatterns ?? [
        'totp',
        'mfa',
        'otp',
        'two-factor',
        '2fa',
        'verify',
        'authenticate',
        'security',
      ],
    [mfaDetectionPatterns],
  );

  /**
   * Determine if the current URL indicates MFA completion (user has logged in).
   * We check against known dashboard URL patterns and high-value token params.
   */
  const isDashboardUrl = useCallback(
    (url: string): boolean => {
      const lowerUrl = url.toLowerCase();
      return dashPatterns.some(pattern => lowerUrl.includes(pattern));
    },
    [dashPatterns],
  );

  /**
   * Determine if the URL contains MFA/TOTP challenge indicators.
   */
  const _isMfaUrl = useCallback(
    (url: string): boolean => {
      const lowerUrl = url.toLowerCase();
      return mfaPatterns.some(pattern => lowerUrl.includes(pattern));
    },
    [mfaPatterns],
  );

  /**
   * Determine if the URL contains evidence of successful authentication
   * by scanning for broker-specific auth tokens in the query string.
   */
  const hasAuthTokens = useCallback((url: string): boolean => {
    const lowerUrl = url.toLowerCase();
    return (
      lowerUrl.includes('request_token=') ||
      lowerUrl.includes('status=success') ||
      lowerUrl.includes('access_token=') ||
      lowerUrl.includes('enctoken=') ||
      lowerUrl.includes('jwt=') ||
      lowerUrl.includes('authorization_code=')
    );
  }, []);

  // ── Navigation State Handler ─────────────────────────────────
  const handleNavigationStateChange = useCallback(
    (navState: WebViewNavigation) => {
      const { url } = navState;

      // Skip intermediate fragment / hash changes
      if (!url || url === 'about:blank') return;

      // Detect post-MFA landing — when the user reaches a dashboard URL
      // or the URL carries auth tokens, trigger session extraction
      if (
        !hasCapturedRef.current &&
        (isDashboardUrl(url) || hasAuthTokens(url))
      ) {
        hasCapturedRef.current = true;

        // Inject the extraction script after a short delay to ensure the
        // dashboard has fully loaded and cookies are settled
        setTimeout(() => {
          webViewRef.current?.injectJavaScript(SESSION_EXTRACTION_SCRIPT);
        }, 1500);
      }
    },
    [isDashboardUrl, hasAuthTokens],
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
        }
      } catch (err) {
        // Non-JSON message — ignore (page navigation logs, etc.)
      }
    },
    [brokerType, onSessionCaptured, onError],
  );

  // ── Error Handler ─────────────────────────────────────────────
  const handleWebViewError = useCallback(
    (event: any) => {
      onError(event?.description || 'WebView load error');
    },
    [onError],
  );

  // ── Reset capture flag when URL changes externally ─────────────
  useEffect(() => {
    hasCapturedRef.current = false;
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
        renderLoading={() => (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#00D2FF" />
            <Text style={styles.loadingText}>
              Establishing secure session...
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
});
