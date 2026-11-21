import { create } from 'zustand';

export interface IncomingSosAlert {
  id: string;
  userId: string;
  username: string;
  alertType: 'AUTO_CRASH' | 'MANUAL';
  lat: number;
  lng: number;
  createdAt: string;
}

interface SosState {
  activeAlerts: IncomingSosAlert[];
  addAlert: (alert: IncomingSosAlert) => void;
  removeAlert: (id: string) => void;
}

export const useSosStore = create<SosState>((set) => ({
  activeAlerts: [],
  addAlert: (alert) => set((state) => ({ 
    activeAlerts: [...state.activeAlerts.filter(a => a.id !== alert.id), alert] 
  })),
  removeAlert: (id) => set((state) => ({ 
    activeAlerts: state.activeAlerts.filter((a) => a.id !== id) 
  })),
}));
