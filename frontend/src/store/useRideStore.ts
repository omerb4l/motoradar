import { create } from 'zustand';
import {
  createRideApi,
  CreateRidePayload,
  deleteRideApi,
  fetchRidesApi,
  RideSummary,
} from '@/services/api/rideApi';
import { createAlbumPost } from '@/services/api/albumApi';

interface RideStoreState {
  rides: RideSummary[];
  loading: boolean;
  activeRideDetail: RideSummary | null;
  fetchRides: (token: string) => Promise<void>;
  saveCompletedRide: (token: string, payload: CreateRidePayload) => Promise<RideSummary>;
  deleteRide: (token: string, id: string) => Promise<void>;
  publishRideToAlbum: (token: string, ride: RideSummary | CreateRidePayload, caption?: string) => Promise<void>;
}

export const useRideStore = create<RideStoreState>((set, get) => ({
  rides: [],
  loading: false,
  activeRideDetail: null,

  fetchRides: async (token: string) => {
    try {
      set({ loading: true });
      const data = await fetchRidesApi(token);
      set({ rides: data });
    } catch (err) {
      console.warn('Failed to load past rides:', err);
    } finally {
      set({ loading: false });
    }
  },

  saveCompletedRide: async (token: string, payload: CreateRidePayload) => {
    const created = await createRideApi(token, payload);
    set((state) => ({
      rides: [created, ...state.rides],
      activeRideDetail: created,
    }));
    return created;
  },

  deleteRide: async (token: string, id: string) => {
    await deleteRideApi(token, id);
    set((state) => ({
      rides: state.rides.filter((r) => r.id !== id),
    }));
  },

  publishRideToAlbum: async (token: string, ride: RideSummary | CreateRidePayload, customCaption?: string) => {
    // Generate a sleek motorsport summary caption with telemetry
    const defaultCaption = `🏁 RIDE TELEMETRY RECAP\n• Distance: ${ride.distanceKm} KM · Time: ${Math.floor(ride.durationSec / 60)}m\n• Top Speed: ${ride.maxSpeedKmh} KM/H (Avg: ${ride.avgSpeedKmh} KM/H)\n• Lean Angle: ⟵ ${ride.maxLeanLeftDeg || 0}° L | ${ride.maxLeanRightDeg || 0}° R ⟶\n• Peak G-Force: ${ride.maxGForce || 1.0} G`;

    const finalCaption = customCaption ? `${customCaption}\n\n${defaultCaption}` : defaultCaption;

    // Use high-end motorcycle ride route poster image
    const posterUrl = 'https://images.unsplash.com/photo-1558981403-c5f9899a28bc?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80';

    await createAlbumPost(token, {
      photoUrl: posterUrl,
      caption: finalCaption,
      locationName: 'Scenic Canyon Route',
    });
  },
}));
