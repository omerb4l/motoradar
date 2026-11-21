import { create } from 'zustand';
import { useAuthStore } from './useAuthStore';

export interface Chat {
  id: string;
  kind: 'DIRECT' | 'GROUP';
  name: string | null;
  created_at: string;
  partner_id?: string;
  partner_name?: string;
  last_message?: string;
  last_message_at?: string;
  unread_count?: number;
}

export interface ChatMessage {
  id: string;
  chat_id: string;
  sender_id: string;
  sender_name?: string;
  body: string;
  created_at: string;
}

interface ChatStore {
  chats: Chat[];
  messagesByChat: Record<string, ChatMessage[]>;
  isLoadingChats: boolean;
  isLoadingMessages: Record<string, boolean>;

  fetchChats: () => Promise<void>;
  fetchMessages: (chatId: string) => Promise<void>;
  receiveMessage: (msg: ChatMessage) => void;
}

export const useChatStore = create<ChatStore>((set, get) => ({
  chats: [],
  messagesByChat: {},
  isLoadingChats: false,
  isLoadingMessages: {},

  fetchChats: async () => {
    set({ isLoadingChats: true });
    try {
      const response = await fetch(`${process.env.EXPO_PUBLIC_API_BASE_URL}/chats`, {
        headers: { 'Authorization': `Bearer ${useAuthStore.getState().token}` }
      });
      if (response.ok) {
        const data = await response.json();
        set({ chats: data });
      }
    } catch (err) {
      console.error('Failed to fetch chats', err);
    } finally {
      set({ isLoadingChats: false });
    }
  },

  fetchMessages: async (chatId: string) => {
    set((state) => ({ isLoadingMessages: { ...state.isLoadingMessages, [chatId]: true } }));
    try {
      const response = await fetch(`${process.env.EXPO_PUBLIC_API_BASE_URL}/chats/${chatId}/messages`, {
        headers: { 'Authorization': `Bearer ${useAuthStore.getState().token}` }
      });
      if (response.ok) {
        const data = await response.json();
        set((state) => ({
          messagesByChat: { ...state.messagesByChat, [chatId]: data },
        }));
      }
    } catch (err) {
      console.error('Failed to fetch messages for chat', chatId, err);
    } finally {
      set((state) => ({ isLoadingMessages: { ...state.isLoadingMessages, [chatId]: false } }));
    }
  },

  receiveMessage: (msg) => {
    set((state) => {
      const existing = state.messagesByChat[msg.chat_id] || [];
      if (existing.some((m) => m.id === msg.id)) {
        return state;
      }
      const updatedMessages = {
        ...state.messagesByChat,
        [msg.chat_id]: [...existing, msg],
      };

      // Update chat's last message
      const updatedChats = state.chats.map((c) => {
        if (c.id === msg.chat_id) {
          return {
            ...c,
            last_message: msg.body,
            last_message_at: msg.created_at,
          };
        }
        return c;
      });

      return {
        messagesByChat: updatedMessages,
        chats: updatedChats,
      };
    });
  },
}));


