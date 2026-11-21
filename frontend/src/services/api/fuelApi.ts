import { API_BASE_URL } from './config';

export interface FuelStationPrice {
  brand: string;
  fuelType: string;
  pricePerLiter: number;
  currency: string;
  logoColor: string;
  updatedAt: string;
}

export interface FuelLogRow {
  id: string;
  user_id: string;
  motorcycle_id?: string;
  station_brand?: string;
  liters: number;
  cost: number;
  odometer_km?: number;
  currency: string;
  created_at: string;
}

export interface MonthlyFuelStat {
  month: string;
  totalCost: number;
  totalLiters: number;
  fillCount: number;
}

export interface FuelSummary {
  logs: FuelLogRow[];
  currentMonthCost: number;
  currentMonthFillUps: number;
  totalLitersAllTime: number;
  totalCostAllTime: number;
  avgConsumptionL100Km: number;
  monthlyStats: MonthlyFuelStat[];
  livePrices: FuelStationPrice[];
}

export async function fetchFuelSummary(token: string): Promise<FuelSummary> {
  const res = await fetch(`${API_BASE_URL}/fuel-logs`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch fuel summary: ${res.status}`);
  }
  return res.json();
}

export async function fetchLiveFuelPrices(token: string): Promise<FuelStationPrice[]> {
  const res = await fetch(`${API_BASE_URL}/fuel-logs/prices`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch live fuel prices: ${res.status}`);
  }
  return res.json();
}

export async function createFuelLog(
  token: string,
  data: { 
    liters: number; 
    cost: number; 
    stationBrand?: string; 
    odometerKm?: number; 
    motorcycleId?: string 
  }
): Promise<FuelLogRow> {
  const res = await fetch(`${API_BASE_URL}/fuel-logs`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    throw new Error(`Failed to create fuel log: ${res.status}`);
  }
  return res.json();
}

export async function removeFuelLog(token: string, logId: string): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/fuel-logs/${logId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error(`Failed to delete fuel log: ${res.status}`);
  }
}
