import { useEffect, useRef } from 'react';
import { DeviceMotion } from 'expo-sensors';
import { useRidingStore } from '@/store/useRidingStore';

/**
 * Motorcycle Lean Physics & Anti-Cheat Engine:
 * 1. Calculates true roll tilt from gravity and gyroscopic sensors.
 * 2. Applies physics-based speed gates:
 *    - Speed < 8 km/h -> 0° (impossible to lean stationary bike)
 *    - Speed 8-30 km/h -> capped dynamically by centripetal limits (e.g., max 20-35°)
 *    - Speed > 30 km/h -> maximum road limit capped at 56° (MotoGP race limit)
 * 3. Rejects erratic manual hand shaking / phone tilts when not moving.
 * 4. Filters out engine vibrations using exponential smoothing.
 */
export function useLeanAngleSensor(isRiding: boolean, speedMps: number) {
  const currentSmoothedLean = useRef(0);
  const baselineRoll = useRef<number | null>(null);
  const speedMpsRef = useRef(speedMps);
  const isRidingRef = useRef(isRiding);

  speedMpsRef.current = speedMps;
  isRidingRef.current = isRiding;

  useEffect(() => {
    // 20Hz update rate (50ms interval) for silky smooth 60fps gauge response without battery drain
    DeviceMotion.setUpdateInterval(50);

    const subscription = DeviceMotion.addListener((data) => {
      if (!data || !data.rotation) return;

      const currentSpeed = speedMpsRef.current;
      const speedKmh = Math.max(0, currentSpeed) * 3.6;

      // 1. SPEED GATE (Anti-Cheat): Standing still or walking cannot lean a motorcycle
      if (speedKmh < 8) {
        currentSmoothedLean.current = currentSmoothedLean.current * 0.85; // smooth back to 0
        useRidingStore.getState().updateTelemetry({
          speedMps: currentSpeed,
          leanDeg: Math.round(currentSmoothedLean.current),
        });
        return;
      }

      // 2. RAW ROLL ANGLE (Device roll around longitudinal axis)
      // data.rotation provides roll, pitch, yaw in radians
      const rawRollRad = data.rotation.gamma ?? 0; // roll tilt in radians
      let rawRollDeg = (rawRollRad * 180) / Math.PI;

      // Baseline calibration for phone mounts (if slightly mounted at an angle)
      if (baselineRoll.current === null) {
        baselineRoll.current = rawRollDeg;
      }

      let relativeLean = rawRollDeg - (baselineRoll.current ?? 0);

      // Normalize between -90 and 90
      if (relativeLean > 90) relativeLean = 90;
      if (relativeLean < -90) relativeLean = -90;

      // 3. PHYSICAL SPEED CEILING (Anti-Cheat)
      // At low speeds (e.g. 15 km/h), physics limits lean to ~25°. At higher speeds up to 55°.
      let maxAllowedLean = 55;
      if (speedKmh < 20) {
        maxAllowedLean = Math.min(25, 5 + speedKmh * 1.0);
      } else if (speedKmh < 40) {
        maxAllowedLean = Math.min(42, 20 + (speedKmh - 20) * 1.1);
      } else {
        maxAllowedLean = 56;
      }

      // Clamp to physical threshold
      let validatedLean = Math.max(-maxAllowedLean, Math.min(maxAllowedLean, relativeLean));

      // 4. LOW-PASS EXPONENTIAL FILTER (Removes road bumps & engine vibration)
      const smoothingFactor = 0.25; // 25% new sample, 75% previous sample
      currentSmoothedLean.current = 
        currentSmoothedLean.current * (1 - smoothingFactor) + validatedLean * smoothingFactor;

      const finalLean = Math.round(currentSmoothedLean.current * 10) / 10;

      useRidingStore.getState().updateTelemetry({
        speedMps: currentSpeed,
        leanDeg: finalLean,
      });
    });

    return () => {
      subscription.remove();
    };
  }, []);
}
