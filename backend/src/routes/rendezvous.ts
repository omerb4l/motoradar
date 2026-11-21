import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { getPendingRendezvousForUser } from '../services/rendezvousService';
import { pool } from '../config/db';

export const rendezvousRoutes = Router();

rendezvousRoutes.use(requireAuth);

rendezvousRoutes.get('/pending', async (req, res) => {
  const userId = req.userId!;
  try {
    const rows = await getPendingRendezvousForUser(userId);
    
    // We need usernames for the UI. In a real app we'd join, but mapping is fine here.
    const enriched = await Promise.all(
      rows.map(async (r) => {
        const { rows: reqUser } = await pool.query('SELECT username FROM users WHERE id = $1', [r.requester_id]);
        const { rows: recUser } = await pool.query('SELECT username FROM users WHERE id = $1', [r.recipient_id]);
        return {
          id: r.id,
          chatId: r.chat_id,
          requesterId: r.requester_id,
          requesterName: reqUser[0]?.username || 'Unknown',
          recipientId: r.recipient_id,
          recipientName: recUser[0]?.username || 'Unknown',
          travelingUserId: r.traveling_user_id,
          type: r.requester_id === r.traveling_user_id ? 'I_WILL_COME_TO_YOU' : 'COME_TO_ME',
          etaMinutes: r.eta_minutes,
          status: r.status,
        };
      })
    );

    res.json(enriched);
  } catch (err) {
    console.error('Failed to get pending rendezvous', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});
