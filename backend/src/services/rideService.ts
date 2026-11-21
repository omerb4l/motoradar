import { pool } from '../config/db';

export interface RoutePoint {
  latitude: number;
  longitude: number;
  speedKmh: number;
  gForce?: number;
  leanDeg?: number;
  timestamp: number;
}

export interface RideSummary {
  id: string;
  userId: string;
  motorcycleId: string | null;
  motorcycleName?: string;
  title: string;
  distanceKm: number;
  durationSec: number;
  avgSpeedKmh: number;
  maxSpeedKmh: number;
  maxLeanLeftDeg: number;
  maxLeanRightDeg: number;
  maxGForce: number;
  elevationGainM: number;
  routeCoordinates: RoutePoint[];
  createdAt: string;
}

export interface CreateRideInput {
  motorcycleId?: string | null;
  title?: string;
  distanceKm: number;
  durationSec: number;
  avgSpeedKmh: number;
  maxSpeedKmh: number;
  maxLeanLeftDeg?: number;
  maxLeanRightDeg?: number;
  maxGForce?: number;
  elevationGainM?: number;
  routeCoordinates?: RoutePoint[];
}

export async function createRide(userId: string, input: CreateRideInput): Promise<RideSummary> {
  const title = input.title || 'Ride Session';
  const maxLeanLeft = input.maxLeanLeftDeg ?? 0;
  const maxLeanRight = input.maxLeanRightDeg ?? 0;
  const maxGForce = input.maxGForce ?? 1.0;
  const elevationGain = input.elevationGainM ?? 0;
  const routeCoords = JSON.stringify(input.routeCoordinates || []);

  const { rows } = await pool.query(
    `INSERT INTO ride_summaries (
       user_id,
       motorcycle_id,
       title,
       distance_km,
       duration_sec,
       avg_speed_kmh,
       max_speed_kmh,
       max_lean_left_deg,
       max_lean_right_deg,
       max_g_force,
       elevation_gain_m,
       route_coordinates
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb)
     RETURNING 
       id,
       user_id,
       motorcycle_id,
       title,
       distance_km,
       duration_sec,
       avg_speed_kmh,
       max_speed_kmh,
       max_lean_left_deg,
       max_lean_right_deg,
       max_g_force,
       elevation_gain_m,
       route_coordinates,
       created_at`,
    [
      userId,
      input.motorcycleId || null,
      title,
      input.distanceKm,
      input.durationSec,
      input.avgSpeedKmh,
      input.maxSpeedKmh,
      maxLeanLeft,
      maxLeanRight,
      maxGForce,
      elevationGain,
      routeCoords,
    ]
  );

  const row = rows[0];
  return {
    id: row.id,
    userId: row.user_id,
    motorcycleId: row.motorcycle_id,
    title: row.title,
    distanceKm: parseFloat(row.distance_km),
    durationSec: parseInt(row.duration_sec, 10),
    avgSpeedKmh: parseFloat(row.avg_speed_kmh),
    maxSpeedKmh: parseFloat(row.max_speed_kmh),
    maxLeanLeftDeg: parseFloat(row.max_lean_left_deg),
    maxLeanRightDeg: parseFloat(row.max_lean_right_deg),
    maxGForce: parseFloat(row.max_g_force),
    elevationGainM: parseFloat(row.elevation_gain_m),
    routeCoordinates: row.route_coordinates || [],
    createdAt: row.created_at,
  };
}

export async function getUserRides(userId: string, limit = 20, offset = 0): Promise<RideSummary[]> {
  const { rows } = await pool.query(
    `SELECT 
       r.id,
       r.user_id,
       r.motorcycle_id,
       r.title,
       r.distance_km,
       r.duration_sec,
       r.avg_speed_kmh,
       r.max_speed_kmh,
       r.max_lean_left_deg,
       r.max_lean_right_deg,
       r.max_g_force,
       r.elevation_gain_m,
       r.route_coordinates,
       r.created_at,
       m.brand,
       m.model
     FROM ride_summaries r
     LEFT JOIN motorcycles m ON r.motorcycle_id = m.id
     WHERE r.user_id = $1
     ORDER BY r.created_at DESC
     LIMIT $2 OFFSET $3`,
    [userId, limit, offset]
  );

  return rows.map((row) => ({
    id: row.id,
    userId: row.user_id,
    motorcycleId: row.motorcycle_id,
    motorcycleName: row.brand && row.model ? `${row.brand} ${row.model}` : undefined,
    title: row.title,
    distanceKm: parseFloat(row.distance_km),
    durationSec: parseInt(row.duration_sec, 10),
    avgSpeedKmh: parseFloat(row.avg_speed_kmh),
    maxSpeedKmh: parseFloat(row.max_speed_kmh),
    maxLeanLeftDeg: parseFloat(row.max_lean_left_deg),
    maxLeanRightDeg: parseFloat(row.max_lean_right_deg),
    maxGForce: parseFloat(row.max_g_force),
    elevationGainM: parseFloat(row.elevation_gain_m),
    routeCoordinates: row.route_coordinates || [],
    createdAt: row.created_at,
  }));
}

export async function getRideDetails(userId: string, rideId: string): Promise<RideSummary | null> {
  const { rows } = await pool.query(
    `SELECT 
       r.id,
       r.user_id,
       r.motorcycle_id,
       r.title,
       r.distance_km,
       r.duration_sec,
       r.avg_speed_kmh,
       r.max_speed_kmh,
       r.max_lean_left_deg,
       r.max_lean_right_deg,
       r.max_g_force,
       r.elevation_gain_m,
       r.route_coordinates,
       r.created_at,
       m.brand,
       m.model
     FROM ride_summaries r
     LEFT JOIN motorcycles m ON r.motorcycle_id = m.id
     WHERE r.id = $1 AND r.user_id = $2`,
    [rideId, userId]
  );

  if (rows.length === 0) return null;
  const row = rows[0];

  return {
    id: row.id,
    userId: row.user_id,
    motorcycleId: row.motorcycle_id,
    motorcycleName: row.brand && row.model ? `${row.brand} ${row.model}` : undefined,
    title: row.title,
    distanceKm: parseFloat(row.distance_km),
    durationSec: parseInt(row.duration_sec, 10),
    avgSpeedKmh: parseFloat(row.avg_speed_kmh),
    maxSpeedKmh: parseFloat(row.max_speed_kmh),
    maxLeanLeftDeg: parseFloat(row.max_lean_left_deg),
    maxLeanRightDeg: parseFloat(row.max_lean_right_deg),
    maxGForce: parseFloat(row.max_g_force),
    elevationGainM: parseFloat(row.elevation_gain_m),
    routeCoordinates: row.route_coordinates || [],
    createdAt: row.created_at,
  };
}

export async function deleteRide(userId: string, rideId: string): Promise<boolean> {
  const result = await pool.query(
    `DELETE FROM ride_summaries WHERE id = $1 AND user_id = $2`,
    [rideId, userId]
  );
  return (result.rowCount ?? 0) > 0;
}
