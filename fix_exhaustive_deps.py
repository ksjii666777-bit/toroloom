"""
Fix all missing-effect-dependencies warnings across the codebase.

This script:
1. Finds all useEffect/useCallback/useMemo/useImperativeHandle calls
2. Extracts the callback body and existing deps array
3. Identifies identifiers used in the callback but missing from deps
4. Skips stable values (refs, shared values, setters, built-ins)
5. Adds missing deps to the array

Usage: python fix_exhaustive_deps.py
"""

import re
import os
import sys

# Files with missing deps to process
AFFECTED_FILES = [
    "src/components/AppContent.tsx",
    "src/components/AvatarWidget.tsx",
    "src/components/BiometricUnlockOverlay.tsx",
    "src/components/CandlestickChart.tsx",
    "src/components/IronLockOverlay.tsx",
    "src/components/PnLChart.tsx",
    "src/components/StockChart.tsx",
    "src/components/TechnicalIndicators.tsx",
    "src/components/UpgradePromptModal.tsx",
    "src/components/chart/DrawingTools.tsx",
    "src/components/chart/SkiaCandlestickChart.tsx",
    "src/components/chart/SkiaChartUtils.ts",
    "src/components/fno/OptionsScannerPanel.tsx",
    "src/components/fno/PriceTrendChart.tsx",
    "src/components/fno/StrategyCanvas.tsx",
    "src/components/gateway/SecureSessionSync.tsx",
    "src/components/onboarding/OnboardingIllustrations.tsx",
    "src/components/onboarding/OnboardingLottie.tsx",
    "src/components/stock/FullscreenChartModal.tsx",
    "src/components/stock/KeyStatsGrid.tsx",
    "src/components/ui/Badge.tsx",
    "src/components/ui/Card.tsx",
    "src/components/ui/SkeletonLoader.tsx",
    "src/components/ui/SyncConflictModal.tsx",
    "src/components/ui/SyncStatusIndicator.tsx",
    "src/components/video/VideoLessonPlayer.tsx",
    "src/context/ThemeContext.tsx",
    "src/hooks/useStaggeredAnimation.ts",
    "src/navigation/AppNavigator.tsx",
    "src/screens/NotificationsScreen.tsx",
    "src/screens/SplashScreen.tsx",
    "src/screens/achievements/AchievementsScreen.tsx",
    "src/screens/ai/AITradeAssistantScreen.tsx",
    "src/screens/ai/EarningsCallScreen.tsx",
    "src/screens/ai/LiveFeedScreen.tsx",
    "src/screens/ai/SentimentAlertScreen.tsx",
    "src/screens/ai/SentimentAnalysisScreen.tsx",
]

PROJECT_ROOT = "C:/Users/Karan/Desktop/New folder/Toroloom"

# 🏷️ Identifiers that are STABLE and should NOT be added to deps
# These are ref-like objects, built-in APIs, and constants

STABLE_IDENTIFIER_PATTERNS = [
    # Reanimated shared values - they are ref-like
    r'^\w+Anim$',  # ends with Anim (like fadeAnim, scaleAnim)
    r'^\w+SV$',    # ends with SV (shared value)
    r'^pulse\w*',  # starts with pulse
    r'^glow\w*',   # starts with glow
    r'^slide\w*',  # starts with slide
    r'^modal\w*',  # starts with modal
    r'^entry\w*',  # starts with entry
    r'^candle\w*', # starts with candle
    r'^segment\w*',# starts with segment
    r'^\w*Ref$',    # ends with Ref (useRef)
    r'^\w*Ref\w*$', # contains Ref
    r'^prev\w*Ref$',# prev*Ref
    r'^\w*AnimProps$', # ends with AnimProps
    r'^\w*Style$', # ends with Style (animated styles)
    r'^\w*Scale$', # starts with *Scale
    r'^\w*Opacity$', # *Opacity
    r'^\w*Progress$', # *Progress
    r'^\w*TranslateY$', # *TranslateY
    r'^\w*Offset$', # *Offset
    r'^progressValues$',
    r'^v\d{1,2}$',  # v0, v1, v2, etc.
    r'^a\d{1,2}$',  # a0, a1, a2, etc.
    r'^\w*Scroll$',  # scrollOffset, localScroll, etc.
    r'^crosshair\w*$',
    r'^\w*PanResponder$',
]

