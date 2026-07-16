import React, { act } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from './testUtils';

// Override setup.ts react-native mock so FlatList actually renders items
vi.mock('react-native', () => {
  const React = require('react');

  function MockFlatList(props: any) {
    if (!props.data || props.data.length === 0) {
      return props.ListEmptyComponent || null;
    }
    // Render each item via renderItem and wrap in a View
    return React.createElement('View', null,
      ...props.data.map((item: any, idx: number) => {
        const element = props.renderItem({ item, index: idx });
        return element || null;
      })
    );
  }

  return {
    View: (props: any) => React.createElement('View', props, props.children),
    Text: (props: any) => React.createElement('Text', props, props.children),
    Pressable: (props: any) => React.createElement('View', { onPress: props.onPress, style: props.style }, props.children),
    TextInput: (props: any) => React.createElement('TextInput', props, props.children),
    ScrollView: (props: any) => React.createElement('ScrollView', props, props.children),
    StyleSheet: { create: (s: any) => s },
    FlatList: MockFlatList,
    Platform: { OS: 'ios' },
    KeyboardAvoidingView: (props: any) => React.createElement('View', null, props.children),
    ActivityIndicator: (props: any) => null,
    Modal: (props: any) => props.visible ? React.createElement('View', null, props.children) : null,
    TouchableOpacity: (props: any) => React.createElement('View', { onPress: props.onPress }, props.children),
    Animated: {
      View: (props: any) => React.createElement('View', props, props.children),
      Value: class { constructor(v: number) {}; interpolate() { return {}; } },
      timing: () => ({ start: (cb: any) => cb?.() }),
      spring: () => ({ start: (cb: any) => cb?.() }),
      parallel: () => ({ start: (cb: any) => cb?.() }),
    },
    Dimensions: { get: () => ({ width: 400, height: 800 }) },
    Keyboard: { dismiss: () => {} },
  };
});

vi.mock('../context/ThemeContext', () => ({
  useTheme: () => ({
    isDark: true,
    mode: 'dark',
    colors: {
      bg: '#0B0F19', text: '#FFFFFF', textSecondary: '#9CA3AF', textMuted: '#6B7280',
      primary: '#3B82F6', accent: '#10B981', marketUp: '#10B981',
      bgCard: '#111827', bgCardLight: '#1A2235', bgInput: '#0F131E',
      border: '#1F2937', divider: '#1E293B', bgSecondary: '#0E121D',
      warning: '#F59E0B', danger: '#EF4444', white: '#FFFFFF',
      borderLight: '#374151',
    },
    gradients: {},
    shadows: {},
    toggleTheme: vi.fn(),
  }),
}));

vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 44, bottom: 34, left: 0, right: 0 }),
}));

vi.mock('expo-haptics', () => ({
  impactAsync: vi.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
}));

vi.mock('../components/ui/AnimatedPressable', () => ({
  default: 'TouchableOpacity',
}));

vi.mock('@expo/vector-icons', () => {
  const React = require('react');
  const IconComponent = function(props: any) {
    return React.createElement('Text', null, props.name || '');
  };
  return {
    Ionicons: IconComponent,
    AntDesign: IconComponent,
    MaterialIcons: IconComponent,
    MaterialCommunityIcons: IconComponent,
    Feather: IconComponent,
    FontAwesome: IconComponent,
    FontAwesome5: IconComponent,
  };
});

import ChatRoomListScreen from '../screens/chat/ChatRoomListScreen';

const mockNavigate = vi.fn();
const mockNavigation = { navigate: mockNavigate };

describe('ChatRoomListScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the screen title', () => {
    const { getByText } = render(<ChatRoomListScreen navigation={mockNavigation} />);
    expect(getByText('Chat Rooms')).toBeDefined();
  });

  it('renders room names', () => {
    const { getByText } = render(<ChatRoomListScreen navigation={mockNavigation} />);
    expect(getByText('Trading Discussion')).toBeDefined();
    expect(getByText('Nifty Options')).toBeDefined();
    expect(getByText('Stock Picks')).toBeDefined();
    expect(getByText('Technical Analysis')).toBeDefined();
  });

  it('renders member count for rooms', () => {
    const { getByText } = render(<ChatRoomListScreen navigation={mockNavigation} />);
    expect(getByText('234 members')).toBeDefined();
    expect(getByText('189 members')).toBeDefined();
    expect(getByText('312 members')).toBeDefined();
  });

  it('renders unread badge numbers', () => {
    const { getByText } = render(<ChatRoomListScreen navigation={mockNavigation} />);
    expect(getByText('3')).toBeDefined();
    expect(getByText('7')).toBeDefined();
    expect(getByText('1')).toBeDefined();
  });

  it('navigates to chat room on press', () => {
    const { getByText } = render(<ChatRoomListScreen navigation={mockNavigation} />);
    fireEvent.press(getByText('Trading Discussion'));
    expect(mockNavigate).toHaveBeenCalledWith('ChatRoom', { roomId: '1' });
  });

  it('has search input with correct placeholder', () => {
    const { getByPlaceholderText } = render(
      <ChatRoomListScreen navigation={mockNavigation} />
    );
    expect(getByPlaceholderText('Search rooms...')).toBeDefined();
  });

  it('filters rooms by search', () => {
    const { getByText, getByPlaceholderText } = render(
      <ChatRoomListScreen navigation={mockNavigation} />
    );

    const searchInput = getByPlaceholderText('Search rooms...');
    act(() => {
      fireEvent.changeText(searchInput, 'Trading');
    });
    expect(getByText('Trading Discussion')).toBeDefined();
  });

  it('shows empty state when no rooms match search', () => {
    const { getByText, getByPlaceholderText } = render(
      <ChatRoomListScreen navigation={mockNavigation} />
    );

    const searchInput = getByPlaceholderText('Search rooms...');
    act(() => {
      fireEvent.changeText(searchInput, 'zzzznonexistent');
    });

    expect(getByText('No rooms found')).toBeDefined();
  });

  it('renders without crashing', () => {
    const { toJSON } = render(<ChatRoomListScreen navigation={mockNavigation} />);
    expect(toJSON()).toBeTruthy();
  });
});
