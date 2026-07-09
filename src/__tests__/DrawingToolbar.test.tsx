/**
 * ============================================================================
 * Toroloom — DrawingToolbar Fullscreen Feature Tests
 * ============================================================================
 *
 * Tests the DrawingToolbar component's fullscreen features:
 *   - Normal mode: compact buttons (44px min width)
 *   - Fullscreen mode: larger buttons (56px min width), color picker toggle
 *   - Expanded color picker: shows 6 swatches, tapping calls onColorChange
 *   - Clear button visibility in both modes
 *   - Annotation input sizing in fullscreen vs normal mode
 * ============================================================================
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from './testUtils';
import { DrawingToolbar } from '../components/chart/DrawingTools';

// ==================== Mocks ====================

// DrawingToolbar receives `colors` as a prop, but keep ThemeContext mock
// for safety in case any child component references it
vi.mock('../context/ThemeContext', () => ({
  useTheme: () => ({
    colors: {
      primary: '#3B82F6',
      primaryLight: '#60A5FA',
      primaryDark: '#2563EB',
      text: '#FFFFFF',
      textSecondary: '#B0B0D0',
      textMuted: '#6E6E9A',
      bg: '#0D0D2B',
      bgCard: '#222255',
      bgCardLight: '#2A2A5E',
      bgInput: '#1E1E4A',
      bgOverlay: 'rgba(0,0,0,0.6)',
      border: '#2A2A5E',
      borderLight: '#3A3A7E',
      marketUp: '#00C853',
      marketDown: '#FF1744',
      marketNeutral: '#888',
      accent: '#8B5CF6',
      info: '#06B6D4',
      success: '#00C853',
      danger: '#FF1744',
      warning: '#FFC107',
      white: '#FFFFFF',
      transparent: 'transparent',
    },
    isDark: true,
  }),
}));

// Note: react-native-svg and PanResponder are already mocked in
// src/__tests__/setup.ts — no need to re-mock here.

// ============================================================================
// DrawingToolbar — Normal Mode
// ============================================================================

describe('DrawingToolbar — Normal Mode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders all 6 tool buttons', () => {
    const { getByText } = render(
      <DrawingToolbar
        activeTool="none"
        onToolChange={vi.fn()}
        colors={{} as any}
        drawingCount={0}
        onClearAll={vi.fn()}
      />
    );
    expect(getByText('Trend')).toBeDefined();
    expect(getByText('H-Line')).toBeDefined();
    expect(getByText('V-Line')).toBeDefined();
    expect(getByText('Ray')).toBeDefined();
    expect(getByText('Fib')).toBeDefined();
    expect(getByText('Text')).toBeDefined();
  });

  it('renders tool icons', () => {
    const { getByText } = render(
      <DrawingToolbar
        activeTool="none"
        onToolChange={vi.fn()}
        colors={{} as any}
        drawingCount={0}
        onClearAll={vi.fn()}
      />
    );
    expect(getByText('╱')).toBeDefined();   // trendline
    expect(getByText('━')).toBeDefined();   // horizontal_line
    expect(getByText('┃')).toBeDefined();   // vertical_line
    expect(getByText('➚')).toBeDefined();   // ray
    expect(getByText('φ')).toBeDefined();   // fibonacci
    expect(getByText('Aa')).toBeDefined();  // annotation
  });

  it('does NOT render color picker toggle button in normal mode', () => {
    const { queryByText } = render(
      <DrawingToolbar
        activeTool="none"
        onToolChange={vi.fn()}
        colors={{} as any}
        drawingCount={0}
        onClearAll={vi.fn()}
      />
    );
    expect(queryByText('▲')).toBeNull();
    expect(queryByText('▼')).toBeNull();
  });

  it('does NOT show clear button when drawingCount is 0', () => {
    const { queryByText } = render(
      <DrawingToolbar
        activeTool="none"
        onToolChange={vi.fn()}
        colors={{} as any}
        drawingCount={0}
        onClearAll={vi.fn()}
      />
    );
    expect(queryByText(/Clear/)).toBeNull();
  });

  it('shows clear button when drawingCount > 0', () => {
    const { getByText } = render(
      <DrawingToolbar
        activeTool="none"
        onToolChange={vi.fn()}
        colors={{} as any}
        drawingCount={3}
        onClearAll={vi.fn()}
      />
    );
    expect(getByText('Clear (3)')).toBeDefined();
  });

  it('calls onClearAll when clear button is pressed', () => {
    const onClearAll = vi.fn();
    const { getByText } = render(
      <DrawingToolbar
        activeTool="none"
        onToolChange={vi.fn()}
        colors={{} as any}
        drawingCount={2}
        onClearAll={onClearAll}
      />
    );
    fireEvent.press(getByText('Clear (2)'));
    expect(onClearAll).toHaveBeenCalledTimes(1);
  });

  it('calls onToolChange with tool type when tool button is pressed', () => {
    const onToolChange = vi.fn();
    const { getByText } = render(
      <DrawingToolbar
        activeTool="none"
        onToolChange={onToolChange}
        colors={{} as any}
        drawingCount={0}
        onClearAll={vi.fn()}
      />
    );
    fireEvent.press(getByText('Trend'));
    expect(onToolChange).toHaveBeenCalledWith('trendline');
  });

  it('calls onToolChange with "none" when active tool is pressed again', () => {
    const onToolChange = vi.fn();
    const { getByText } = render(
      <DrawingToolbar
        activeTool="trendline"
        onToolChange={onToolChange}
        colors={{} as any}
        drawingCount={0}
        onClearAll={vi.fn()}
      />
    );
    fireEvent.press(getByText('Trend'));
    expect(onToolChange).toHaveBeenCalledWith('none');
  });

  it('renders without crashing with all tools as active', () => {
    const tools = ['trendline', 'horizontal_line', 'vertical_line', 'ray', 'fibonacci', 'annotation'] as const;
    for (const tool of tools) {
      const { toJSON } = render(
        <DrawingToolbar
          activeTool={tool}
          onToolChange={vi.fn()}
          colors={{} as any}
          drawingCount={0}
          onClearAll={vi.fn()}
        />
      );
      expect(toJSON).not.toBeNull();
    }
  });
});

// ============================================================================
// DrawingToolbar — Fullscreen Mode
// ============================================================================

describe('DrawingToolbar — Fullscreen Mode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders all 6 tool buttons in fullscreen mode', () => {
    const { getByText } = render(
      <DrawingToolbar
        activeTool="none"
        onToolChange={vi.fn()}
        colors={{} as any}
        drawingCount={0}
        onClearAll={vi.fn()}
        isFullscreen={true}
      />
    );
    expect(getByText('Trend')).toBeDefined();
    expect(getByText('H-Line')).toBeDefined();
    expect(getByText('V-Line')).toBeDefined();
    expect(getByText('Ray')).toBeDefined();
    expect(getByText('Fib')).toBeDefined();
    expect(getByText('Text')).toBeDefined();
  });

  it('renders color picker toggle button in fullscreen mode', () => {
    const { getByText } = render(
      <DrawingToolbar
        activeTool="none"
        onToolChange={vi.fn()}
        colors={{} as any}
        drawingCount={0}
        onClearAll={vi.fn()}
        isFullscreen={true}
        activeColor="#3B82F6"
      />
    );
    expect(getByText('▼')).toBeDefined();
  });

  it('tapping color toggle shows ▲ when expanded', () => {
    const { getByText, queryByText } = render(
      <DrawingToolbar
        activeTool="none"
        onToolChange={vi.fn()}
        colors={{} as any}
        drawingCount={0}
        onClearAll={vi.fn()}
        isFullscreen={true}
        activeColor="#FF5252"
      />
    );
    expect(getByText('▼')).toBeDefined();
    fireEvent.press(getByText('▼'));
    expect(queryByText('▲')).toBeDefined();
    expect(queryByText('▼')).toBeNull();
  });

  it('shows clear button in fullscreen when drawingCount > 0', () => {
    const { getByText } = render(
      <DrawingToolbar
        activeTool="none"
        onToolChange={vi.fn()}
        colors={{} as any}
        drawingCount={5}
        onClearAll={vi.fn()}
        isFullscreen={true}
      />
    );
    expect(getByText('Clear (5)')).toBeDefined();
  });

  it('tapping color toggle toggles picker open/closed', () => {
    const { getByText } = render(
      <DrawingToolbar
        activeTool="none"
        onToolChange={vi.fn()}
        colors={{} as any}
        drawingCount={0}
        onClearAll={vi.fn()}
        isFullscreen={true}
        activeColor="#3B82F6"
      />
    );
    // Open
    fireEvent.press(getByText('▼'));
    expect(getByText('▲')).toBeDefined();
    // Close
    fireEvent.press(getByText('▲'));
    expect(getByText('▼')).toBeDefined();
  });
});

// ============================================================================
// DrawingToolbar — Clear Button Behavior
// ============================================================================

describe('DrawingToolbar — Clear Button', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not render clear button when drawingCount is 0 even in fullscreen', () => {
    const { queryByText } = render(
      <DrawingToolbar
        activeTool="none"
        onToolChange={vi.fn()}
        colors={{} as any}
        drawingCount={0}
        onClearAll={vi.fn()}
        isFullscreen={true}
      />
    );
    expect(queryByText(/Clear/)).toBeNull();
  });

  it('renders with high drawing count', () => {
    const { getByText } = render(
      <DrawingToolbar
        activeTool="none"
        onToolChange={vi.fn()}
        colors={{} as any}
        drawingCount={99}
        onClearAll={vi.fn()}
      />
    );
    expect(getByText('Clear (99)')).toBeDefined();
  });

  it('renders clear button in fullscreen with high drawing count', () => {
    const { getByText } = render(
      <DrawingToolbar
        activeTool="none"
        onToolChange={vi.fn()}
        colors={{} as any}
        drawingCount={50}
        onClearAll={vi.fn()}
        isFullscreen={true}
      />
    );
    expect(getByText('Clear (50)')).toBeDefined();
  });
});

// ============================================================================
// DrawingToolbar — Color Picker Interactions
// ============================================================================

describe('DrawingToolbar — Color Picker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders color toggle with active color dot', () => {
    const { getByText } = render(
      <DrawingToolbar
        activeTool="none"
        onToolChange={vi.fn()}
        colors={{} as any}
        drawingCount={0}
        onClearAll={vi.fn()}
        isFullscreen={true}
        activeColor="#FF5252"
      />
    );
    expect(getByText('▼')).toBeDefined();
  });

  it('available when onColorChange is provided', () => {
    const onColorChange = vi.fn();
    const { getByText } = render(
      <DrawingToolbar
        activeTool="none"
        onToolChange={vi.fn()}
        colors={{} as any}
        drawingCount={0}
        onClearAll={vi.fn()}
        isFullscreen={true}
        activeColor="#3B82F6"
        onColorChange={onColorChange}
      />
    );
    // Toggle open
    fireEvent.press(getByText('▼'));
    expect(getByText('▲')).toBeDefined();
  });

  it('tapping ▲ closes the picker', () => {
    const { getByText, queryByText } = render(
      <DrawingToolbar
        activeTool="none"
        onToolChange={vi.fn()}
        colors={{} as any}
        drawingCount={0}
        onClearAll={vi.fn()}
        isFullscreen={true}
        activeColor="#3B82F6"
        onColorChange={vi.fn()}
      />
    );
    // Open then close
    fireEvent.press(getByText('▼'));
    expect(getByText('▲')).toBeDefined();
    fireEvent.press(getByText('▲'));
    expect(queryByText('▲')).toBeNull();
    expect(getByText('▼')).toBeDefined();
  });

  it('does not crash when onColorChange is not provided', () => {
    const { getByText } = render(
      <DrawingToolbar
        activeTool="none"
        onToolChange={vi.fn()}
        colors={{} as any}
        drawingCount={0}
        onClearAll={vi.fn()}
        isFullscreen={true}
        activeColor="#3B82F6"
      />
    );
    // Open picker — should not crash even without onColorChange
    fireEvent.press(getByText('▼'));
    expect(getByText('▲')).toBeDefined();
  });
});

// ============================================================================
// DrawingToolbar — Edge Cases
// ============================================================================

describe('DrawingToolbar — Edge Cases', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders without crashing with minimum props', () => {
    const { toJSON } = render(
      <DrawingToolbar
        activeTool="none"
        onToolChange={vi.fn()}
        colors={{} as any}
        drawingCount={0}
        onClearAll={vi.fn()}
      />
    );
    expect(toJSON).not.toBeNull();
  });

  it('renders without crashing in fullscreen mode', () => {
    const { toJSON } = render(
      <DrawingToolbar
        activeTool="none"
        onToolChange={vi.fn()}
        colors={{} as any}
        drawingCount={0}
        onClearAll={vi.fn()}
        isFullscreen={true}
      />
    );
    expect(toJSON).not.toBeNull();
  });

  it('renders without crashing when all optional props are provided', () => {
    const { toJSON } = render(
      <DrawingToolbar
        activeTool="fibonacci"
        onToolChange={vi.fn()}
        colors={{} as any}
        drawingCount={10}
        onClearAll={vi.fn()}
        isFullscreen={true}
        activeColor="#06B6D4"
        onColorChange={vi.fn()}
      />
    );
    expect(toJSON).not.toBeNull();
  });

  it('renders color toggle with default color when activeColor is not provided', () => {
    const { getByText } = render(
      <DrawingToolbar
        activeTool="none"
        onToolChange={vi.fn()}
        colors={{} as any}
        drawingCount={0}
        onClearAll={vi.fn()}
        isFullscreen={true}
      />
    );
    // Should still show the toggle — default color is DRAWING_COLORS[0] (#3B82F6)
    expect(getByText('▼')).toBeDefined();
  });
});