STABLE_IDENTIFIERS_SET = {
    # React refs
    'webViewRef', 'prevLockdownRef', 'prevPnLRef', 'dismissTimerRef',
    'prevBadgeCount', 'iconIntervalRef', 'prevVisibleRef',
    'transcriptScrollRef', 'watchedRef', 'pinchRef', 'panRef',
    'lastTapRef', 'historyRef', 'prevDataLen', 'colorIndexRef',
    'prevColorRef', 'scaleAnim', 'hasCapturedRef', 'extractionAttemptedRef',
    'currentUrlRef', 'routeNameRef',
    # State setters (stable)
    'setVisible', 'setError', 'setIsAuthenticating', 'setBiometricLabel',
    'setBiometricIcon', 'setShowSearch', 'setSearchQuery',
    'setCurrentMfaStep', 'setIsWebViewBlocked',
    'setExpanded', 'setMessage', 'setAvatarState',
    'setIconName', 'setTimeRemaining',
    'setTooltip', 'setPrevDataLength', 'setSelectedDrawingId',
    'setCanUndo', 'setCanRedo', 'setShowAnnotationInput',
    'setAnnotationText', 'setPendingPoint', 'setPreviewPoint',
    'setActiveTab', 'setDiagnosticIndex', 'setSelectedBadge',
    'setShowTab', 'setShowTypeMenu', 'setLocalChartType',
    'setLocalZoom', 'setLocalScroll', 'setStaleCount',
    'setOldestLabel', 'setActionLoading', 'setIsVisible',
    'setShowTranscript', 'setShowBookmarks', 'setIsPlaying',
    'setCurrentTime', 'setDuration', 'setPlaybackSpeed',
    'setOverlayBlocking', 'setLocalIndicators',
    'setShowTranscriptExt', 'setShowBookmarksExt', 'setScreenSize',
    # Dispatch / navigation
    'dispatch', 'navigation', 'navigate',
    # Built-in
    'console', 'Math', 'Date', 'JSON', 'setInterval', 'clearInterval',
    'setTimeout', 'clearTimeout', 'requestAnimationFrame',
    'fetch', 'Promise', 'parseInt', 'parseFloat', 'String', 'Number',
    'Object', 'Array', 'Boolean', 'RegExp',
    'isNaN', 'isFinite', 'undefined', 'null', 'true', 'false',
    'window', 'document', 'global', 'globalThis',
    'AppState', 'Dimensions', 'Platform', 'Linking', 'Alert',
    'Error', 'Map', 'Set', 'Symbol', 'BigInt',
    # Reanimated functions
    'withSpring', 'withTiming', 'withRepeat', 'withSequence',
    'withDelay', 'interpolate', 'runOnJS', 'Easing',
    # Haptics
    'Haptics',
    # RN Animated
    'Animated',  # React Native Animated
    # Third-party
    'Ionicons', 'Svg', 'Path', 'Line', 'Rect', 'G', 'Circle',
    'SvgText', 'Stop', 'Defs', 'LinearGradient', 'Ellipse',
    'LinearGradient as SvgLinearGradient',
]

def is_stable_identifier(name):
    """Check if an identifier is stable and should not be added to deps."""
    if name in STABLE_IDENTIFIERS_SET:
        return True
    for pattern in STABLE_IDENTIFIER_PATTERNS:
        if re.match(pattern, name):
            return True
    return False

def find_hook_calls(content):
    """Find all useEffect/useCallback/useMemo calls and their positions."""
    hook_calls = []
    
    # Pattern: hookName(() => { ... }, [deps])
    # or hookName(() => ..., [deps])
    # or hookName(callback, [deps])
    # or hookName(() => (...), [deps])
    
    hook_pattern = re.compile(
        r'(useEffect|useCallback|useMemo|useImperativeHandle)\s*\(\s*'
        r'(\(\)\s*=>\s*)?'
        r'('
        r'(?:[^{};]+|\{[^{}]*\})*'
        r')'
        r'\s*,\s*'
        r'\[([^\]]*)\]'
        r'\s*\)',
        re.DOTALL
    )
    
    for match in hook_pattern.finditer(content):
        hook_name = match.group(1)
        callback_body = match.group(0)
        deps_str = match.group(4) if match.lastindex >= 4 else ''
        
        # Parse existing deps
        existing_deps = set()
        if deps_str.strip():
            # Extract identifiers from deps
            for dep in deps_str.split(','):
                dep = dep.strip()
                if dep:
                    existing_deps.add(dep)
        
        hook_calls.append({
            'start': match.start(),
            'end': match.end(),
            'hook_name': hook_name,
            'callback_body': callback_body,
            'deps_str': deps_str,
            'existing_deps': existing_deps,
        })
    
    return hook_calls

