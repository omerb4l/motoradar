export interface LocationUpdatePayload {
  lat: number;
  lng: number;
  /** meters/second */
  speed: number;
  heading?: number | null;
  leanAngle?: number | null;
  isRiding?: boolean;
  /** radius the client wants riders returned within; defaults server-side */
  radiusKm?: number;
}

export interface NearbyRiderDTO {
  userId: string;
  lat: number;
  lng: number;
  speed: number;
  heading: number | null;
  isRiding: boolean;
  distanceKm: number;
  updatedAt: string;
  username: string;
}

export interface ServerToClientEvents {
  nearby_riders_update: (riders: NearbyRiderDTO[]) => void;
  error: (payload: { message: string; issues?: unknown }) => void;
  rendezvous_received: (payload: {
    id: string;
    requesterId: string;
    type: string;
    etaMinutes?: number;
  }) => void;
  rendezvous_status_changed: (payload: {
    id: string;
    status: 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'CANCELLED' | 'COMPLETED';
  }) => void;
  rendezvous_traveler_updated: (payload: {
    id: string;
    travelingUserId: string;
  }) => void;
  receive_message: (payload: {
    id: string;
    chatId: string;
    senderId: string;
    senderName?: string;
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
    status: 'ACCEPTED' | 'DECLINED';
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
