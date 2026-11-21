import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { getChatsForUser, getMessagesForChat } from '../services/chatService';
import { pool } from '../config/db';

export const chatRoutes = Router();
chatRoutes.use(requireAuth);

chatRoutes.get('/', async (req, res) => {
  const userId = req.userId!;
  try {
    const chats = await getChatsForUser(userId);
    res.json(chats);
  } catch (err) {
    console.error('Failed to get chats', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

chatRoutes.get('/:id/messages', async (req, res) => {
  const userId = req.userId!;
  const chatId = req.params.id;
  try {
    // Verify user is in chat
    const { rows: pRows } = await pool.query(
      'SELECT 1 FROM chat_participants WHERE chat_id = $1 AND user_id = $2',
      [chatId, userId]
    );
    if (pRows.length === 0) {
      res.status(403).json({ message: 'Not a participant' });
      return;
    }

    const messages = await getMessagesForChat(chatId);
    res.json(messages);
  } catch (err) {
    console.error('Failed to get messages', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});
