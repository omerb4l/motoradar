import { pool } from '../config/db';

export interface SOSAlertRow {
  id: string;
  user_id: string;
  alert_type: 'AUTO_CRASH' | 'MANUAL';
  status: 'ACTIVE' | 'FALSE_ALARM' | 'RESOLVED' | 'CANCELLED';
  lat: number;
  lng: number;
  created_at: string;
}

export async function insertSosAlert(
  userId: string,
  alertType: 'AUTO_CRASH' | 'MANUAL',
  lat: number,
  lng: number
): Promise<SOSAlertRow> {
  const { rows } = await pool.query<SOSAlertRow>(
    `INSERT INTO sos_alerts
       (user_id, alert_type, status, origin_point, created_at)
     VALUES
       ($1, $2, 'ACTIVE', ST_SetSRID(ST_MakePoint($3, $4), 4326)::geography, now())
     RETURNING 
       id, 
       user_id, 
       alert_type, 
       status, 
       ST_Y(origin_point::geometry) AS lat, 
       ST_X(origin_point::geometry) AS lng, 
       created_at`,
    [userId, alertType, lng, lat]
  );
  return rows[0];
}

export async function cancelSosAlert(alertId: string, userId: string): Promise<void> {
  await pool.query(
    `UPDATE sos_alerts
     SET status = 'CANCELLED', resolved_at = now()
     WHERE id = $1 AND user_id = $2 AND status = 'ACTIVE'`,
    [alertId, userId]
  );
}
