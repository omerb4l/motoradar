import { create } from 'zustand';
import {
  createReminderApi,
  CreateReminderPayload,
  deleteReminderApi,
  fetchRemindersApi,
  renewReminderApi,
  VehicleReminder,
} from '@/services/api/reminderApi';

interface ReminderState {
  reminders: VehicleReminder[];
  loading: boolean;
  fetchReminders: (token: string) => Promise<void>;
  addReminder: (token: string, payload: CreateReminderPayload) => Promise<VehicleReminder>;
  renewReminder: (token: string, id: string, newDate?: string) => Promise<void>;
  removeReminder: (token: string, id: string) => Promise<void>;
}

export const useReminderStore = create<ReminderState>((set, get) => ({
  reminders: [],
  loading: false,

  fetchReminders: async (token: string) => {
    try {
      set({ loading: true });
      const data = await fetchRemindersApi(token);
      set({ reminders: data });
    } catch (err) {
      console.warn('Failed to load reminders:', err);
    } finally {
      set({ loading: false });
    }
  },

  addReminder: async (token: string, payload: CreateReminderPayload) => {
    const created = await createReminderApi(token, payload);
    set((state) => ({
      reminders: [...state.reminders.filter((r) => r.id !== created.id), created].sort(
        (a, b) => a.daysRemaining - b.daysRemaining
      ),
    }));
    return created;
  },

  renewReminder: async (token: string, id: string, newDate?: string) => {
    const renewed = await renewReminderApi(token, id, newDate);
    set((state) => ({
      reminders: state.reminders
        .map((r) => (r.id === id ? renewed : r))
        .sort((a, b) => a.daysRemaining - b.daysRemaining),
    }));
  },

  removeReminder: async (token: string, id: string) => {
    await deleteReminderApi(token, id);
    set((state) => ({
      reminders: state.reminders.filter((r) => r.id !== id),
    }));
  },
}));
