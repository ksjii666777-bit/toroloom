import React, { act } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from './testUtils';
import { mockChatRooms } from '../constants/mockData';

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
    expect(getByText('Messages')).toBeDefined();
  });

  it('renders conversation count', () => {
    const { getByText } = render(<ChatRoomListScreen navigation={mockNavigation} />);
    expect(getByText(/conversations/)).toBeDefined();
  });

  it('renders room names', () => {
    const { getByText } = render(<ChatRoomListScreen navigation={mockNavigation} />);
    expect(getByText('Trading Legends')).toBeDefined();
    expect(getByText('RELIANCE Discussion')).toBeDefined();
  });

  it('renders unread badge when rooms have unread messages', () => {
    const { getByText } = render(<ChatRoomListScreen navigation={mockNavigation} />);
    const roomsWithUnread = mockChatRooms.filter(r => r.unreadCount > 0);
    if (roomsWithUnread.length > 0) {
      expect(getByText(/unread/)).toBeDefined();
    }
  });

  it('navigates to chat room on press', () => {
    const { getByText } = render(<ChatRoomListScreen navigation={mockNavigation} />);
    fireEvent.press(getByText('Trading Legends'));
    expect(mockNavigate).toHaveBeenCalledWith('ChatRoom', { roomId: 'room_1' });
  });

  it('shows search bar when search icon pressed', () => {
    const { getByText, getByPlaceholderText } = render(
      <ChatRoomListScreen navigation={mockNavigation} />
    );

    fireEvent.press(getByText('search'));
    expect(getByPlaceholderText('Search conversations...')).toBeDefined();
  });

  it('filters rooms by search', () => {
    const { getByText, getByPlaceholderText } = render(
      <ChatRoomListScreen navigation={mockNavigation} />
    );

    fireEvent.press(getByText('search'));
    const searchInput = getByPlaceholderText('Search conversations...');
    act(() => {
      fireEvent.changeText(searchInput, 'RELIANCE');
    });
    expect(getByText('RELIANCE Discussion')).toBeDefined();
  });

  it('renders without crashing', () => {
    const { toJSON } = render(<ChatRoomListScreen navigation={mockNavigation} />);
    expect(toJSON()).toBeTruthy();
  });
});
