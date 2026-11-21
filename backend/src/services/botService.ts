import { pool } from '../config/db';
import { v4 as uuidv4 } from 'uuid';
import { upsertLiveLocation, findNearbyRiders } from './locationService';
import { getConnectedRiderSocket } from '../sockets/connectedRiders';
import { NearbyRiderDTO } from '../sockets/types';

// Coordinates anchor (defaults to SF, updates to active user's location)
let anchorLat = 37.7749;
let anchorLng = -122.4194;

export function updateUserAnchor(lat: number, lng: number) {
  if (typeof lat === 'number' && typeof lng === 'number') {
    anchorLat = lat;
    anchorLng = lng;
  }
}

const BOTS = [
  { username: 'SpeedDemon', offset: 0 },
  { username: 'CanyonCarver', offset: Math.PI / 2 },
  { username: 'NightRider', offset: Math.PI },
  { username: 'ApexHunter', offset: (3 * Math.PI) / 2 },
];

let isSimulationRunning = false;
let simulationInterval: NodeJS.Timeout | null = null;
const botIds: string[] = [];

export function isBot(userId: string) {
  return botIds.includes(userId);
}

export async function simulateBotAcceptRendezvous(requestId: string, requesterId: string, recipientId: string) {
  if (!isBot(recipientId)) return;
  
  // Wait 1.2 seconds, simulating the bot reacting and pressing "Accept"
  setTimeout(async () => {
    try {
      const { updateRendezvousStatus } = await import('./rendezvousService');
      const request = await updateRendezvousStatus(requestId, 'ACCEPTED');
      if (!request) return;

      const requesterSocket = getConnectedRiderSocket(requesterId);
      if (requesterSocket) {
        requesterSocket.emit('rendezvous_status_changed', {
          id: request.id,
          status: 'ACCEPTED',
        });
      }

      // Send initial greeting into the newly opened chat channel
      if (request.chat_id) {
        const { sendMessage } = await import('./chatService');
        const msg = await sendMessage(
          request.chat_id, 
          recipientId, 
          "Hey! Request accepted. Ready to ride whenever you are 🏍️💨"
        );

        if (requesterSocket) {
          requesterSocket.emit('receive_message', {
            id: msg.id,
            chatId: msg.chat_id,
            senderId: msg.sender_id,
            senderName: msg.sender_name,
            body: msg.body,
            createdAt: msg.created_at,
          });
        }
      }
    } catch (err) {
      console.error('[BotService] Failed to simulate bot accepting ride request:', err);
    }
  }, 1200);
}

const BOT_REPLIES = [
  "Sounds awesome, let's hit the road! 🏍️💨",
  "Got it! Throttle on, I'm ready 🏁",
  "Catch you on the twists 🤙",
  "Roger that! Watch out for gravel in corners ✌️",
  "Let's roll! Full gear on 🏍️",
];

export async function simulateBotReply(chatId: string, recipientId: string, requesterId: string, incomingBody?: string) {
  if (!isBot(recipientId)) return;
  
  setTimeout(async () => {
    try {
      const { sendMessage } = await import('./chatService');
      const { pool } = await import('../config/db');

      let replyText = BOT_REPLIES[Math.floor(Math.random() * BOT_REPLIES.length)];

      // Check if user proposed "COME TO ME" or "I'M COMING TO YOU"
      const lower = (incomingBody || '').toLowerCase();
      const isComeToMe = lower.includes('come to my location') || lower.includes('come_to_me') || lower.includes('bana gel');
      const isComingToYou = lower.includes("coming to your location") || lower.includes('coming_to_you') || lower.includes('sana geliyorum');

      if (isComeToMe) {
        replyText = "Roger that! Gearing up and riding to your location now 🏍️💨";
        
        // Find active rendezvous for this chat and set bot as traveler
        const { rows } = await pool.query(
          'SELECT id FROM rendezvous_requests WHERE chat_id = $1 ORDER BY created_at DESC LIMIT 1',
          [chatId]
        );
        if (rows.length > 0) {
          const reqId = rows[0].id;
          const { setRendezvousTraveler } = await import('./rendezvousService');
          await setRendezvousTraveler(reqId, recipientId);

          const requesterSocket = getConnectedRiderSocket(requesterId);
          if (requesterSocket) {
            requesterSocket.emit('rendezvous_traveler_updated', {
              id: reqId,
              travelingUserId: recipientId,
            });
          }
        }
      } else if (isComingToYou) {
        replyText = "Awesome! I'll hold my position here. Ride safe and see you at the spot! 📍";
        
        // Find active rendezvous and set requester as traveler
        const { rows } = await pool.query(
          'SELECT id FROM rendezvous_requests WHERE chat_id = $1 ORDER BY created_at DESC LIMIT 1',
          [chatId]
        );
        if (rows.length > 0) {
          const reqId = rows[0].id;
          const { setRendezvousTraveler } = await import('./rendezvousService');
          await setRendezvousTraveler(reqId, requesterId);

          const requesterSocket = getConnectedRiderSocket(requesterId);
          if (requesterSocket) {
            requesterSocket.emit('rendezvous_traveler_updated', {
              id: reqId,
              travelingUserId: requesterId,
            });
          }
        }
      }

      const msg = await sendMessage(chatId, recipientId, replyText);
      
      const requesterSocket = getConnectedRiderSocket(requesterId);
      if (requesterSocket) {
        requesterSocket.emit('receive_message', {
          id: msg.id,
          chatId: msg.chat_id,
          senderId: msg.sender_id,
          senderName: msg.sender_name,
          body: msg.body,
          createdAt: msg.created_at,
        });
      }
    } catch (err) {
      console.error('[BotService] Failed to simulate bot reply:', err);
    }
  }, 1200);
}

