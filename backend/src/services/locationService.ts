import { pool } from '../config/db';

export interface LocationUpdateInput {
  userId: string;
  lat: number;
  lng: number;
  speed: number;
  heading: number | null;
  leanAngle: number | null;
  isRiding: boolean;
}

/**
 * Upserts the rider's single presence row. live_locations holds current
 * state only (see init.sql) — this is a hot path, expected every 1-3s per
 * active rider, so it stays a single indexed UPSERT with no history writes.
 */
export async function upsertLiveLocation(input: LocationUpdateInput): Promise<void> {
  const { userId, lat, lng, speed, heading, leanAngle, isRiding } = input;

  await pool.query(
    `INSERT INTO live_locations
       (user_id, coordinates, heading_deg, current_speed, current_lean_angle, is_riding, ghost_mode_active, updated_at)
     VALUES
       ($1, ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography, $4, $5, $6, $7, (SELECT ghost_mode_active FROM users WHERE id = $1), now())
     ON CONFLICT (user_id) DO UPDATE SET
       coordinates         = EXCLUDED.coordinates,
       heading_deg         = EXCLUDED.heading_deg,
       current_speed       = EXCLUDED.current_speed,
       current_lean_angle  = EXCLUDED.current_lean_angle,
       is_riding           = EXCLUDED.is_riding,
       ghost_mode_active   = (SELECT ghost_mode_active FROM users WHERE id = $1),
       updated_at           = now()`,
    [userId, lng, lat, heading, speed, leanAngle, isRiding]
  );
}

export async function clearLiveLocation(userId: string): Promise<void> {
  await pool.query('DELETE FROM live_locations WHERE user_id = $1', [userId]);
}

export interface NearbyRiderRow {
  user_id: string;
  lat: number;
  lng: number;
  current_speed: number;
  heading_deg: number | null;
  is_riding: boolean;
  updated_at: string;
  distance_km: number;
  username: string;
}

// Presence older than this is treated as stale even if never explicitly
// cleared (app killed, connection dropped without a clean disconnect).
const STALE_AFTER = "5 minutes";

/**
 * Riders within radiusKm of (lat, lng), nearest first. Uses the GIST index
 * on live_locations.coordinates via ST_DWithin, which is index-accelerated
 * for GEOGRAPHY columns (unlike a plain ST_Distance <= filter).
 */
export async function findNearbyRiders(
  userId: string,
  lat: number,
  lng: number,
  radiusKm: number
): Promise<NearbyRiderRow[]> {
  const radiusMeters = radiusKm * 1000;

  const { rows } = await pool.query<NearbyRiderRow>(
    `SELECT
       user_id,
       ST_Y(coordinates::geometry) AS lat,
       ST_X(coordinates::geometry) AS lng,
       current_speed,
       heading_deg,
       is_riding,
       l.updated_at,
       ST_Distance(l.coordinates, ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography) / 1000.0 AS distance_km,
       u.username
     FROM live_locations l
     JOIN users u ON u.id = l.user_id
     WHERE l.user_id <> $1
       AND l.ghost_mode_active = FALSE
       AND l.updated_at > now() - interval '${STALE_AFTER}'
       AND ST_DWithin(
             l.coordinates,
             ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography,
             $4
           )
     ORDER BY distance_km ASC
     LIMIT 200`,
    [userId, lng, lat, radiusMeters]
  );

  return rows;
}
