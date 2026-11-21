import { Server, Socket } from 'socket.io';
import { z } from 'zod';
import { upsertLiveLocation, findNearbyRiders, NearbyRiderRow } from '../../services/locationService';
import { updateUserAnchor } from '../../services/botService';
import { getConnectedRiderSocket } from '../connectedRiders';
import { ClientToServerEvents, NearbyRiderDTO, ServerToClientEvents } from '../types';

const DEFAULT_RADIUS_KM = 50;
const MAX_RADIUS_KM = 200;

const locationUpdateSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  speed: z.number().min(0).max(120), // m/s — generous upper bound, tune once real telemetry exists
  heading: z.number().min(0).max(360).nullable().optional(),
  leanAngle: z.number().min(-90).max(90).nullable().optional(),
  isRiding: z.boolean().optional(),
  radiusKm: z.number().min(1).max(MAX_RADIUS_KM).optional(),
});

type AppSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

export function registerLocationHandlers(io: Server, socket: AppSocket, userId: string) {
  socket.on('update_location', async (payload) => {
    const parsed = locationUpdateSchema.safeParse(payload);
    if (!parsed.success) {
      socket.emit('error', { message: 'Invalid location payload', issues: parsed.error.issues });
      return;
    }

    const { lat, lng, speed, heading = null, leanAngle = null, isRiding = false, radiusKm } = parsed.data;
    const effectiveRadiusKm = radiusKm ?? DEFAULT_RADIUS_KM;

    try {
      updateUserAnchor(lat, lng);
      await upsertLiveLocation({ userId, lat, lng, speed, heading, leanAngle, isRiding });

      const rows = await findNearbyRiders(userId, lat, lng, effectiveRadiusKm);
      socket.emit('nearby_riders_update', rows.map(toNearbyRiderDTO));

      // Symmetric visibility: without this, a stationary rider B only sees
      // A once B *also* emits an update — a pull model where two parked
      // riders never discover each other. Instead, push A's arrival to
      // every nearby rider who's actually connected right now, computed
      // from *their* last known position (already have lat/lng from the
      // rows above, no extra geo lookup needed for who's nearby).
      await Promise.all(
        rows.map(async (row) => {
          const neighborSocket = getConnectedRiderSocket(row.user_id);
          if (!neighborSocket) return;

          try {
            const neighborRows = await findNearbyRiders(row.user_id, row.lat, row.lng, effectiveRadiusKm);
            neighborSocket.emit('nearby_riders_update', neighborRows.map(toNearbyRiderDTO));
          } catch (err) {
            console.error(`Failed to push nearby update to ${row.user_id}`, err);
          }
        })
      );
    } catch (err) {
      console.error(`update_location failed for user ${userId}`, err);
      socket.emit('error', { message: 'Failed to update location' });
    }
  });
}

function toNearbyRiderDTO(row: NearbyRiderRow): NearbyRiderDTO {
  return {
    userId: row.user_id,
    lat: row.lat,
    lng: row.lng,
    speed: row.current_speed,
    heading: row.heading_deg,
    isRiding: row.is_riding,
    distanceKm: Number(row.distance_km.toFixed(2)),
    updatedAt: row.updated_at,
    username: row.username,
  };
}
