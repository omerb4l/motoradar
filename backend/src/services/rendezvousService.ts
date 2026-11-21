import { pool } from '../config/db';

export interface CreateRendezvousInput {
  requesterId: string;
  recipientId: string;
  type: string;
  etaMinutes?: number;
}

export interface RendezvousRow {
  id: string;
  chat_id: string;
  requester_id: string;
  recipient_id: string;
  status: 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'CANCELLED' | 'COMPLETED';
  traveling_user_id: string | null;
  eta_minutes: number | null;
  created_at: string;
}

export async function createRendezvousRequest(input: CreateRendezvousInput): Promise<RendezvousRow> {
  console.log('[createRendezvousRequest] input:', input);
  if (!input.requesterId) {
    throw new Error('createRendezvousRequest: requesterId is null or empty');
  }
  // Create a chat for the rendezvous
  const { rows: chatRows } = await pool.query(
    'INSERT INTO chats (kind, created_by) VALUES ($1, $2) RETURNING id',
    ['DIRECT', input.requesterId]
  );
  const chatId = chatRows[0].id;

  // Add both users to the chat
  await pool.query(
    'INSERT INTO chat_participants (chat_id, user_id) VALUES ($1, $2), ($1, $3)',
    [chatId, input.requesterId, input.recipientId]
  );

  // Default to null so they negotiate it in chat
  const travelingUserId = input.type === 'COME_TO_ME' ? input.recipientId : 
                         input.type === 'I_WILL_COME_TO_YOU' ? input.requesterId : null;

  const { rows } = await pool.query<RendezvousRow>(
    `INSERT INTO rendezvous_requests 
       (chat_id, requester_id, recipient_id, traveling_user_id, eta_minutes)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [chatId, input.requesterId, input.recipientId, travelingUserId, input.etaMinutes || null]
  );
  
  return rows[0];
}

export async function updateRendezvousStatus(
  id: string, 
  status: 'ACCEPTED' | 'DECLINED' | 'CANCELLED' | 'COMPLETED'
): Promise<RendezvousRow | null> {
  const { rows } = await pool.query<RendezvousRow>(
    `UPDATE rendezvous_requests
     SET status = $1, responded_at = now()
     WHERE id = $2
     RETURNING *`,
    [status, id]
  );
  return rows[0] || null;
}

export async function getPendingRendezvousForUser(userId: string): Promise<RendezvousRow[]> {
  const { rows } = await pool.query<RendezvousRow>(
    `SELECT * FROM rendezvous_requests
     WHERE (recipient_id = $1 OR requester_id = $1)
       AND status = 'PENDING'
     ORDER BY created_at DESC`,
    [userId]
  );
  return rows;
}

export async function setRendezvousTraveler(id: string, travelingUserId: string): Promise<RendezvousRow | null> {
  const { rows } = await pool.query<RendezvousRow>(
    `UPDATE rendezvous_requests
     SET traveling_user_id = $1, responded_at = now()
     WHERE id = $2
     RETURNING *`,
    [travelingUserId, id]
  );
  return rows[0] || null;
}
