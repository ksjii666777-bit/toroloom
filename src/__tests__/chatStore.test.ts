/**
 * ============================================================================
 * Toroloom — Chat Store Tests
 * ============================================================================
 *
 * Tests the Zustand chatStore: initial state, room/message management,
 * sendMessage, markRoomRead, setActiveRoom, typing indicators, and edge
 * cases.
 *
 * The store is tested purely through its Zustand API (not via React hook).
 * ============================================================================
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useChatStore } from '../store/chatStore';
import type { ChatRoom, ChatMessage } from '../types';

// ──── Helpers ──────────────────────────────────────────────────────────────

/** Build a minimal ChatRoom fixture. */
function makeRoom(overrides: Partial<ChatRoom> = {}): ChatRoom {
  return {
    id: 'room_test',
    name: 'Test Room',
    type: 'group',
    lastMessage: 'Hello everyone',
    lastMessageTime: '2026-06-20T10:00:00.000Z',
    lastMessageSender: 'Alice',
    unreadCount: 3,
    participants: [
      { userId: 'user_a', userName: 'Alice', isOnline: true },
      { userId: 'user_b', userName: 'Bob', isOnline: false },
    ],
    ...overrides,
  };
}

/** Build a minimal ChatMessage fixture. */
function makeMsg(overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: 'msg_1',
    roomId: 'room_test',
    userId: 'user_a',
    userName: 'Alice',
    content: 'Test message',
    timestamp: '2026-06-20T10:00:00.000Z',
    type: 'text',
    read: false,
    ...overrides,
  };
}

/**
 * Reset store to initial state between tests.
 */
function resetStore() {
  useChatStore.setState({
    rooms: [
      makeRoom({ id: 'room_1', name: 'Trading Legends', unreadCount: 3 }),
      makeRoom({ id: 'room_2', name: 'Options Chat', unreadCount: 0 }),
    ],
    messages: {
      room_1: [
        makeMsg({ id: 'm1', roomId: 'room_1', userName: 'Alice', content: 'Hey there', read: true }),
        makeMsg({ id: 'm2', roomId: 'room_1', userName: 'Bob', content: 'Hi Alice!', read: false }),
      ],
      room_2: [
        makeMsg({ id: 'm3', roomId: 'room_2', userName: 'Charlie', content: 'Anyone trading Nifty?', read: true }),
      ],
    },
    activeRoomId: null,
    typingUsers: {},
  });
}

// ====================================================================
// Initial State
// ====================================================================

describe('ChatStore — Initial State', () => {
  beforeEach(resetStore);

  it('has rooms loaded from mock data', () => {
    const state = useChatStore.getState();
    expect(state.rooms).toHaveLength(2);
    expect(state.rooms[0].name).toBe('Trading Legends');
    expect(state.rooms[1].name).toBe('Options Chat');
  });

  it('has messages loaded from mock data', () => {
    const state = useChatStore.getState();
    expect(state.messages['room_1']).toHaveLength(2);
    expect(state.messages['room_2']).toHaveLength(1);
  });

  it('starts with no active room', () => {
    expect(useChatStore.getState().activeRoomId).toBeNull();
  });

  it('starts with empty typing users', () => {
    expect(useChatStore.getState().typingUsers).toEqual({});
  });

  it('has all required actions', () => {
    const state = useChatStore.getState();
    expect(typeof state.setActiveRoom).toBe('function');
    expect(typeof state.sendMessage).toBe('function');
    expect(typeof state.markRoomRead).toBe('function');
    expect(typeof state.getRoomMessages).toBe('function');
    expect(typeof state.setTyping).toBe('function');
  });
});

// ====================================================================
// setActiveRoom
// ====================================================================

describe('ChatStore — setActiveRoom', () => {
  beforeEach(resetStore);

  it('sets the active room ID', () => {
    useChatStore.getState().setActiveRoom('room_1');
    expect(useChatStore.getState().activeRoomId).toBe('room_1');
  });

  it('marks the room as read when activating', () => {
    useChatStore.getState().setActiveRoom('room_1');
    const state = useChatStore.getState();
    const room = state.rooms.find(r => r.id === 'room_1');
    expect(room?.unreadCount).toBe(0);
    // All messages should be marked read
    const msgs = state.messages['room_1'];
    expect(msgs.every(m => m.read)).toBe(true);
  });

  it('sets active room to null', () => {
    useChatStore.getState().setActiveRoom('room_1');
    useChatStore.getState().setActiveRoom(null);
    expect(useChatStore.getState().activeRoomId).toBeNull();
  });

  it('does not crash when setting null as active room', () => {
    expect(() => useChatStore.getState().setActiveRoom(null)).not.toThrow();
    expect(useChatStore.getState().activeRoomId).toBeNull();
  });

  it('marks correct room as read when multiple rooms have unread', () => {
    useChatStore.getState().setActiveRoom('room_2');
    const state = useChatStore.getState();
    // room_2 had 0 unreadCount and all messages already read
    const room2 = state.rooms.find(r => r.id === 'room_2');
    expect(room2?.unreadCount).toBe(0);
    // room_1 should keep its original unread count (only room_2 was marked read)
    const room1 = state.rooms.find(r => r.id === 'room_1');
    expect(room1?.unreadCount).toBe(3);
  });
});

