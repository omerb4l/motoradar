import { Socket } from 'socket.io';
import { ClientToServerEvents, ServerToClientEvents } from './types';

export type AppSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

// In-memory registry of userId -> live socket, used to push nearby-rider
// updates to riders who haven't emitted a location update themselves
// recently (see handlers/location.ts). Single-process only — move to Redis
// (or a geohash-sharded pub/sub) before running more than one backend
// instance, since sockets on another process wouldn't be visible here.
const connectedRiders = new Map<string, AppSocket>();

export function registerConnectedRider(userId: string, socket: AppSocket): void {
  connectedRiders.set(userId, socket);
}

/** Only clears the entry if it still points at this exact socket — guards
 * against a stale disconnect handler wiping out a newer reconnection. */
export function unregisterConnectedRider(userId: string, socket: AppSocket): void {
  if (connectedRiders.get(userId) === socket) {
    connectedRiders.delete(userId);
  }
}

export function getConnectedRiderSocket(userId: string): AppSocket | undefined {
  return connectedRiders.get(userId);
}