def find_missing_deps(callback_body, existing_deps, content_scope):
    """Find identifiers used in callback but missing from deps."""
    # Extract all identifiers from the callback body
    # Simple approach: find all word tokens
    identifiers = set(re.findall(r'\b([a-zA-Z_$][\w$]*)\b', callback_body))
    
    # Remove JS keywords, types, and scope identifiers
    skip = {
        'return', 'if', 'else', 'for', 'while', 'do', 'switch', 'case',
        'break', 'continue', 'function', 'var', 'let', 'const', 'new',
        'this', 'super', 'class', 'import', 'export', 'from', 'of',
        'in', 'typeof', 'instanceof', 'void', 'delete', 'try', 'catch',
        'finally', 'throw', 'async', 'await', 'yield', 'as', 'type',
        'interface', 'enum', 'implements', 'extends',
        # Common non-reactive
        'props', 'state', 'event', 'e', 'ref', 'key',
        # Animated properties
        'value', 'toValue', 'duration', 'finished',
        # Callback params
        'nextState', 'url', 'event', 'error',
        # SVG attributes
        'x', 'y', 'x1', 'y1', 'x2', 'y2', 'cx', 'cy', 'r', 'rx', 'ry',
        'width', 'height', 'fill', 'stroke', 'opacity', 'transform',
        'd', 'points', 'viewBox', 'textAnchor', 'fontSize', 'fontFamily',
        'fontWeight', 'strokeWidth', 'strokeDasharray', 'strokeLinecap',
        'strokeLinejoin', 'letterSpacing', 'textTransform',
        # React concepts
        'children', 'style', 'key', 'ref',
        # Hooks
        'useEffect', 'useCallback', 'useMemo', 'useState', 'useRef',
        'useSharedValue', 'useAnimatedStyle', 'useAnimatedProps',
        'useSafeAreaInsets', 'useNavigation', 'useTheme',
        'useChartCrosshair',
        # Common param names
        't', 'i', 'j', 'k', 'v', 'idx', 'val', 'acc', 'prev',
        'result', 'data', 'item', 'index', 'key',
        'screenName', 'state', 'url', 'ref', 'id',
        'touchX', 'touchY', 'price', 'value', 'color',
        'isActive', 'hasInteracted', 'isPlaying',
        # Module names
        'React', 'useState', 'useMemo', 'useCallback', 'useEffect',
        'useRef', 'StyleSheet', 'View', 'Text', 'TouchableOpacity',
        'ScrollView', 'Pressable', 'Switch',
    }
    
    identifiers -= skip
    
    # Filter out stable identifiers
    missing = set()
    for ident in identifiers:
        if ident not in existing_deps and not is_stable_identifier(ident):
            # Check if it's a number or starts with a number
            if not ident[0].isdigit() and not ident.startswith('_'):
                missing.add(ident)
    
    return missing

