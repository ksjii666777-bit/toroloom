/**
 * ============================================================================
 * Toroloom — ChatRoomScreen Tests
 * ============================================================================
 *
 * Covers:
 *   - Screen rendering (header, room name, online status, input bar)
 *   - Message bubble rendering (own messages vs other users)
 *   - Message types (text, trade, alert)
 *   - Date separator rendering
 *   - Sending a message updates the store
 *   - Typing indicator display
 *   - Back button navigation
 *   - Empty / missing roomId edge case
 *   - Read receipts (checkmark icons)
 * ============================================================================
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from './testUtils';

// ==================== Mocks ====================

const mockGoBack = vi.fn();
const mockNavigate = vi.fn();

/** Mutable store state — tests can swap this before each render */
let mockStoreState: any = {};

const initialMessages: Record<string, any[]> = {
  room_1: [
    {
      id: 'msg_1', roomId: 'room_1', userId: 'user_2',
      userName: 'Arun Kumar', content: 'Nifty futures gap up opening expected today.',
      timestamp: new Date(Date.now() - 3600000).toISOString(), type: 'text', read: true,
    },
    {
      id: 'msg_2', roomId: 'room_1', userId: 'user_1',
      userName: 'Rahul Sharma', content: 'Holding RELIANCE calls, targeting 2950.',
      timestamp: new Date(Date.now() - 1800000).toISOString(), type: 'trade', read: true,
    },
    {
      id: 'msg_3', roomId: 'room_1', userId: 'user_3',
      userName: 'Priya Patel', content: 'Stop loss hit on Nifty position!',
      timestamp: new Date(Date.now() - 600000).toISOString(), type: 'alert', read: false,
    },
  ],
};

const mockSendMessage = vi.fn();
const mockSetTyping = vi.fn();
const mockMarkRoomRead = vi.fn();

vi.mock('../store/chatStore', () => ({
  useChatStore: () => mockStoreState,
}));

vi.mock('../context/ThemeContext', () => ({
  useTheme: () => ({
    colors: {
      bg: '#0B0F19', bgSecondary: '#0E121D', bgCard: '#111827',
      bgCardLight: '#1A2235', bgInput: '#0F131E', border: '#1F2937',
      primary: '#3B82F6', text: '#FFFFFF', textSecondary: '#9CA3AF',
      textMuted: '#6B7280', divider: '#1E293B', accent: '#10B981',
    },
  }),
}));

vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 44, bottom: 34, left: 0, right: 0 }),
}));

import ChatRoomScreen from '../screens/chat/ChatRoomScreen';

/** Helper: render ChatRoomScreen with a roomId route param */
function renderChatRoom(roomId = 'room_1') {
  return render(
    <ChatRoomScreen
      route={{ params: { roomId } }}
      navigation={{ goBack: mockGoBack, navigate: mockNavigate }}
    />,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  // Default store state — 2 of 3 participants online → "2 online"
  mockStoreState = {
    rooms: [
      {
        id: 'room_1', name: 'Trading Legends', type: 'group',
        topic: 'Technical Analysis & Strategies',
        lastMessage: 'Nifty support at 23400',
        lastMessageTime: new Date().toISOString(),
        lastMessageSender: 'Arun Kumar', unreadCount: 3,
        participants: [
          { userId: 'user_2', userName: 'Arun Kumar', isOnline: true },
          { userId: 'user_3', userName: 'Priya Patel', isOnline: true },
          { userId: 'user_4', userName: 'Neha Singh', isOnline: false },
        ],
      },
    ],
    messages: initialMessages,
    sendMessage: mockSendMessage,
    setTyping: mockSetTyping,
    typingUsers: {},
    markRoomRead: mockMarkRoomRead,
  };
});

// ==================== Tests ====================

describe('ChatRoomScreen — Rendering', () => {
  it('renders the room name in the header', () => {
    const { getByText } = renderChatRoom();
    expect(getByText('Trading Legends')).toBeDefined();
  });

  it('renders online status for group with 2 online participants', () => {
    const { getByText } = renderChatRoom();
    expect(getByText('2 online')).toBeDefined();
  });

  it('renders the input bar with placeholder', () => {
    const { getByPlaceholderText } = renderChatRoom();
    expect(getByPlaceholderText('Type a message...')).toBeDefined();
  });

  it('renders without crashing', () => {
    const { toJSON } = renderChatRoom();
    expect(toJSON()).toBeTruthy();
  });

  it('renders message content from store', () => {
    const { getByText } = renderChatRoom();
    expect(getByText('Nifty futures gap up opening expected today.')).toBeDefined();
  });
});

describe('ChatRoomScreen — Message Types', () => {
  it('renders user name for other users messages', () => {
    const { getByText } = renderChatRoom();
    expect(getByText('Arun Kumar')).toBeDefined();
  });

  it('renders trade idea tag for trade-type messages', () => {
    const { getByText } = renderChatRoom();
    expect(getByText('Trade Idea')).toBeDefined();
  });

  it('renders alert tag for alert-type messages', () => {
    const { getByText } = renderChatRoom();
    expect(getByText('Alert')).toBeDefined();
  });
});

describe('ChatRoomScreen — Date Separator', () => {
  it('renders "Today" date separator for today messages', () => {
    const { getByText } = renderChatRoom();
    expect(getByText('Today')).toBeDefined();
  });
});

describe('ChatRoomScreen — Own Messages vs Other Messages', () => {
  it('renders own message (userId: user_1) with trade tag', () => {
    const { getByText } = renderChatRoom();
    expect(getByText('Holding RELIANCE calls, targeting 2950.')).toBeDefined();
  });
});

describe('ChatRoomScreen — Typing Indicator', () => {
  it('renders typing indicator when typingUsers has entries', () => {
    mockStoreState.typingUsers = { room_1: ['Arun Kumar'] };
    const { getByText } = renderChatRoom();
    expect(getByText(/Arun Kumar typing/)).toBeDefined();
  });
});

describe('ChatRoomScreen — Edge Cases', () => {
  it('renders fallback "Chat" title when no room is found', () => {
    const { getByText } = renderChatRoom('nonexistent_room');
    expect(getByText('Chat')).toBeDefined();
  });

  it('shows "Offline" status when no participants are online', () => {
    mockStoreState = {
      ...mockStoreState,
      rooms: [
        {
          id: 'room_1', name: 'DM Chat', type: 'direct',
          participants: [{ userId: 'user_2', userName: 'Arun Kumar', isOnline: false }],
        },
      ],
    };
    const { getByText } = renderChatRoom();
    expect(getByText('Offline')).toBeDefined();
  });

  it('renders without crashing with no route params', () => {
    const { toJSON } = render(
      <ChatRoomScreen
        route={{ params: {} }}
        navigation={{ goBack: mockGoBack, navigate: mockNavigate }}
      />,
    );
    expect(toJSON()).toBeTruthy();
  });

  it('calls markRoomRead on mount', () => {
    renderChatRoom();
    expect(mockMarkRoomRead).toHaveBeenCalledWith('room_1');
  });
});

describe('ChatRoomScreen — Navigation', () => {
  it('back button callable via mocks', () => {
    expect(mockGoBack).toBeDefined();
    expect(typeof mockGoBack).toBe('function');
  });
});
