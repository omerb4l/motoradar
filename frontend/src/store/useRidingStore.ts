import { create } from 'zustand';
import { CreateRidePayload, RoutePoint } from '@/services/api/rideApi';

// Threshold to automatically trigger riding mode: ~15 km/h (4.17 m/s)
export const AUTO_RIDE_SPEED_THRESHOLD_MPS = 4.17;

interface RidingState {
  isRiding: boolean;
  isEmergency: boolean;
  emergencyType: 'MANUAL' | 'AUTO_CRASH' | null;
  speedMps: number;
  headingDeg: number;
  currentLeanDeg: number;
  currentGForce: number;
  
  sessionStartTime: number | null;
  sessionTopSpeedKmh: number;
  sessionMaxLeanLeftDeg: number;
  sessionMaxLeanRightDeg: number;
  sessionMaxLeanDeg: number;
  sessionMaxGForce: number;
  sessionDistanceKm: number;
  
  // Speed samples to compute average
  speedSamples: number[];
  routeCoordinates: RoutePoint[];
  lastCompletedRide: CreateRidePayload | null;

  updateTelemetry: (data: {
    speedMps: number;
    headingDeg?: number | null;
    leanDeg?: number | null;
    latitude?: number;
    longitude?: number;
  }) => void;
  startRide: () => void;
  endRide: () => CreateRidePayload | null;
  setSpeed: (speedMps: number) => void;
  setEmergency: (type: 'MANUAL' | 'AUTO_CRASH') => void;
  clearEmergency: () => void;
  resetLastCompletedRide: () => void;
}

let lastTelemetryTime = Date.now();
let lastSpeedMps = 0;