def fix_file(filepath):
    """Fix missing deps in a single file."""
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    original = content
    
    # Find all hook calls
    # We need a more sophisticated approach using regex
    # Pattern for useEffect(() => { ... }, [deps])
    
    fixes_made = 0
    
    # Find all useEffect calls with their full range
    # Match: useEffect( ()=>{...}, [...] ) or useEffect( ()=>(...), [...] )
    # or useEffect( function() {...}, [...] )
    
    idx = 0
    while idx < len(content):
        # Look for hook call start
        hook_match = re.compile(
            r'(useEffect|useCallback|useMemo|useImperativeHandle)\s*\(',
            re.DOTALL
        ).search(content, idx)
        
        if not hook_match:
            break
        
        hook_start = hook_match.start()
        hook_name = hook_match.group(1)
        
        # Find the matching closing paren for the hook call
        # We need to handle nested parens
        paren_depth = 1
        pos = hook_match.end()
        
        # First, skip the callback body
        # The callback could be:
        # 1. () => { ... }
        # 2. () => ( ... )
        # 3. () => expression
        # 4. function() { ... }
        # 5. callback_name
        
        # Look for arrow function or function keyword
        arrow_match = re.compile(r'\(\s*\)\s*=>\s*(\{|\(|[\w])', re.DOTALL).search(content, pos)
        func_match = re.compile(r'function\s*\(', re.DOTALL).search(content, pos)
        
        if not arrow_match and not func_match:
            # Simple expression callback like useMemo(() => expr, [deps])
            pass
        
        if arrow_match and arrow_match.start() < (func_match.start() if func_match else float('inf')):
            pos = arrow_match.end()
            # Remove the opening brace/bracket
            callback_end = arrow_match.group(1)
            if callback_end == '{':
                # Find the matching closing brace
                brace_depth = 1
                while pos < len(content) and brace_depth > 0:
                    if content[pos] == '{':
                        brace_depth += 1
                    elif content[pos] == '}':
                        brace_depth -= 1
                    pos += 1
            elif callback_end == '(':
                paren_depth = 1
                while pos < len(content) and paren_depth > 0:
                    if content[pos] == '(':
                        paren_depth += 1
                    elif content[pos] == ')':
                        paren_depth -= 1
                    pos += 1
            else:
                # Expression like () => expression
                # Go to the comma
                pass
        elif func_match:
            pos = func_match.end()
            # Skip function body
            while pos < len(content) and content[pos] != '{':
                pos += 1
            if pos < len(content):
                pos += 1  # skip {
                brace_depth = 1
                while pos < len(content) and brace_depth > 0:
                    if content[pos] == '{':
                        brace_depth += 1
                    elif content[pos] == '}':
                        brace_depth -= 1
                    pos += 1
        
        # Now find the deps array [ ... ]
        # Skip whitespace and comma
        while pos < len(content) and content[pos] in ' \n\r\t,':
            pos += 1
        
        if pos < len(content) and content[pos] == '[':
            # Extract the deps array
            dep_start = pos
            paren_depth = 1
            pos += 1
            while pos < len(content) and paren_depth > 0:
                if content[pos] == '[':
                    paren_depth += 1
                elif content[pos] == ']':
                    paren_depth -= 1
                pos += 1
            dep_end = pos
        
        # Find the closing paren of the hook call
        while pos < len(content) and paren_depth > 0:
            if content[pos] == '(':
                paren_depth += 1
            elif content[pos] == ')':
                paren_depth -= 1
            pos += 1
        
        # Extract callback body
        callback_body = content[hook_match.end():dep_start]
        dep_array = content[dep_start:dep_end] if 'dep_start' in dir() else '[]'
        
        # Parse existing deps
        existing_deps = set()
        dep_content = dep_array.strip('[] \n\r\t')
        if dep_content:
            for dep in dep_content.split(','):
                dep = dep.strip()
                if dep:
                    existing_deps.add(dep)
        
        # Find missing deps
        missing = find_missing_deps(callback_body, existing_deps, content)
        
        if missing:
            print(f"  {hook_name}: missing deps: {missing}")
            # Add missing deps to array
            new_deps = sorted(existing_deps | missing, key=lambda x: (x.startswith('_'), x))
            new_dep_str = ', '.join(new_deps)
            
            if dep_content.strip():
                # Replace existing deps
                before = content[:dep_start + 1]
                after = content[dep_end - 1:]
                content = before + new_dep_str + after
            else:
                # Empty deps, add new ones
                before = content[:dep_start + 1]
                after = content[dep_end - 1:]
                content = before + new_dep_str + after
            
            fixes_made += 1
        
        idx = pos
    
    if fixes_made > 0:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"✅ {filepath}: Fixed {fixes_made} hooks")
        return True
    else:
        print(f"⏭️ {filepath}: No fixes needed")
        return False

def main():
    total_fixes = 0
    root = PROJECT_ROOT
    
    for filepath in AFFECTED_FILES:
        full_path = os.path.join(root, filepath)
        if os.path.exists(full_path):
            fixed = fix_file(full_path)
            if fixed:
                total_fixes += 1
        else:
            print(f"❌ {full_path}: File not found")
    
    print(f"\n{'='*60}")
    print(f"Total files fixed: {total_fixes}/{len(AFFECTED_FILES)}")

if __name__ == '__main__':
    main()