async function ensureBotsExist() {
  for (const bot of BOTS) {
    const { rows } = await pool.query('SELECT id FROM users WHERE username = $1', [bot.username]);
    
    if (rows.length === 0) {
      const id = uuidv4();
      const email = `${bot.username.toLowerCase()}@motoradar.bot`;
      await pool.query(
        'INSERT INTO users (id, email, username, password_hash) VALUES ($1, $2, $3, $4)',
        [id, email, bot.username, 'bot_hash']
      );
      botIds.push(id);
    } else {
      botIds.push(rows[0].id);
    }
  }
}

export async function startBotSimulation() {
  if (isSimulationRunning) return;
  isSimulationRunning = true;

  try {
    await ensureBotsExist();
    console.log('[BotService] Spawned 4 Ghost Riders near San Francisco.');

    let tick = 0;

    simulationInterval = setInterval(async () => {
      tick += 0.05; // speed of orbit

      for (let i = 0; i < BOTS.length; i++) {
        const botId = botIds[i];
        const bot = BOTS[i];
        
        // Circular path: radius ~0.015 degrees (approx 1.5km) around active anchor
        const radius = 0.015;
        const currentLat = anchorLat + Math.sin(tick + bot.offset) * radius;
        const currentLng = anchorLng + Math.cos(tick + bot.offset) * radius;
        
        // Speed fluctuates
        const speed = 15 + Math.abs(Math.sin(tick)) * 20; // 15 to 35 m/s
        
        // Heading calculation (tangent to circle)
        const heading = (Math.atan2(Math.cos(tick + bot.offset), -Math.sin(tick + bot.offset)) * 180 / Math.PI + 360) % 360;

        try {
          await upsertLiveLocation({
            userId: botId,
            lat: currentLat,
            lng: currentLng,
            speed,
            heading,
            leanAngle: Math.sin(tick * 2) * 45, // simulate cornering
            isRiding: true,
          });

          // After updating bot location, push this update to any REAL nearby riders
          // This ensures the frontend gets updates even if the frontend isn't actively moving.
          const nearby = await findNearbyRiders(botId, currentLat, currentLng, 50);
          
          for (const neighbor of neighbor_array(nearby)) {
            // Ignore other bots
            if (botIds.includes(neighbor.user_id)) continue;

            const neighborSocket = getConnectedRiderSocket(neighbor.user_id);
            if (neighborSocket) {
              const neighborRows = await findNearbyRiders(neighbor.user_id, neighbor.lat, neighbor.lng, 50);
              
              const dtos: NearbyRiderDTO[] = neighborRows.map(r => ({
                userId: r.user_id,
                lat: r.lat,
                lng: r.lng,
                speed: r.current_speed,
                heading: r.heading_deg,
                isRiding: r.is_riding,
                distanceKm: Number(r.distance_km.toFixed(2)),
                updatedAt: r.updated_at,
                username: r.username,
              }));

              neighborSocket.emit('nearby_riders_update', dtos);
            }
          }
        } catch (err) {
          // suppress loop error logs
        }
      }
    }, 2000);
  } catch (err) {
    console.error('[BotService] Failed to start simulation:', err);
  }
}

function neighbor_array(nearby: any[]) {
  return nearby || [];
}
