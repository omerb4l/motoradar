import { API_BASE_URL } from './config';

export interface UserProfileData {
  id: string;
  username: string;
  email: string;
  bio: string | null;
  avatarUrl: string | null;
  ghostModeActive: boolean;
  isVerified: boolean;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  createdAt: string;
}

export interface MotorcycleData {
  id: string;
  userId: string;
  brand: string;
  model: string;
  modelYear: number | null;
  displacementCc: number | null;
  vin: string | null;
  isVerified: boolean;
  photoUrl: string | null;
  photoIsVerified?: boolean;
  odometerMi: number;
  odometerKm?: number;
  ownershipStartDate?: string | null;
  ownershipEndDate?: string | null;
  topSpeed: number | null;
  topSpeedUnit: 'mph' | 'km/h';
  topSpeedContext: string | null;
  maxLeanDeg: number | null;
  maxLeanSide: 'LEFT' | 'RIGHT' | null;
  maxLeanContext: string | null;
  isPrimary: boolean;
  createdAt: string;
}

export async function fetchUserProfile(token: string): Promise<{ profile: UserProfileData; motorcycles: MotorcycleData[] }> {
  const res = await fetch(`${API_BASE_URL}/users/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error('Failed to fetch profile');
  }
  return res.json();
}

export async function updateUserProfile(
  token: string,
  updates: Partial<UserProfileData>
): Promise<UserProfileData> {
  const res = await fetch(`${API_BASE_URL}/users/me`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(updates),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error ?? 'Failed to update profile');
  }
  return data.profile;
}

export async function saveMotorcycle(
  token: string,
  data: Partial<MotorcycleData>
): Promise<MotorcycleData> {
  const res = await fetch(`${API_BASE_URL}/users/me/motorcycles`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });
  const result = await res.json();
  if (!res.ok) {
    throw new Error(result.error ?? 'Failed to save motorcycle');
  }
  return result.motorcycle;
}

export async function deleteMotorcycleApi(token: string, motorcycleId: string): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/users/me/motorcycles/${motorcycleId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error('Failed to delete motorcycle');
  }
}

export async function setPrimaryMotorcycleApi(token: string, motorcycleId: string): Promise<MotorcycleData> {
  const res = await fetch(`${API_BASE_URL}/users/me/motorcycles/${motorcycleId}/primary`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  const result = await res.json();
  if (!res.ok) {
    throw new Error(result.error ?? 'Failed to set primary motorcycle');
  }
  return result.motorcycle;
}

export async function fetchPublicUserProfile(token: string, userId: string): Promise<{ profile: Partial<UserProfileData>; motorcycles: MotorcycleData[] }> {
  const res = await fetch(`${API_BASE_URL}/users/${userId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error('Failed to fetch public profile');
  }
  return res.json();
}
