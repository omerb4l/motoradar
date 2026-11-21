import { API_BASE_URL } from './config';

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

export interface CreateRidePayload {
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

export async function fetchRidesApi(token: string): Promise<RideSummary[]> {
  const res = await fetch(`${API_BASE_URL}/rides`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Failed to fetch rides');
  return res.json();
}

export async function createRideApi(token: string, payload: CreateRidePayload): Promise<RideSummary> {
  const res = await fetch(`${API_BASE_URL}/rides`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('Failed to create ride summary');
  return res.json();
}

export async function fetchRideDetailsApi(token: string, id: string): Promise<RideSummary> {
  const res = await fetch(`${API_BASE_URL}/rides/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Failed to fetch ride details');
  return res.json();
}

export async function deleteRideApi(token: string, id: string): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/rides/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Failed to delete ride');
}
