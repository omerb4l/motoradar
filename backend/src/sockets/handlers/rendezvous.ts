import { Server, Socket } from 'socket.io';
import { z } from 'zod';
import { createRendezvousRequest, updateRendezvousStatus, setRendezvousTraveler } from '../../services/rendezvousService';
import { simulateBotAcceptRendezvous } from '../../services/botService';
import { getConnectedRiderSocket } from '../connectedRiders';
import { ClientToServerEvents, ServerToClientEvents } from '../types';

const rendezvousRequestSchema = z.object({
  recipientId: z.string().uuid(),
  type: z.string(),
  etaMinutes: z.number().optional(),
});

const rendezvousResponseSchema = z.object({
  requestId: z.string().uuid(),
  status: z.enum(['ACCEPTED', 'DECLINED', 'COMPLETED', 'CANCELLED']),
});

const setTravelerSchema = z.object({
  requestId: z.string().uuid(),
  travelingUserId: z.string().uuid(),
});

type AppSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

export function registerRendezvousHandlers(io: Server, socket: AppSocket, userId: string) {
  
  socket.on('send_rendezvous', async (payload) => {
    const parsed = rendezvousRequestSchema.safeParse(payload);
    if (!parsed.success) {
      socket.emit('error', { message: 'Invalid rendezvous request' });
      return;
    }

    try {
      const request = await createRendezvousRequest({
        requesterId: userId,
        ...parsed.data,
      });

      // Send to recipient if they are online
      const recipientSocket = getConnectedRiderSocket(parsed.data.recipientId);
      if (recipientSocket) {
        recipientSocket.emit('rendezvous_received', {
          id: request.id,
          requesterId: request.requester_id,
          type: parsed.data.type,
          etaMinutes: request.eta_minutes ?? undefined,
        });
      }

      // If the recipient is a bot, simulate an auto-accept
      simulateBotAcceptRendezvous(request.id, request.requester_id, request.recipient_id);

    } catch (err) {
      console.error('Failed to send rendezvous', err);
      socket.emit('error', { message: 'Failed to send ride request' });
    }
  });

  socket.on('respond_rendezvous', async (payload) => {
    const parsed = rendezvousResponseSchema.safeParse(payload);
    if (!parsed.success) {
      socket.emit('error', { message: 'Invalid rendezvous response' });
      return;
    }

    try {
      const request = await updateRendezvousStatus(parsed.data.requestId, parsed.data.status);
      if (!request) return;

      // Notify the requester
      const requesterSocket = getConnectedRiderSocket(request.requester_id);
      if (requesterSocket) {
        requesterSocket.emit('rendezvous_status_changed', {
          id: request.id,
          status: request.status,
        });
      }
    } catch (err) {
      console.error('Failed to respond to rendezvous', err);
      socket.emit('error', { message: 'Failed to respond to ride request' });
    }
  });

  socket.on('set_rendezvous_traveler', async (payload) => {
    const parsed = setTravelerSchema.safeParse(payload);
    if (!parsed.success) {
      socket.emit('error', { message: 'Invalid set traveler request' });
      return;
    }

    try {
      const request = await setRendezvousTraveler(parsed.data.requestId, parsed.data.travelingUserId);
      if (!request) return;

      // Broadcast to both users
      const requesterSocket = getConnectedRiderSocket(request.requester_id);
      if (requesterSocket) {
        requesterSocket.emit('rendezvous_traveler_updated', {
          id: request.id,
          travelingUserId: request.traveling_user_id!,
        });
      }

      const recipientSocket = getConnectedRiderSocket(request.recipient_id);
      if (recipientSocket) {
        recipientSocket.emit('rendezvous_traveler_updated', {
          id: request.id,
          travelingUserId: request.traveling_user_id!,
        });
      }
    } catch (err) {
      console.error('Failed to set rendezvous traveler', err);
      socket.emit('error', { message: 'Failed to update traveler' });
    }
  });
}