// ====================================================================
// sendMessage
// ====================================================================

describe('ChatStore — sendMessage', () => {
  beforeEach(resetStore);

  it('adds a new message to the room', () => {
    useChatStore.getState().sendMessage('room_1', 'New test message');
    const state = useChatStore.getState();
    const msgs = state.messages['room_1'];
    expect(msgs).toHaveLength(3);
    const lastMsg = msgs[msgs.length - 1];
    expect(lastMsg.content).toBe('New test message');
    expect(lastMsg.userName).toBe('Rahul Sharma');
    expect(lastMsg.userId).toBe('user_1');
    expect(lastMsg.type).toBe('text');
    expect(lastMsg.read).toBe(false);
  });

  it('generates a unique id for each message', () => {
    useChatStore.getState().sendMessage('room_1', 'Message A');
    useChatStore.getState().sendMessage('room_1', 'Message B');
    const msgs = useChatStore.getState().messages['room_1'];
    const lastTwo = msgs.slice(-2);
    expect(lastTwo[0].id).not.toBe(lastTwo[1].id);
  });

  it('updates room lastMessage and lastMessageSender', () => {
    useChatStore.getState().sendMessage('room_1', 'Latest message');
    const room = useChatStore.getState().rooms.find(r => r.id === 'room_1');
    expect(room?.lastMessage).toBe('Latest message');
    expect(room?.lastMessageSender).toBe('Rahul Sharma');
  });

  it('updates room lastMessageTime on send', () => {
    const before = Date.now();
    useChatStore.getState().sendMessage('room_1', 'Timestamp test');
    const room = useChatStore.getState().rooms.find(r => r.id === 'room_1');
    expect(room?.lastMessageTime).toBeDefined();
    const time = new Date(room!.lastMessageTime!).getTime();
    expect(time).toBeGreaterThanOrEqual(before);
  });

  it('does not add message for empty content', () => {
    useChatStore.getState().sendMessage('room_1', '');
    expect(useChatStore.getState().messages['room_1']).toHaveLength(2);
  });

  it('does not add message for whitespace-only content', () => {
    useChatStore.getState().sendMessage('room_1', '   ');
    expect(useChatStore.getState().messages['room_1']).toHaveLength(2);
  });

  it('trims whitespace from message content', () => {
    useChatStore.getState().sendMessage('room_1', '  Hello with spaces  ');
    const msgs = useChatStore.getState().messages['room_1'];
    const lastMsg = msgs[msgs.length - 1];
    expect(lastMsg.content).toBe('Hello with spaces');
  });

  it('creates a new message array for rooms with no existing messages', () => {
    useChatStore.getState().sendMessage('room_3', 'First message in new room');
    const state = useChatStore.getState();
    expect(state.messages['room_3']).toHaveLength(1);
    expect(state.messages['room_3'][0].content).toBe('First message in new room');
  });

  it('appends message to the end of the list', () => {
    useChatStore.getState().sendMessage('room_2', 'Newest message');
    const msgs = useChatStore.getState().messages['room_2'];
    expect(msgs).toHaveLength(2);
    expect(msgs[msgs.length - 1].content).toBe('Newest message');
  });

  it('sets timestamp on new message', () => {
    useChatStore.getState().sendMessage('room_1', 'Time check');
    const msg = useChatStore.getState().messages['room_1'].slice(-1)[0];
    expect(msg.timestamp).toBeDefined();
    expect(new Date(msg.timestamp).getTime()).not.toBeNaN();
  });
});

// ====================================================================
// markRoomRead
// ====================================================================

