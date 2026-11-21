import { pool } from '../config/db';

export interface FuelStationPrice {
  brand: string;
  fuelType: string;
  pricePerLiter: number;
  currency: string;
  logoColor: string;
  updatedAt: string;
}

export const LIVE_FUEL_PRICES: Record<string, FuelStationPrice> = {
  Opet: {
    brand: 'Opet',
    fuelType: 'Kurşunsuz 95',
    pricePerLiter: 44.95,
    currency: 'TL',
    logoColor: '#005BBB',
    updatedAt: new Date().toISOString(),
  },
  Shell: {
    brand: 'Shell',
    fuelType: 'V-Power 95',
    pricePerLiter: 45.15,
    currency: 'TL',
    logoColor: '#FFD100',
    updatedAt: new Date().toISOString(),
  },
  'Petrol Ofisi': {
    brand: 'Petrol Ofisi',
    fuelType: 'V/Max 95',
    pricePerLiter: 44.90,
    currency: 'TL',
    logoColor: '#E30613',
    updatedAt: new Date().toISOString(),
  },
  BP: {
    brand: 'BP',
    fuelType: 'Ultimate 95',
    pricePerLiter: 45.05,
    currency: 'TL',
    logoColor: '#007A3D',
    updatedAt: new Date().toISOString(),
  },
  TotalEnergies: {
    brand: 'TotalEnergies',
    fuelType: 'Excellium 95',
    pricePerLiter: 44.85,
    currency: 'TL',
    logoColor: '#ED1C24',
    updatedAt: new Date().toISOString(),
  },
  Aytemiz: {
    brand: 'Aytemiz',
    fuelType: 'Optimum 95',
    pricePerLiter: 44.80,
    currency: 'TL',
    logoColor: '#E30613',
    updatedAt: new Date().toISOString(),
  },
  Sunpet: {
    brand: 'Sunpet',
    fuelType: 'Kurşunsuz 95',
    pricePerLiter: 44.75,
    currency: 'TL',
    logoColor: '#FF9E1B',
    updatedAt: new Date().toISOString(),
  },
};

export function getLiveFuelPrices(): FuelStationPrice[] {
  return Object.values(LIVE_FUEL_PRICES);
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

export async function getFuelLogsForUser(userId: string): Promise<FuelSummary> {
  const { rows: logs } = await pool.query<FuelLogRow>(
    `SELECT id, user_id, motorcycle_id, station_brand, liters::float, cost::float, odometer_km::float, currency, created_at
     FROM fuel_logs
     WHERE user_id = $1
     ORDER BY created_at DESC`,
    [userId]
  );

  const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  const now = new Date();
  const currentMonthIdx = now.getMonth();

  const monthlyMap = new Map<string, { totalCost: number; totalLiters: number; count: number }>();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), currentMonthIdx - i, 1);
    const label = months[d.getMonth()];
    monthlyMap.set(label, { totalCost: 0, totalLiters: 0, count: 0 });
  }

  let totalLitersAll = 0;
  let totalCostAll = 0;
  let currentMonthCost = 0;
  let currentMonthFillUps = 0;

  for (const log of logs) {
    const logDate = new Date(log.created_at);
    const mLabel = months[logDate.getMonth()];
    totalLitersAll += log.liters;
    totalCostAll += log.cost;

    if (logDate.getMonth() === currentMonthIdx && logDate.getFullYear() === now.getFullYear()) {
      currentMonthCost += log.cost;
      currentMonthFillUps += 1;
    }

    if (monthlyMap.has(mLabel)) {
      const current = monthlyMap.get(mLabel)!;
      current.totalCost += log.cost;
      current.totalLiters += log.liters;
      current.count += 1;
    }
  }

  const monthlyStats: MonthlyFuelStat[] = Array.from(monthlyMap.entries()).map(([month, stat]) => ({
    month,
    totalCost: Math.round(stat.totalCost),
    totalLiters: Math.round(stat.totalLiters * 10) / 10,
    fillCount: stat.count,
  }));

  let avgConsumption = 4.8;
  if (logs.length >= 2) {
    const sorted = [...logs].sort((a, b) => (a.odometer_km || 0) - (b.odometer_km || 0));
    const firstKm = sorted[0].odometer_km;
    const lastKm = sorted[sorted.length - 1].odometer_km;
    if (firstKm && lastKm && lastKm > firstKm) {
      const deltaKm = lastKm - firstKm;
      avgConsumption = Math.round((totalLitersAll / deltaKm) * 100 * 10) / 10;
    }
  }

  return {
    logs,
    currentMonthCost: Math.round(currentMonthCost),
    currentMonthFillUps,
    totalLitersAllTime: Math.round(totalLitersAll * 10) / 10,
    totalCostAllTime: Math.round(totalCostAll),
    avgConsumptionL100Km: avgConsumption,
    monthlyStats,
    livePrices: getLiveFuelPrices(),
  };
}

export async function addFuelLog(
  userId: string,
  data: { 
    liters: number; 
    cost: number; 
    stationBrand?: string; 
    odometerKm?: number; 
    motorcycleId?: string 
  }
): Promise<FuelLogRow> {
  const { rows } = await pool.query<FuelLogRow>(
    `INSERT INTO fuel_logs (user_id, motorcycle_id, station_brand, liters, cost, odometer_km)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, user_id, motorcycle_id, station_brand, liters::float, cost::float, odometer_km::float, currency, created_at`,
    [
      userId, 
      data.motorcycleId || null, 
      data.stationBrand || 'Opet', 
      data.liters, 
      data.cost, 
      data.odometerKm || null
    ]
  );
  return rows[0];
}

export async function deleteFuelLog(userId: string, logId: string): Promise<boolean> {
  const { rowCount } = await pool.query(
    `DELETE FROM fuel_logs WHERE id = $1 AND user_id = $2`,
    [logId, userId]
  );
  return (rowCount ?? 0) > 0;
}
