import { create } from 'zustand';
import { NearbyRider } from '@/types/location';

interface RidersState {
  nearbyRiders: NearbyRider[];
  lastUpdatedAt: number | null;
  setNearbyRiders: (riders: NearbyRider[]) => void;
}

export const useRidersStore = create<RidersState>((set) => ({
  nearbyRiders: [],
  lastUpdatedAt: null,
  setNearbyRiders: (riders) => set({ nearbyRiders: riders, lastUpdatedAt: Date.now() }),
}));
