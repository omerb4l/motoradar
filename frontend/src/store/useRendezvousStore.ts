import { create } from 'zustand';
import { getSocket } from '@/services/socket/socketClient';
import { useAuthStore } from './useAuthStore';

export interface RendezvousItem {
  id: string;
  chatId?: string;
  requesterId: string;
  requesterName: string;
  recipientId?: string;
  recipientName?: string;
  travelingUserId?: string | null;
  proposingUserId?: string | null;
  proposalType?: 'COME_TO_ME' | 'COMING_TO_YOU' | null;
  type: 'RIDE_REQUEST';
  etaMinutes?: number;
  status: 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'CANCELLED' | 'COMPLETED';
}

interface RendezvousState {
  requests: RendezvousItem[];
  setRequests: (reqs: RendezvousItem[]) => void;
  addRequest: (req: RendezvousItem) => void;
  updateStatus: (id: string, status: RendezvousItem['status']) => void;
  updateTraveler: (id: string, travelingUserId: string) => void;
  updateProposal: (id: string, proposingUserId: string | null, proposalType: 'COME_TO_ME' | 'COMING_TO_YOU' | null, travelingUserId: string | null) => void;
  removeRequest: (id: string) => void;
  fetchPending: () => Promise<void>;
  acceptRequest: (id: string) => void;
  declineRequest: (id: string) => void;
  proposeMeetup: (partnerId: string, partnerName: string, proposalType: 'COME_TO_ME' | 'COMING_TO_YOU', chatId?: string) => void;
  acceptMeetupProposal: (requestId: string, travelingUserId: string, chatId?: string) => void;
  declineMeetupProposal: (requestId: string) => void;
  cancelActiveMeetup: (requestId: string) => void;
}

const BOT_NAMES = ['SPEEDDEMON', 'CANYONCARVER', 'NIGHTRIDER', 'APEXHUNTER'];

export const useRendezvousStore = create<RendezvousState>((set, get) => ({
  requests: [],
  setRequests: (reqs) => set({ requests: reqs }),
  addRequest: (req) => set((state) => {
    if (state.requests.some(r => r.id === req.id)) return state;
    return { requests: [req, ...state.requests] };
  }),
  updateStatus: (id, status) => set((state) => {
    if (status === 'DECLINED') {
      setTimeout(() => {
        useRendezvousStore.getState().removeRequest(id);
      }, 5000);
    }
    return {
      requests: state.requests.map(r => (r.id === id || r.chatId === id) ? { ...r, status } : r)
    };
  }),
  updateTraveler: (id, travelingUserId) => set((state) => ({
    requests: state.requests.map(r => (r.id === id || r.chatId === id || r.requesterId === id || r.recipientId === id) ? { 
      ...r, 
      travelingUserId, 
      proposingUserId: null, 
      proposalType: null,
      status: 'ACCEPTED' 
    } : r)
  })),
  updateProposal: (id, proposingUserId, proposalType, travelingUserId) => set((state) => ({
    requests: state.requests.map(r => (r.id === id || r.chatId === id) ? { ...r, proposingUserId, proposalType, travelingUserId } : r)
  })),
  removeRequest: (id) => set((state) => ({
    requests: state.requests.filter(r => r.id !== id && r.chatId !== id)
  })),

  fetchPending: async () => {
    try {
      const response = await fetch(`${process.env.EXPO_PUBLIC_API_BASE_URL}/rendezvous/pending`, {
        headers: {
          'Authorization': `Bearer ${useAuthStore.getState().token}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        set({ requests: data });
      }
    } catch (err) {
      console.error('Failed to fetch pending rendezvous', err);
    }
  },

  acceptRequest: (id) => {
    getSocket()?.emit('respond_rendezvous', { requestId: id, status: 'ACCEPTED' });
    get().updateStatus(id, 'ACCEPTED');
    setTimeout(async () => {
      const { useChatStore } = await import('./useChatStore');
      useChatStore.getState().fetchChats();
      useRendezvousStore.getState().removeRequest(id);
    }, 2500);
  },
  
  declineRequest: (id) => {
    getSocket()?.emit('respond_rendezvous', { requestId: id, status: 'DECLINED' });
    get().updateStatus(id, 'DECLINED');
  },

  proposeMeetup: (partnerId, partnerName, proposalType, chatId) => {
    const user = useAuthStore.getState().user;
    if (!user) return;

    // Find existing rendezvous or generate an active id
    const existing = get().requests.find(r => 
      (r.chatId === chatId || (r.requesterId === partnerId && r.recipientId === user.id) || (r.recipientId === partnerId && r.requesterId === user.id)) &&
      r.status !== 'CANCELLED' && r.status !== 'COMPLETED'
    );

    const targetTravelerId = proposalType === 'COMING_TO_YOU' ? user.id : partnerId;
    const reqId = existing ? existing.id : `meetup_${chatId || Date.now()}`;

    if (!existing) {
      get().addRequest({
        id: reqId,
        chatId,
        requesterId: user.id,
        requesterName: user.username,
        recipientId: partnerId,
        recipientName: partnerName,
        travelingUserId: null,
        proposingUserId: user.id,
        proposalType,
        type: 'RIDE_REQUEST',
        status: 'ACCEPTED',
      });
    } else {
      get().updateProposal(reqId, user.id, proposalType, null);
    }

    // Send proposal via socket message into chat channel
    if (chatId) {
      const proposalText = proposalType === 'COME_TO_ME' 
        ? `📍 Meetup Invitation: Come to my location!`
        : `🏍️ Meetup Offer: I'm coming to your location!`;
      getSocket()?.emit('send_message', { chatId, body: proposalText });
    }

    // If partner is a simulator BOT, auto-accept immediately
    const isBot = BOT_NAMES.includes((partnerName || '').toUpperCase());
    if (isBot) {
      setTimeout(() => {
        get().updateTraveler(reqId, targetTravelerId);
        getSocket()?.emit('set_rendezvous_traveler', {
          requestId: reqId,
          travelingUserId: targetTravelerId,
        });
      }, 900);
    }
  },

  acceptMeetupProposal: (requestId, travelingUserId, chatId) => {
    get().updateTraveler(requestId, travelingUserId);
    getSocket()?.emit('set_rendezvous_traveler', {
      requestId,
      travelingUserId,
    });

    if (chatId) {
      getSocket()?.emit('send_message', { 
        chatId, 
        body: `📍 Meetup accepted! Live navigation route active.` 
      });
    }
  },

  declineMeetupProposal: (requestId) => {
    get().updateProposal(requestId, null, null, null);
  },

  cancelActiveMeetup: (requestId) => {
    getSocket()?.emit('respond_rendezvous', { requestId, status: 'CANCELLED' });
    get().updateStatus(requestId, 'CANCELLED');
  }
}));
