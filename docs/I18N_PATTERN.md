# 🌐 Toroloom — i18n Pattern Guide

## Current Status

| Language | File | Status |
|----------|------|--------|
| English | `src/i18n/locales/en.ts` | ✅ 500+ strings (complete) |
| Hindi | `src/i18n/locales/hi.ts` | ✅ 500+ strings (full translation) |

**Screens using `useT()`:** LoginScreen, SignupScreen, ProfileScreen, HomeScreen, MarketsScreen, PortfolioScreen, WatchlistScreen, StockDetailScreen, MoreScreen
**Screens still hardcoded:** ~98 remaining

---

## 🎯 The Pattern

### 1. Import + Use
```tsx
import { useT } from '../../hooks/useT';

function MyScreen() {
  const { t } = useT();
  // ...
}
```

### 2. Button — `title` prop
```tsx
// ❌ Before:
<Button title="Log In" onPress={handleLogin} />

// ✅ After:
<Button title={t('auth.login')} onPress={handleLogin} />
```

### 3. Card — `title` and `subtitle` props
```tsx
// ❌ Before:
<Card title="Portfolio" subtitle="Track your investments">
  {children}
</Card>

// ✅ After:
<Card title={t('portfolio.title')} subtitle={t('portfolio.subtitle')}>
  {children}
</Card>
```

### 4. Input — `label` and `placeholder` props
```tsx
// ❌ Before:
<Input
  label="Email"
  placeholder="Enter your email"
  value={email}
  onChangeText={setEmail}
/>

// ✅ After:
<Input
  label={t('auth.email')}
  placeholder={t('auth.emailPlaceholder')}
  value={email}
  onChangeText={setEmail}
/>
```

### 5. Plain Text
```tsx
// ❌ Before:
<Text style={styles.title}>Welcome Back! 👋</Text>

// ✅ After:
<Text style={styles.title}>{t('auth.welcomeBack')}</Text>
```

### 6. Interpolation (dynamic values)
```tsx
// ❌ Before:
<Text>Results (5)</Text>

// ✅ After:
<Text>{t('market.results', { count: 5 })}</Text>
```

### 7. Pluralization
```tsx
// en.ts:  "holdingsCount": "{{count}} holdings"
// hi.ts:  "holdingsCount": "{{count}} होल्डिंग्स"

<Text>{t('portfolio.holdingsCount', { count: holdings.length })}</Text>
// → "3 holdings" (en) / "3 होल्डिंग्स" (hi)
```

---

## 🔤 Adding Language Switcher

```tsx
import { useT } from '../../hooks/useT';

function SettingsSection() {
  const { t, language, isHindi, toggleLanguage } = useT();

  return (
    <Pressable onPress={toggleLanguage}>
      <Text>
        {isHindi ? '🇮🇳 हिंदी' : '🇬🇧 English'}
      </Text>
      <Text>
        {t('app.language')}: {language}
      </Text>
    </Pressable>
  );
}
```

---

## 🗺️ Adding a New Language

1. Create `src/i18n/locales/mr.ts` (Marathi example)
2. Copy `en.ts` structure, translate all values
3. Register in `src/i18n/index.ts`:
```ts
import mr from './locales/mr';

// In i18n.init():
resources: {
  en: { translation: en },
  hi: { translation: hi },
  mr: { translation: mr },  // ← add here
},

// Update supported languages:
const supportedLanguages = ['en', 'hi', 'mr'];
```

---

## ✅ Checklist for Converting a Screen

- [ ] `import { useT } from '../../hooks/useT';`
- [ ] `const { t } = useT();` inside component
- [ ] All `<Text>` strings → `{t('key')}`
- [ ] `<Button title="..."` → `title={t('key')}`
- [ ] `<Card title="..." subtitle="..."` → `title={t('key')} subtitle={t('key')}`
- [ ] `<Input label="..." placeholder="..."` → `label={t('key')} placeholder={t('key')}`
- [ ] `Alert.alert('Title', 'Message')` → `Alert.alert(t('key'), t('key'))`
- [ ] Check plural forms: `{{count}}` keys
- [ ] Check interpolation: `{{variable}}` keys