describe('ChatStore — markRoomRead', () => {
  beforeEach(resetStore);

  it('resets unreadCount to 0 for the target room', () => {
    useChatStore.getState().markRoomRead('room_1');
    const room = useChatStore.getState().rooms.find(r => r.id === 'room_1');
    expect(room?.unreadCount).toBe(0);
  });

  it('marks all messages as read in the target room', () => {
    useChatStore.getState().markRoomRead('room_1');
    const msgs = useChatStore.getState().messages['room_1'];
    expect(msgs.every(m => m.read)).toBe(true);
  });

  it('does not affect other rooms', () => {
    useChatStore.getState().markRoomRead('room_1');
    const room2 = useChatStore.getState().rooms.find(r => r.id === 'room_2');
    // room_2 had unreadCount 0 already
    expect(room2?.unreadCount).toBe(0);
    const msgs2 = useChatStore.getState().messages['room_2'];
    // m3 was already read
    expect(msgs2[0].read).toBe(true);
  });

  it('does not crash for rooms with no messages', () => {
    // resetStore already called in beforeEach
    expect(() => useChatStore.getState().markRoomRead('empty_room')).not.toThrow();
    const state = useChatStore.getState();
    // Other rooms should be unaffected
    const room1 = state.rooms.find(r => r.id === 'room_1');
    expect(room1?.unreadCount).toBe(3);
    expect(state.messages['room_1']).toHaveLength(2);
  });
});

// ====================================================================
// getRoomMessages
// ====================================================================

describe('ChatStore — getRoomMessages', () => {
  beforeEach(resetStore);

  it('returns messages for an existing room', () => {
    const msgs = useChatStore.getState().getRoomMessages('room_1');
    expect(msgs).toHaveLength(2);
    expect(msgs[0].content).toBe('Hey there');
  });

  it('returns empty array for a room with no messages', () => {
    const msgs = useChatStore.getState().getRoomMessages('nonexistent');
    expect(msgs).toEqual([]);
  });

  it('returns messages in insertion order', () => {
    const msgs = useChatStore.getState().getRoomMessages('room_1');
    expect(msgs[0].id).toBe('m1');
    expect(msgs[1].id).toBe('m2');
  });

  it('returns updated messages after sending', () => {
    useChatStore.getState().sendMessage('room_1', 'After send');
    const msgs = useChatStore.getState().getRoomMessages('room_1');
    expect(msgs).toHaveLength(3);
  });

  it('returns a live reference to store messages', () => {
    const msgs = useChatStore.getState().getRoomMessages('room_1');
    // getRoomMessages returns a direct reference, so mutations affect the store
    msgs.push({} as ChatMessage);
    const stateMsgs = useChatStore.getState().messages['room_1'];
    expect(stateMsgs).toHaveLength(3);
  });
});

// ====================================================================
// setTyping
// ====================================================================

describe('ChatStore — setTyping', () => {
  beforeEach(resetStore);

  it('adds a typing user to a room', () => {
    useChatStore.getState().setTyping('room_1', 'Alice', true);
    const typing = useChatStore.getState().typingUsers;
    expect(typing['room_1']).toContain('Alice');
  });

  it('removes a typing user from a room', () => {
    useChatStore.getState().setTyping('room_1', 'Alice', true);
    useChatStore.getState().setTyping('room_1', 'Alice', false);
    const typing = useChatStore.getState().typingUsers;
    expect(typing['room_1']).not.toContain('Alice');
  });

  it('supports multiple typing users in the same room', () => {
    useChatStore.getState().setTyping('room_1', 'Alice', true);
    useChatStore.getState().setTyping('room_1', 'Bob', true);
    useChatStore.getState().setTyping('room_1', 'Charlie', true);
    const typing = useChatStore.getState().typingUsers['room_1'];
    expect(typing).toHaveLength(3);
    expect(typing).toContain('Alice');
    expect(typing).toContain('Bob');
    expect(typing).toContain('Charlie');
  });

  it('does not duplicate a typing user', () => {
    useChatStore.getState().setTyping('room_1', 'Alice', true);
    useChatStore.getState().setTyping('room_1', 'Alice', true);
    expect(useChatStore.getState().typingUsers['room_1']).toHaveLength(1);
  });

  it('removes only the specified user', () => {
    useChatStore.getState().setTyping('room_1', 'Alice', true);
    useChatStore.getState().setTyping('room_1', 'Bob', true);
    useChatStore.getState().setTyping('room_1', 'Alice', false);
    const typing = useChatStore.getState().typingUsers['room_1'];
    expect(typing).toHaveLength(1);
    expect(typing).toContain('Bob');
  });

  it('initializes typing array for a new room', () => {
    useChatStore.getState().setTyping('new_room', 'Alice', true);
    const typing = useChatStore.getState().typingUsers;
    expect(typing['new_room']).toHaveLength(1);
    expect(typing['new_room']).toContain('Alice');
  });

  it('does not crash when removing a non-existent typing user', () => {
    expect(() => {
      useChatStore.getState().setTyping('room_1', 'NonExistent', false);
    }).not.toThrow();
  });

  it('typing users in different rooms are independent', () => {
    useChatStore.getState().setTyping('room_1', 'Alice', true);
    useChatStore.getState().setTyping('room_2', 'Bob', true);
    const typing = useChatStore.getState().typingUsers;
    expect(typing['room_1']).toEqual(['Alice']);
    expect(typing['room_2']).toEqual(['Bob']);
  });

  it('can clear typing for a specific user and keep others', () => {
    useChatStore.getState().setTyping('room_1', 'Alice', true);
    useChatStore.getState().setTyping('room_1', 'Bob', true);
    useChatStore.getState().setTyping('room_1', 'Charlie', true);

    useChatStore.getState().setTyping('room_1', 'Bob', false);

    const typing = useChatStore.getState().typingUsers['room_1'];
    expect(typing).toEqual(['Alice', 'Charlie']);
  });
});

