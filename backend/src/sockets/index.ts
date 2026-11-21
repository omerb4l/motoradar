import { Server as HttpServer } from 'http';
import { Server as SocketServer } from 'socket.io';
import { registerLocationHandlers } from './handlers/location';
import { registerRendezvousHandlers } from './handlers/rendezvous';
import { registerChatHandlers } from './handlers/chat';
import { registerSosHandlers } from './handlers/sos';
import { clearLiveLocation } from '../services/locationService';
import { verifyAuthToken } from '../utils/jwt';
import { registerConnectedRider, unregisterConnectedRider } from './connectedRiders';
import { ClientToServerEvents, ServerToClientEvents } from './types';

/**
 * Live location is the highest-frequency event on the socket layer — riders
 * emit position updates every 1-3s while riding. Keep this handler thin:
 * validate, upsert into live_locations, and answer with nearby riders.
 * Heavier logic (SOS detection, beacon fan-out) belongs in services/.
 */
export function attachSockets(httpServer: HttpServer) {
  const io = new SocketServer<ClientToServerEvents, ServerToClientEvents>(httpServer, {
    cors: { origin: '*' },
  });

  // Runs before 'connection' — reject unauthenticated sockets outright so
  // no handler ever has to re-check identity.
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (typeof token !== 'string' || token.length === 0) {
      next(new Error('Missing auth token'));
      return;
    }

    try {
      socket.data.userId = verifyAuthToken(token).sub;
      next();
    } catch {
      next(new Error('Invalid or expired auth token'));
    }
  });

  io.on('connection', (socket) => {
    const userId = socket.data.userId as string;

    registerConnectedRider(userId, socket);
    registerLocationHandlers(io, socket, userId);
    registerRendezvousHandlers(io, socket, userId);
    registerChatHandlers(io, socket, userId);
    registerSosHandlers(io, socket, userId);

    socket.on('disconnect', async () => {
      unregisterConnectedRider(userId, socket);
      try {
        await clearLiveLocation(userId);
      } catch (err) {
        console.error(`Failed to clear live_location for ${userId} on disconnect`, err);
      }
    });
  });

  return io;
}
