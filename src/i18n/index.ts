/**
 * ============================================================================
 * Toroloom — Internationalization (i18n) Configuration
 * ============================================================================
 *
 * Supports English (en) and Hindi (hi) with automatic device language detection.
 * Falls back to English if device language is not Hindi.
 *
 * Usage:
 *   import { useTranslation } from 'react-i18next';
 *   const { t } = useTranslation();
 *   <Text>{t('auth.welcomeBack')}</Text>
 *
 * To change language at runtime:
 *   import { changeLanguage } from 'i18next';
 *   changeLanguage('hi'); // Switch to Hindi
 *   changeLanguage('en'); // Switch to English
 * ============================================================================
 */

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { I18nManager } from 'react-native';
import en from './locales/en';
import hi from './locales/hi';

/**
 * Detect the device language using React Native's built-in I18nManager.
 * This avoids pulling in expo-localization (which requires a native module).
 * Falls back to 'en' when the locale cannot be determined.
 */
function getDeviceLanguage(): string {
  try {
    // Android: I18nManager.getConstants().localeIdentifier (e.g. "hi_IN")
    // iOS: I18nManager.getConstants().localeIdentifier (e.g. "hi-IN")
    const localeId = I18nManager.getConstants().localeIdentifier;
    if (localeId && typeof localeId === 'string') {
      return localeId.replace(/[-_].*$/, '');
    }
  } catch {
    // Fall through to default
  }
  return 'en';
}

const deviceLanguage = getDeviceLanguage();
const supportedLanguages = ['en', 'hi'];
const defaultLanguage = supportedLanguages.includes(deviceLanguage) ? deviceLanguage : 'en';

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    hi: { translation: hi },
  },
  lng: defaultLanguage,
  fallbackLng: 'en',
  interpolation: {
    escapeValue: false, // React Native doesn't need HTML escaping
  },
  compatibilityJSON: 'v4', // Ensures flat namespace works on all platforms
  returnNull: false,
  returnEmptyString: false,
});

export default i18n;

/**
 * Helper to check if the current language is Hindi
 */
export const isHindi = (): boolean => i18n.language === 'hi';

/**
 * Toggle between English and Hindi
 */
export const toggleLanguage = (): void => {
  const next = i18n.language === 'hi' ? 'en' : 'hi';
  i18n.changeLanguage(next);
};
