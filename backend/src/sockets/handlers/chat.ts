import { Server, Socket } from 'socket.io';
import { z } from 'zod';
import { sendMessage } from '../../services/chatService';
import { getConnectedRiderSocket } from '../connectedRiders';
import { ClientToServerEvents, ServerToClientEvents } from '../types';
import { pool } from '../../config/db';
import { simulateBotReply } from '../../services/botService';

const messageSchema = z.object({
  chatId: z.string().uuid(),
  body: z.string().min(1),
});

type AppSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

export function registerChatHandlers(io: Server, socket: AppSocket, userId: string) {
  socket.on('send_message', async (payload) => {
    const parsed = messageSchema.safeParse(payload);
    if (!parsed.success) {
      socket.emit('error', { message: 'Invalid message payload' });
      return;
    }

    try {
      // 1. Verify user is in chat
      const { rows: pRows } = await pool.query(
        'SELECT user_id FROM chat_participants WHERE chat_id = $1',
        [parsed.data.chatId]
      );
      if (!pRows.some(r => r.user_id === userId)) {
        socket.emit('error', { message: 'Not a participant' });
        return;
      }

      // 2. Save message
      const msg = await sendMessage(parsed.data.chatId, userId, parsed.data.body);

      // 3. Send to all participants including sender
      for (const pId of pRows.map((r) => r.user_id)) {
        const pSocket = getConnectedRiderSocket(pId);
        if (pSocket) {
          pSocket.emit('receive_message', {
            id: msg.id,
            chatId: msg.chat_id,
            senderId: msg.sender_id,
            senderName: msg.sender_name,
            body: msg.body,
            createdAt: msg.created_at,
          });
        }
        
        // Simüle edilmiş bir bota gönderiyorsak, bot akıllıca cevap versin
        if (pId !== userId) {
          simulateBotReply(msg.chat_id, pId, userId, msg.body);
        }
      }
    } catch (err) {
      console.error('Failed to send message', err);
      socket.emit('error', { message: 'Failed to send message' });
    }
  });
}