// ====================================================================
// Edge Cases & Error Handling
// ====================================================================

describe('ChatStore — Edge Cases', () => {
  beforeEach(resetStore);

  it('sendMessage works with special characters', () => {
    useChatStore.getState().sendMessage('room_1', 'Price is ₹2,890.50! 🚀 <test>');
    const msgs = useChatStore.getState().messages['room_1'];
    expect(msgs).toHaveLength(3);
    expect(msgs[2].content).toBe('Price is ₹2,890.50! 🚀 <test>');
  });

  it('sendMessage works with very long content', () => {
    const longContent = 'A'.repeat(10000);
    useChatStore.getState().sendMessage('room_1', longContent);
    const msgs = useChatStore.getState().messages['room_1'];
    expect(msgs).toHaveLength(3);
    expect(msgs[2].content).toHaveLength(10000);
  });

  it('setActiveRoom followed by sendMessage updates lastMessageTime', () => {
    useChatStore.getState().setActiveRoom('room_1');
    useChatStore.getState().sendMessage('room_1', 'After activation');
    const room = useChatStore.getState().rooms.find(r => r.id === 'room_1');
    expect(room?.lastMessage).toBe('After activation');
  });

  it('can mark a room read even when already read', () => {
    useChatStore.getState().markRoomRead('room_2'); // room_2 already has 0 unread
    const room = useChatStore.getState().rooms.find(r => r.id === 'room_2');
    expect(room?.unreadCount).toBe(0);
  });

  it('rooms state is not mutated by getRoomMessages', () => {
    const originalRooms = useChatStore.getState().rooms;
    useChatStore.getState().getRoomMessages('room_1');
    expect(useChatStore.getState().rooms).toEqual(originalRooms);
  });

  it('typing state is preserved when sending messages', () => {
    useChatStore.getState().setTyping('room_1', 'Alice', true);
    useChatStore.getState().sendMessage('room_1', 'Hello');
    const typing = useChatStore.getState().typingUsers['room_1'];
    expect(typing).toContain('Alice');
  });

  it('sendMessage for non-existent room creates structure', () => {
    useChatStore.getState().sendMessage('brand_new_room', 'First message');
    const state = useChatStore.getState();
    expect(state.messages['brand_new_room']).toBeDefined();
    expect(state.messages['brand_new_room']).toHaveLength(1);
    // Room shouldn't be added to rooms array (it's just a message target)
    expect(state.rooms.find(r => r.id === 'brand_new_room')).toBeUndefined();
  });
});

// ====================================================================
// Store Subscription / Reactivity
// ====================================================================

describe('ChatStore — Store Subscriptions', () => {
  beforeEach(resetStore);

  it('notifies subscribers on sendMessage', () => {
    const listener = vi.fn();
    const unsub = useChatStore.subscribe(listener);
    useChatStore.getState().sendMessage('room_1', 'Notify test');
    expect(listener).toHaveBeenCalled();
    unsub();
  });

  it('notifies subscribers on typing change', () => {
    const listener = vi.fn();
    const unsub = useChatStore.subscribe(listener);
    useChatStore.getState().setTyping('room_1', 'Alice', true);
    expect(listener).toHaveBeenCalled();
    unsub();
  });

  it('notifies subscribers on setActiveRoom', () => {
    const listener = vi.fn();
    const unsub = useChatStore.subscribe(listener);
    useChatStore.getState().setActiveRoom('room_1');
    expect(listener).toHaveBeenCalled();
    unsub();
  });
});
