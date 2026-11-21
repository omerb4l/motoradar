import { useCallback, useEffect, useRef, useState } from 'react';
import * as Location from 'expo-location';
import { getSocket } from '@/services/socket/socketClient';
import { useRidingStore } from '@/store/useRidingStore';

interface UseLocationTrackingOptions {
  isRiding?: boolean;
  radiusKm?: number;
  /** Minimum meters between emits — mirrors expo-location's own filter. */
  distanceIntervalM?: number;
  /** Minimum ms between emits. */
  timeIntervalMs?: number;
}

export type TrackingStatus =
  | 'idle'
  | 'requesting_permission'
  | 'tracking'
  | 'permission_denied'
  | 'error';

interface UseLocationTrackingResult {
  status: TrackingStatus;
  currentLocation: Location.LocationObject | null;
  errorMessage: string | null;
  startTracking: () => Promise<void>;
  stopTracking: () => void;
}

/**
 * Foreground tracking only for now: watchPositionAsync keeps emitting while
 * the JS thread is alive, which is enough to get live dots on the map.
 * Background permission is requested so the OS prompt is in place, but true
 * background delivery (expo-task-manager + a defined background task,
 * plus the corresponding app.json/Info.plist/AndroidManifest entries) is a
 * follow-up — wiring that in now would be dead weight until the rest of the
 * riding-state machine exists.
 *
 * Reads the socket via getSocket() at emit time rather than taking it as a
 * prop — that way tracking can start immediately on mount instead of being
 * gated on a socket-connected render, and a socket reconnect never leaves
 * this hook holding a stale/closed reference.
 */
export function useLocationTracking({
  isRiding = false,
  radiusKm = 50,
  distanceIntervalM = 0,
  timeIntervalMs = 500,
}: UseLocationTrackingOptions = {}): UseLocationTrackingResult {
  const [status, setStatus] = useState<TrackingStatus>('idle');
  const [currentLocation, setCurrentLocation] = useState<Location.LocationObject | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const subscriptionRef = useRef<Location.LocationSubscription | null>(null);

  const startTracking = useCallback(async () => {
    setErrorMessage(null);
    setStatus('requesting_permission');

    try {
      const { status: fgStatus } = await Location.requestForegroundPermissionsAsync();
      if (fgStatus !== 'granted') {
        setStatus('permission_denied');
        setErrorMessage('Foreground location permission denied');
        return;
      }

      // Expo Go disallows background location entitlements.
      // We safely catch any rejection so foreground tracking is never interrupted.
      try {
        await Location.requestBackgroundPermissionsAsync().catch((bgErr) => {
          console.warn('Background location request safely bypassed:', bgErr);
        });
      } catch (bgErr) {
        console.warn('Background location permission unavailable:', bgErr);
      }

      const servicesEnabled = await Location.hasServicesEnabledAsync();
      if (!servicesEnabled) {
        setStatus('error');
        setErrorMessage('Location services are disabled on this device');
        return;
      }

      subscriptionRef.current?.remove();
      subscriptionRef.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.BestForNavigation,
          distanceInterval: distanceIntervalM,
          timeInterval: timeIntervalMs,
        },
        (location) => {
          setCurrentLocation(location);

          const speed = Math.max(0, location.coords.speed ?? 0);
          const heading = location.coords.heading != null && location.coords.heading >= 0 ? location.coords.heading : null;
          
          // Feed directly to riding store for smooth HUD & auto-ride detection
          const ridingStore = useRidingStore.getState();
          ridingStore.updateTelemetry({
            speedMps: speed,
            headingDeg: heading,
          });

          getSocket()?.emit('update_location', {
            lat: location.coords.latitude,
            lng: location.coords.longitude,
            speed,
            heading,
            isRiding: ridingStore.isRiding,
            radiusKm,
          });
        }
      );

      setStatus('tracking');
    } catch (err) {
      setStatus('error');
      setErrorMessage(err instanceof Error ? err.message : 'Failed to start location tracking');
    }
  }, [isRiding, radiusKm, distanceIntervalM, timeIntervalMs]);

  const stopTracking = useCallback(() => {
    subscriptionRef.current?.remove();
    subscriptionRef.current = null;
    setStatus('idle');
  }, []);

  useEffect(() => stopTracking, [stopTracking]);

  return { status, currentLocation, errorMessage, startTracking, stopTracking };
}
