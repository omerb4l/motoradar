import { Server, Socket } from 'socket.io';
import { z } from 'zod';
import { insertSosAlert, cancelSosAlert } from '../../services/sosService';
import { ClientToServerEvents, ServerToClientEvents } from '../types';
import { pool } from '../../config/db';

type AppSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

const triggerSosSchema = z.object({
  alertType: z.enum(['AUTO_CRASH', 'MANUAL']),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

const cancelSosSchema = z.object({
  alertId: z.string().uuid(),
});

export function registerSosHandlers(io: Server, socket: AppSocket, userId: string) {
  socket.on('trigger_sos', async (payload) => {
    const parsed = triggerSosSchema.safeParse(payload);
    if (!parsed.success) {
      socket.emit('error', { message: 'Invalid SOS payload' });
      return;
    }

    try {
      // 1. Insert alert into DB
      const alert = await insertSosAlert(userId, parsed.data.alertType, parsed.data.lat, parsed.data.lng);

      // 2. Fetch user details to broadcast
      const { rows } = await pool.query('SELECT username FROM users WHERE id = $1', [userId]);
      const username = rows[0]?.username || 'Unknown Rider';

      // 3. Broadcast to all active sockets (in reality, you'd filter by radius using PostGIS)
      // For now, this global broadcast ensures anyone on the map sees it.
      io.emit('sos_alert_received', {
        id: alert.id,
        userId: userId,
        username: username,
        alertType: parsed.data.alertType,
        lat: parsed.data.lat,
        lng: parsed.data.lng,
        createdAt: alert.created_at,
      });

    } catch (err) {
      console.error(`trigger_sos failed for user ${userId}`, err);
      socket.emit('error', { message: 'Failed to trigger SOS' });
    }
  });

  socket.on('cancel_sos', async (payload) => {
    const parsed = cancelSosSchema.safeParse(payload);
    if (!parsed.success) {
      return;
    }
    try {
      await cancelSosAlert(parsed.data.alertId, userId);
      io.emit('sos_alert_cancelled', { id: parsed.data.alertId, userId });
    } catch (err) {
      console.error(`cancel_sos failed for user ${userId}`, err);
    }
  });
}
