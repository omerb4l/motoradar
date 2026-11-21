import { API_BASE_URL } from './config';

export type ReminderType = 'TUVTURK_INSPECTION' | 'TRAFFIC_INSURANCE' | 'KASKO' | 'CUSTOM';

export type ReminderStatus = 
  | 'SAFE' 
  | 'WARNING_30D' 
  | 'WARNING_7D' 
  | 'WARNING_3D' 
  | 'WARNING_1D' 
  | 'EXPIRED';

export interface VehicleReminder {
  id: string;
  userId: string;
  motorcycleId: string | null;
  motorcycleName?: string;
  type: ReminderType;
  title: string;
  lastCompletedDate: string;
  validityMonths: number;
  expiryDate: string;
  daysRemaining: number;
  status: ReminderStatus;
  notes?: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface CreateReminderPayload {
  motorcycleId?: string | null;
  type: ReminderType;
  title?: string;
  lastCompletedDate: string; // YYYY-MM-DD
  validityMonths?: number;
  notes?: string | null;
}

export async function fetchRemindersApi(token: string): Promise<VehicleReminder[]> {
  const res = await fetch(`${API_BASE_URL}/reminders`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Failed to fetch reminders');
  return res.json();
}

export async function createReminderApi(token: string, payload: CreateReminderPayload): Promise<VehicleReminder> {
  const res = await fetch(`${API_BASE_URL}/reminders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('Failed to create reminder');
  return res.json();
}

export async function renewReminderApi(token: string, reminderId: string, newLastDate?: string): Promise<VehicleReminder> {
  const res = await fetch(`${API_BASE_URL}/reminders/${reminderId}/renew`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ newLastDate }),
  });
  if (!res.ok) throw new Error('Failed to renew reminder');
  return res.json();
}

export async function deleteReminderApi(token: string, reminderId: string): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/reminders/${reminderId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Failed to delete reminder');
}
