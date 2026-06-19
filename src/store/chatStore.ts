import { create } from 'zustand';
import { ChatMessage, ChatRoom } from '../types';
import { mockChatRooms, mockChatMessages } from '../constants/mockData';

interface ChatState {
  rooms: ChatRoom[];
  messages: Record<string, ChatMessage[]>;
  activeRoomId: string | null;
  typingUsers: Record<string, string[]>;

  setActiveRoom: (roomId: string | null) => void;
  sendMessage: (roomId: string, content: string) => void;
  markRoomRead: (roomId: string) => void;
  getRoomMessages: (roomId: string) => ChatMessage[];
  setTyping: (roomId: string, userName: string, isTyping: boolean) => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  rooms: mockChatRooms,
  messages: mockChatMessages,
  activeRoomId: null,
  typingUsers: {},

  setActiveRoom: (roomId) => {
    set({ activeRoomId: roomId });
    if (roomId) get().markRoomRead(roomId);
  },

  sendMessage: (roomId, content) => {
    if (!content.trim()) return;

    const newMsg: ChatMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      roomId,
      userId: 'user_1',
      userName: 'Rahul Sharma',
      content: content.trim(),
      timestamp: new Date().toISOString(),
      type: 'text',
      read: false,
    };

    set((state) => {
      const roomMsgs = state.messages[roomId] || [];
      return {
        messages: {
          ...state.messages,
          [roomId]: [...roomMsgs, newMsg],
        },
        rooms: state.rooms.map((r) =>
          r.id === roomId
            ? {
                ...r,
                lastMessage: content.trim(),
                lastMessageTime: newMsg.timestamp,
                lastMessageSender: 'Rahul Sharma',
              }
            : r
        ),
      };
    });
  },

  markRoomRead: (roomId) => {
    set((state) => ({
      rooms: state.rooms.map((r) =>
        r.id === roomId ? { ...r, unreadCount: 0 } : r
      ),
      messages: state.messages[roomId]
        ? {
            ...state.messages,
            [roomId]: state.messages[roomId].map((m) => ({ ...m, read: true })),
          }
        : state.messages,
    }));
  },

  getRoomMessages: (roomId) => {
    return get().messages[roomId] || [];
  },

  setTyping: (roomId, userName, isTyping) => {
    set((state) => {
      const current = state.typingUsers[roomId] || [];
      const updated = isTyping
        ? current.includes(userName)
          ? current
          : [...current, userName]
        : current.filter((u) => u !== userName);
      return {
        typingUsers: { ...state.typingUsers, [roomId]: updated },
      };
    });
  },
}));
