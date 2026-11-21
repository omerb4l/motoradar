export interface LocationUpdatePayload {
  lat: number;
  lng: number;
  /** meters/second, matches expo-location's Coords.speed */
  speed: number;
  heading?: number | null;
  leanAngle?: number | null;
  isRiding?: boolean;
  radiusKm?: number;
}

export interface NearbyRider {
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
