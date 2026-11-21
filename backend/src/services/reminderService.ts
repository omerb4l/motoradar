import { pool } from '../config/db';

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

export interface CreateReminderInput {
  motorcycleId?: string | null;
  type: ReminderType;
  title?: string;
  lastCompletedDate: string; // YYYY-MM-DD
  validityMonths?: number; // 24 for TÜVTÜRK, 12 for Insurance
  notes?: string | null;
}

function calculateStatusAndDays(expiryDateStr: string): { daysRemaining: number; status: ReminderStatus } {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const expiry = new Date(expiryDateStr);
  expiry.setHours(0, 0, 0, 0);

  const diffTime = expiry.getTime() - today.getTime();
  const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  let status: ReminderStatus = 'SAFE';
  if (daysRemaining < 0) {
    status = 'EXPIRED';
  } else if (daysRemaining <= 1) {
    status = 'WARNING_1D';
  } else if (daysRemaining <= 3) {
    status = 'WARNING_3D';
  } else if (daysRemaining <= 7) {
    status = 'WARNING_7D';
  } else if (daysRemaining <= 30) {
    status = 'WARNING_30D';
  } else {
    status = 'SAFE';
  }

  return { daysRemaining, status };
}

export async function getUserReminders(userId: string): Promise<VehicleReminder[]> {
  const { rows } = await pool.query(
    `SELECT 
       r.id,
       r.user_id,
       r.motorcycle_id,
       r.type,
       r.title,
       to_char(r.last_completed_date, 'YYYY-MM-DD') as last_completed_date,
       r.validity_months,
       to_char(r.expiry_date, 'YYYY-MM-DD') as expiry_date,
       r.notes,
       r.is_active,
       r.created_at,
       m.brand,
       m.model
     FROM vehicle_reminders r
     LEFT JOIN motorcycles m ON r.motorcycle_id = m.id
     WHERE r.user_id = $1 AND r.is_active = TRUE
     ORDER BY r.expiry_date ASC`,
    [userId]
  );

  return rows.map((row) => {
    const { daysRemaining, status } = calculateStatusAndDays(row.expiry_date);
    const motorcycleName = row.brand && row.model ? `${row.brand} ${row.model}` : undefined;

    return {
      id: row.id,
      userId: row.user_id,
      motorcycleId: row.motorcycle_id,
      motorcycleName,
      type: row.type as ReminderType,
      title: row.title,
      lastCompletedDate: row.last_completed_date,
      validityMonths: row.validity_months,
      expiryDate: row.expiry_date,
      daysRemaining,
      status,
      notes: row.notes,
      isActive: row.is_active,
      createdAt: row.created_at,
    };
  });
}

export async function createReminder(userId: string, input: CreateReminderInput): Promise<VehicleReminder> {
  // Determine standard validity months according to Turkish regulations if not specified
  let months = input.validityMonths;
  let defaultTitle = input.title;

  if (input.type === 'TUVTURK_INSPECTION') {
    months = months || 24; // 2 Years for motorcycles in Turkey
    defaultTitle = defaultTitle || 'TÜVTÜRK Vehicle Inspection';
  } else if (input.type === 'TRAFFIC_INSURANCE') {
    months = months || 12; // 1 Year standard policy
    defaultTitle = defaultTitle || 'Mandatory Traffic Insurance';
  } else if (input.type === 'KASKO') {
    months = months || 12;
    defaultTitle = defaultTitle || 'Comprehensive Motorcycle Casco';
  } else {
    months = months || 6;
    defaultTitle = defaultTitle || 'Periodic Service & Chain Care';
  }

  // Calculate expiry date: lastCompletedDate + validity_months
  const lastDate = new Date(input.lastCompletedDate);
  const expiryDate = new Date(lastDate);
  expiryDate.setMonth(expiryDate.getMonth() + months);

  const expiryDateStr = expiryDate.toISOString().split('T')[0];

  const { rows } = await pool.query(
    `INSERT INTO vehicle_reminders (
       user_id,
       motorcycle_id,
       type,
       title,
       last_completed_date,
       validity_months,
       expiry_date,
       notes
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING 
       id,
       user_id,
       motorcycle_id,
       type,
       title,
       to_char(last_completed_date, 'YYYY-MM-DD') as last_completed_date,
       validity_months,
       to_char(expiry_date, 'YYYY-MM-DD') as expiry_date,
       notes,
       is_active,
       created_at`,
    [
      userId,
      input.motorcycleId || null,
      input.type,
      defaultTitle,
      input.lastCompletedDate,
      months,
      expiryDateStr,
      input.notes || null,
    ]
  );

  const row = rows[0];
  const { daysRemaining, status } = calculateStatusAndDays(row.expiry_date);

  return {
    id: row.id,
    userId: row.user_id,
    motorcycleId: row.motorcycle_id,
    type: row.type as ReminderType,
    title: row.title,
    lastCompletedDate: row.last_completed_date,
    validityMonths: row.validity_months,
    expiryDate: row.expiry_date,
    daysRemaining,
    status,
    notes: row.notes,
    isActive: row.is_active,
    createdAt: row.created_at,
  };
}

export async function renewReminder(
  userId: string,
  reminderId: string,
  newLastDateStr?: string
): Promise<VehicleReminder | null> {
  const { rows: existing } = await pool.query(
    `SELECT * FROM vehicle_reminders WHERE id = $1 AND user_id = $2`,
    [reminderId, userId]
  );

  if (!existing || existing.length === 0) {
    return null;
  }

  const current = existing[0];
  const lastDate = newLastDateStr ? new Date(newLastDateStr) : new Date();
  const expiryDate = new Date(lastDate);
  expiryDate.setMonth(expiryDate.getMonth() + current.validity_months);

  const lastDateFormatted = lastDate.toISOString().split('T')[0];
  const expiryDateStr = expiryDate.toISOString().split('T')[0];

  const { rows } = await pool.query(
    `UPDATE vehicle_reminders
     SET last_completed_date = $1,
         expiry_date = $2,
         updated_at = now()
     WHERE id = $3 AND user_id = $4
     RETURNING 
       id,
       user_id,
       motorcycle_id,
       type,
       title,
       to_char(last_completed_date, 'YYYY-MM-DD') as last_completed_date,
       validity_months,
       to_char(expiry_date, 'YYYY-MM-DD') as expiry_date,
       notes,
       is_active,
       created_at`,
    [lastDateFormatted, expiryDateStr, reminderId, userId]
  );

  if (rows.length === 0) return null;
  const row = rows[0];
  const { daysRemaining, status } = calculateStatusAndDays(row.expiry_date);

  return {
    id: row.id,
    userId: row.user_id,
    motorcycleId: row.motorcycle_id,
    type: row.type as ReminderType,
    title: row.title,
    lastCompletedDate: row.last_completed_date,
    validityMonths: row.validity_months,
    expiryDate: row.expiry_date,
    daysRemaining,
    status,
    notes: row.notes,
    isActive: row.is_active,
    createdAt: row.created_at,
  };
}

export async function deleteReminder(userId: string, reminderId: string): Promise<boolean> {
  const result = await pool.query(
    `DELETE FROM vehicle_reminders WHERE id = $1 AND user_id = $2`,
    [reminderId, userId]
  );
  return (result.rowCount ?? 0) > 0;
}
