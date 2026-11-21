import { pool } from '../config/db';

export interface CreateReportInput {
  reporterId: string;
  reportedId: string;
  rendezvousId?: string;
  reason: string;
  details?: string;
}

export async function createReport(input: CreateReportInput) {
  const { rows } = await pool.query(
    `INSERT INTO user_reports 
       (reporter_id, reported_id, rendezvous_id, reason, details)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [input.reporterId, input.reportedId, input.rendezvousId || null, input.reason, input.details || null]
  );
  
  return rows[0];
}
