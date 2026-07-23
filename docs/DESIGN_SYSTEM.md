# 🎨 Toroloom — Design System

## Overview

Toroloom uses a **dark-first, institutional-grade design system** with a deep sapphire black canvas, electric blue accents, and subtle glassmorphic elements.

| Token | Value | Usage |
|-------|-------|-------|
| Background | `#06080C` | App canvas |
| Primary | `#3B82F6` | CTAs, links, active states |
| Accent | `#00E676` | Success, gain indicators |
| Danger | `#FF5252` | Errors, loss indicators |
| Text | `#E0E6ED` | Primary body text |
| Text Muted | `#475569` | Secondary labels |

## Component Library

All UI components live in `src/components/ui/`:

| Component | File | Storybook |
|-----------|------|-----------|
| Button | `Button.tsx` | ✅ `Button.stories.tsx` |
| Card | `Card.tsx` | ✅ `Card.stories.tsx` |
| Input | `Input.tsx` | ✅ `Input.stories.tsx` |
| Badge | `Badge.tsx` | ✅ `Badge.stories.tsx` |
| AnimatedPressable | `AnimatedPressable.tsx` | ✅ `AnimatedPressable.stories.tsx` |
| SkeletonLoader | `SkeletonLoader.tsx` | ✅ `SkeletonLoader.stories.tsx` |
| OfflineBanner | `OfflineBanner.tsx` | ✅ `OfflineBanner.stories.tsx` |
| OptimizedImage | `OptimizedImage.tsx` | ✅ `OptimizedImage.stories.tsx` |
| SyncStatusIndicator | `SyncStatusIndicator.tsx` | ✅ `SyncStatusIndicator.stories.tsx` |
| SyncConflictModal | `SyncConflictModal.tsx` | ✅ `SyncConflictModal.stories.tsx` |
| ToroloomLogo | `ToroloomLogo.tsx` | ✅ `ToroloomLogo.stories.tsx` |
| MetallicShieldSVG | `MetallicShieldSVG.tsx` | ✅ `MetallicShieldSVG.stories.tsx` |

## Design Tokens

Defined in `src/constants/theme.ts`:

### Colors
```ts
COLORS.bg          // #06080C — App background
COLORS.primary     // #3B82F6 — Brand primary
COLORS.accent      // #00E676 — Success/green
COLORS.danger      // #FF5252 — Error/red
COLORS.text        // #E0E6ED — Body text
COLORS.textMuted   // #475569 — Muted labels
COLORS.border      // rgba(255,255,255,0.07) — Subtle borders
```

### Gradients
```ts
GRADIENTS.primary   // ['#3B82F6', '#1D4ED8']
GRADIENTS.accent    // ['#00E676', '#00C853']
GRADIENTS.danger    // ['#FF5252', '#D32F2F']
GRADIENTS.card      // Glassmorphic card background
```

### Spacing
```ts
SPACING.xs = 4      // Tight gaps
SPACING.sm = 8      // Internal padding
SPACING.md = 12     // Section gaps
SPACING.lg = 16     // Card padding
SPACING.xl = 20     // Screen padding
SPACING.xxl = 24    // Large sections
SPACING.xxxl = 32   // Page headers
```

### Typography
```ts
FONTS.regular       // Inter-Regular, 400
FONTS.medium        // Inter-Medium, 500
FONTS.semiBold      // Inter-SemiBold, 600
FONTS.bold          // Inter-Bold, 700
FONTS.size.sm = 12  // Labels
FONTS.size.md = 14  // Body
FONTS.size.lg = 16  // Subheadings
FONTS.size.xl = 18  // Headings
FONTS.size.title = 28  // Page titles
```

### Border Radius
```ts
BORDER_RADIUS.sm = 8     // Input fields
BORDER_RADIUS.md = 12    // Cards
BORDER_RADIUS.lg = 16    // Buttons, modals
BORDER_RADIUS.xl = 20    // Profile cards
BORDER_RADIUS.full = 999 // Badges, pills
```

## Component Patterns

### Button
- 6 variants: `primary`, `secondary`, `outline`, `ghost`, `danger`, `success`
- 3 sizes: `small`, `medium`, `large`
- States: `loading` (shows spinner), `disabled` (0.5 opacity)
- Optional `icon` node, optional `gradient` override
- Uses `AnimatedPressable` for scale + haptic feedback

### Card
- `title` + `subtitle` in header section
- Optional `gradient` background (subtle brand colors)
- Optional `rightAction` element (chevron, button)
- Optional `animated` entry (fade-in + slide-up via Reanimated)
- `noPadding` prop for full-bleed content

### Input
- `label` above field + `placeholder` inside
- `icon` on the left (Ionicons)
- `error` state with red border + error message
- `secureTextEntry` with toggle visibility button
- `multiline` for longer text
- Auto-valid icon on non-empty, non-error, focused state

## Getting Started

### Install Storybook
```bash
npm install -D @storybook/react @storybook/react-vite @storybook/addon-essentials @storybook/addon-links @storybook/addon-interactions @storybook/addon-a11y
```

### Run Storybook
```bash
npm run storybook:dev
# or: npx storybook dev -p 6006
```

### Build Static Storybook
```bash
npm run build-storybook
```

### Create New Component
1. Create `src/components/ui/YourComponent.tsx`
2. Use `useTheme()` for colors
3. Style with `createStyles(colors)` pattern
4. Add story: `YourComponent.stories.tsx`
5. Register in `docs/DESIGN_SYSTEM.md`