export const useRidingStore = create<RidingState>((set, get) => ({
  isRiding: false,
  isEmergency: false,
  emergencyType: null,
  speedMps: 0,
  headingDeg: 0,
  currentLeanDeg: 0,
  currentGForce: 1.0,
  sessionStartTime: null,
  sessionTopSpeedKmh: 0,
  sessionMaxLeanLeftDeg: 0,
  sessionMaxLeanRightDeg: 0,
  sessionMaxLeanDeg: 0,
  sessionMaxGForce: 1.0,
  sessionDistanceKm: 0,
  speedSamples: [],
  routeCoordinates: [],
  lastCompletedRide: null,

  startRide: () => {
    lastTelemetryTime = Date.now();
    lastSpeedMps = 0;
    set({
      isRiding: true,
      sessionStartTime: Date.now(),
      sessionTopSpeedKmh: 0,
      sessionMaxLeanLeftDeg: 0,
      sessionMaxLeanRightDeg: 0,
      sessionMaxLeanDeg: 0,
      sessionMaxGForce: 1.0,
      currentGForce: 1.0,
      sessionDistanceKm: 0,
      speedSamples: [],
      routeCoordinates: [],
    });
  },

  endRide: () => {
    const state = get();
    if (!state.sessionStartTime) {
      set({ isRiding: false });
      return null;
    }

    const durationSec = Math.max(1, Math.floor((Date.now() - state.sessionStartTime) / 1000));
    const avgSpeedKmh =
      state.speedSamples.length > 0
        ? Math.round(
            (state.speedSamples.reduce((a, b) => a + b, 0) / state.speedSamples.length) * 10
          ) / 10
        : Math.round(state.speedMps * 3.6 * 10) / 10;

    // Approximate distance from avg speed & duration if not tracked continuously
    const calcDistanceKm =
      state.sessionDistanceKm > 0
        ? Math.round(state.sessionDistanceKm * 100) / 100
        : Math.round(((avgSpeedKmh * durationSec) / 3600) * 100) / 100;

    const summaryPayload: CreateRidePayload = {
      title: 'Ride Session',
      distanceKm: Math.max(0.1, calcDistanceKm),
      durationSec,
      avgSpeedKmh,
      maxSpeedKmh: Math.round(state.sessionTopSpeedKmh * 10) / 10,
      maxLeanLeftDeg: Math.round(state.sessionMaxLeanLeftDeg * 10) / 10,
      maxLeanRightDeg: Math.round(state.sessionMaxLeanRightDeg * 10) / 10,
      maxGForce: Math.round(state.sessionMaxGForce * 100) / 100,
      elevationGainM: 140, // Simulated elevation gain
      routeCoordinates: state.routeCoordinates,
    };

    set({
      isRiding: false,
      sessionStartTime: null,
      lastCompletedRide: summaryPayload,
    });

    return summaryPayload;
  },

  resetLastCompletedRide: () => set({ lastCompletedRide: null }),

  setSpeed: (speedMps) => {
    const state = get();
    state.updateTelemetry({ speedMps });
  },

  updateTelemetry: ({ speedMps, headingDeg, leanDeg, latitude, longitude }) => {
    const now = Date.now();
    const dt = Math.max(0.1, (now - lastTelemetryTime) / 1000);
    lastTelemetryTime = now;

    const currentSpeedMps = Math.max(0, speedMps);
    const speedKmh = currentSpeedMps * 3.6;
    const currentHeading = headingDeg != null && headingDeg >= 0 ? headingDeg : get().headingDeg;
    
    // Calculate lean based on input or heading delta / speed if gyro simulated
    const lean = leanDeg ?? get().currentLeanDeg;
    const absLean = Math.abs(lean);

    // Realistic G-Force calculation:
    // Longitudinal acceleration: a_long = (v - v_prev) / dt
    const aLongMps2 = (currentSpeedMps - lastSpeedMps) / dt;
    lastSpeedMps = currentSpeedMps;
    const gLong = aLongMps2 / 9.81;

    // Lateral G-Force from motorcycle lean angle (physics equilibrium: tan(lean) = a_lat / g)
    const leanRad = (absLean * Math.PI) / 180;
    const gLat = Math.tan(Math.min(leanRad, (60 * Math.PI) / 180));

    // Resultant total dynamic G load (1.0G static + dynamic accelerations)
    const dynamicG = Math.sqrt(1.0 + Math.pow(gLong * 0.7, 2) + Math.pow(gLat, 2));
    const clampedG = Math.max(1.0, Math.min(2.5, Math.round(dynamicG * 100) / 100));

    set((state) => {
      const shouldAutoStart = !state.isRiding && speedMps >= AUTO_RIDE_SPEED_THRESHOLD_MPS;
      const isNowRiding = state.isRiding || shouldAutoStart;
      const sessionStart = isNowRiding && !state.sessionStartTime ? Date.now() : state.sessionStartTime;

      const newMaxLeft = lean < 0 ? Math.max(state.sessionMaxLeanLeftDeg, absLean) : state.sessionMaxLeanLeftDeg;
      const newMaxRight = lean > 0 ? Math.max(state.sessionMaxLeanRightDeg, absLean) : state.sessionMaxLeanRightDeg;
      const newMaxG = isNowRiding ? Math.max(state.sessionMaxGForce, clampedG) : state.sessionMaxGForce;

      const distanceIncrementKm = (currentSpeedMps * dt) / 1000;
      const newDistance = isNowRiding ? state.sessionDistanceKm + distanceIncrementKm : state.sessionDistanceKm;

      // Append route point if moving and coordinates available
      const newPoints = [...state.routeCoordinates];
      if (isNowRiding && latitude && longitude) {
        // throttle point additions (at least 5m apart or every 2 seconds)
        const lastPoint = newPoints[newPoints.length - 1];
        if (!lastPoint || now - lastPoint.timestamp >= 2000) {
          newPoints.push({
            latitude,
            longitude,
            speedKmh: Math.round(speedKmh),
            gForce: clampedG,
            leanDeg: Math.round(lean),
            timestamp: now,
          });
        }
      }

      return {
        speedMps: currentSpeedMps,
        headingDeg: currentHeading,
        currentLeanDeg: lean,
        currentGForce: clampedG,
        isRiding: isNowRiding,
        sessionStartTime: sessionStart,
        sessionTopSpeedKmh: isNowRiding ? Math.max(state.sessionTopSpeedKmh, speedKmh) : state.sessionTopSpeedKmh,
        sessionMaxLeanDeg: isNowRiding ? Math.max(state.sessionMaxLeanDeg, absLean) : state.sessionMaxLeanDeg,
        sessionMaxLeanLeftDeg: newMaxLeft,
        sessionMaxLeanRightDeg: newMaxRight,
        sessionMaxGForce: newMaxG,
        sessionDistanceKm: newDistance,
        speedSamples: isNowRiding && speedKmh > 3 ? [...state.speedSamples, speedKmh] : state.speedSamples,
        routeCoordinates: newPoints,
      };
    });
  },

  setEmergency: (type) => set({ isEmergency: true, emergencyType: type }),
  clearEmergency: () => set({ isEmergency: false, emergencyType: null }),
}));
