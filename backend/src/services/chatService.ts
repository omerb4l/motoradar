import { pool } from '../config/db';

export interface ChatRow {
  id: string;
  kind: 'DIRECT' | 'GROUP';
  name: string | null;
  created_at: string;
  partner_id?: string;
  partner_name?: string;
  last_message?: string;
  last_message_at?: string;
  unread_count?: number;
}

export interface ChatMessageRow {
  id: string;
  chat_id: string;
  sender_id: string;
  sender_name?: string;
  body: string;
  created_at: string;
}

export async function getChatsForUser(userId: string): Promise<ChatRow[]> {
  const query = `
    WITH latest_message AS (
      SELECT DISTINCT ON (chat_id) chat_id, body, created_at
      FROM chat_messages
      ORDER BY chat_id, created_at DESC
    )
    SELECT 
      c.id, c.kind, c.name, c.created_at,
      p2.user_id as partner_id,
      u2.username as partner_name,
      lm.body as last_message,
      lm.created_at as last_message_at
    FROM chats c
    JOIN chat_participants p1 ON p1.chat_id = c.id AND p1.user_id = $1
    -- For DIRECT chats, get the other participant
    LEFT JOIN chat_participants p2 ON p2.chat_id = c.id AND p2.user_id != $1
    LEFT JOIN users u2 ON u2.id = p2.user_id
    LEFT JOIN latest_message lm ON lm.chat_id = c.id
    ORDER BY COALESCE(lm.created_at, c.created_at) DESC
  `;
  
  const { rows } = await pool.query<ChatRow>(query, [userId]);
  return rows;
}

export async function getMessagesForChat(chatId: string): Promise<ChatMessageRow[]> {
  const query = `
    SELECT m.id, m.chat_id, m.sender_id, m.body, m.created_at, u.username as sender_name
    FROM chat_messages m
    JOIN users u ON u.id = m.sender_id
    WHERE m.chat_id = $1
    ORDER BY m.created_at ASC
  `;
  const { rows } = await pool.query<ChatMessageRow>(query, [chatId]);
  return rows;
}

export async function sendMessage(chatId: string, senderId: string, body: string): Promise<ChatMessageRow> {
  const query = `
    INSERT INTO chat_messages (chat_id, sender_id, body)
    VALUES ($1, $2, $3)
    RETURNING *
  `;
  const { rows } = await pool.query<ChatMessageRow>(query, [chatId, senderId, body]);
  
  // Fetch sender name
  const { rows: u } = await pool.query('SELECT username FROM users WHERE id = $1', [senderId]);
  
  return {
    ...rows[0],
    sender_name: u[0]?.username
  };
}
