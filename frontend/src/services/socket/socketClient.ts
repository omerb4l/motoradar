import { io, Socket } from 'socket.io-client';
import { SOCKET_URL } from '@/services/api/config';
import { LocationUpdatePayload, NearbyRider } from '@/types/location';
import { useRendezvousStore } from '@/store/useRendezvousStore';
import { useChatStore } from '@/store/useChatStore';
import { useSosStore } from '@/store/useSosStore';

export interface ServerToClientEvents {
  nearby_riders_update: (riders: NearbyRider[]) => void;
  error: (payload: { message: string; issues?: unknown }) => void;
  rendezvous_received: (payload: {
    id: string;
    requesterId: string;
    type: string;
    etaMinutes?: number;
  }) => void;
  rendezvous_status_changed: (payload: {
    id: string;
    status: 'ACCEPTED' | 'DECLINED' | 'CANCELLED' | 'COMPLETED';
  }) => void;
  rendezvous_traveler_updated: (payload: {
    id: string;
    travelingUserId: string;
  }) => void;
  receive_message: (payload: {
    id: string;
    chatId: string;
    senderId: string;
    senderName: string;
    body: string;
    createdAt: string;
  }) => void;
  sos_alert_received: (payload: {
    id: string;
    userId: string;
    username: string;
    alertType: 'AUTO_CRASH' | 'MANUAL';
    lat: number;
    lng: number;
    createdAt: string;
  }) => void;
  sos_alert_cancelled: (payload: {
    id: string;
    userId: string;
  }) => void;
}

export interface ClientToServerEvents {
  update_location: (payload: LocationUpdatePayload) => void;
  send_rendezvous: (payload: {
    recipientId: string;
    type: string;
    etaMinutes?: number;
  }) => void;
  respond_rendezvous: (payload: {
    requestId: string;
    status: 'ACCEPTED' | 'DECLINED' | 'COMPLETED' | 'CANCELLED';
  }) => void;
  set_rendezvous_traveler: (payload: {
    requestId: string;
    travelingUserId: string;
  }) => void;
  send_message: (payload: {
    chatId: string;
    body: string;
  }) => void;
  trigger_sos: (payload: {
    alertType: 'AUTO_CRASH' | 'MANUAL';
    lat: number;
    lng: number;
  }) => void;
  cancel_sos: (payload: {
    alertId: string;
  }) => void;
}

export type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let socket: AppSocket | null = null;

/**
 * One socket for the whole app lifetime, authenticated via the JWT from
 * useAuthStore — see backend/src/sockets/index.ts's io.use() middleware,
 * which rejects any connection without a valid token before 'connection'
 * even fires.
 */
export function connectSocket(token: string): AppSocket {
  if (socket) {
    if (socket.connected) return socket;
    socket.removeAllListeners();
    socket.disconnect();
  }

  socket = io(SOCKET_URL, {
    auth: { token },
    transports: ['websocket'],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 10000,
  });
  
  // Set up listeners for global state
  socket.on('rendezvous_received', (payload) => {
    const store = useRendezvousStore.getState();
    store.addRequest({
      id: payload.id,
      requesterId: payload.requesterId,
      requesterName: 'Ghost Rider', // Or fetch via API
      type: payload.type as 'RIDE_REQUEST',
      etaMinutes: payload.etaMinutes,
      status: 'PENDING'
    });
  });

  socket.on('rendezvous_status_changed', (payload) => {
    useRendezvousStore.getState().updateStatus(payload.id, payload.status);
  });

  socket.on('rendezvous_traveler_updated', (payload) => {
    useRendezvousStore.getState().updateTraveler(payload.id, payload.travelingUserId);
  });

  socket.on('receive_message', (payload) => {
    useChatStore.getState().receiveMessage({
      id: payload.id,
      chat_id: payload.chatId,
      sender_id: payload.senderId,
      sender_name: payload.senderName,
      body: payload.body,
      created_at: payload.createdAt,
    });
  });

  socket.on('sos_alert_received', (payload) => {
    useSosStore.getState().addAlert(payload);
  });

  socket.on('sos_alert_cancelled', (payload) => {
    useSosStore.getState().removeAlert(payload.id);
  });

  return socket;
}

export function getSocket(): AppSocket | null {
  return socket;
}

export function disconnectSocket(): void {
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }
}
