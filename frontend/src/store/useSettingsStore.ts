import { create } from 'zustand';

type SpeedUnit = 'km/h' | 'mph';

interface SettingsState {
  speedUnit: SpeedUnit;
  setSpeedUnit: (unit: SpeedUnit) => void;
  ghostMode: boolean;
  setGhostMode: (val: boolean) => void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  speedUnit: 'km/h',
  setSpeedUnit: (unit) => set({ speedUnit: unit }),
  ghostMode: false,
  setGhostMode: (val) => set({ ghostMode: val }),
}));
