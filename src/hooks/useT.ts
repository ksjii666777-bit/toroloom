/**
 * ============================================================================
 * Toroloom — useT Hook
 * ============================================================================
 *
 * A convenience wrapper around react-i18next's useTranslation().
 * Provides a simple `t()` function for string translation and a
 * `language` property to check/set the current language.
 *
 * Usage:
 *   const { t, language, isHindi, toggleLanguage } = useT();
 *   <Text>{t('auth.welcomeBack')}</Text>
 *   toggleLanguage(); // Switch between en/hi
 * ============================================================================
 */

import { useTranslation } from 'react-i18next';
import { isHindi, toggleLanguage } from '../i18n';

export function useT() {
  const { t, i18n } = useTranslation();

  return {
    /** Translate a key. Supports interpolation: t('key', { count: 5 }) */
    t: (key: string, params?: Record<string, any>): string => {
      const result = t(key, params);
      // If the key is not found, i18next returns the key itself.
      // Fall back to the key as a display string in that case.
      return result || key;
    },
    /** Current language code: 'en' or 'hi' */
    language: i18n.language,
    /** Is current language Hindi? */
    isHindi: isHindi(),
    /** Toggle between English and Hindi */
    toggleLanguage,
  };
}

export default useT;
