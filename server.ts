/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GameRoom } from './server/gameRoom.js';
import { Matchmaker } from './server/matchmaker.js';
import { ClientMessage, ServerMessage, RoomSummary, ServerStats, PlayerRole } from './src/types/game.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const isProd = process.env.NODE_ENV === 'production';
const PORT = process.env.PORT || 3000;

const app = express();
app.use(express.json());

const server = createServer(app);
const wss = new WebSocketServer({ server });

// Server State Management
const rooms = new Map<string, GameRoom>();
const clientToRoom = new Map<string, string>(); // clientId -> roomId
const connectedClients = new Map<string, { ws: WebSocket; name: string }>();
let totalMatchesPlayed = 0;
const serverStartTime = Date.now();

// Helper to get room summaries
function getRoomSummaries(): RoomSummary[] {
  const list: RoomSummary[] = [];
  for (const room of rooms.values()) {
    list.push({
      id: room.id,
      name: room.name,
      p1Name: room.p1?.name || 'Aguardando...',
      p2Name: room.p2?.name || 'Aguardando...',
      status: room.state.status,
      score_p1: room.state.score_p1,
      score_p2: room.state.score_p2,
      spectators: room.spectators.size,
      isPrivate: room.isPrivate,
    });
  }
  return list;
}

// Helper to create a room
function createRoom(
  id: string,
  name: string,
  maxScore: number = 5,
  isPrivate: boolean = false
): GameRoom {
  const room = new GameRoom(id, name, maxScore, isPrivate, (emptyRoomId) => {
    // Only delete dynamic rooms when empty; keep 'global-arena' alive
    if (emptyRoomId !== 'global-arena') {
      rooms.delete(emptyRoomId);
      broadcastRoomList();
    }
  });

  room.setGameOverCallback(() => {
    totalMatchesPlayed++;
  });

  rooms.set(id, room);
  broadcastRoomList();
  return room;
}

// Matchmaker setup
const matchmaker = new Matchmaker((p1Client, p2Client) => {
  const roomId = `match_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const roomName = `Duelo ${p1Client.nickname} vs ${p2Client.nickname}`;
  const room = createRoom(roomId, roomName, 5, false);

  // Add P1 and P2 to room
  room.addClient(p1Client.ws, p1Client.id, p1Client.nickname, 'p1');
  clientToRoom.set(p1Client.id, room.id);

  room.addClient(p2Client.ws, p2Client.id, p2Client.nickname, 'p2');
  clientToRoom.set(p2Client.id, room.id);

  // Send room joined message to both
  const p1Msg: ServerMessage = {
    type: 'room:joined',
    roomId: room.id,
    roomName: room.name,
    role: 'p1',
    p1Name: p1Client.nickname,
    p2Name: p2Client.nickname,
    spectatorCount: 0,
    state: room.state,
    challengerQueue: [],
  };
  p1Client.ws.send(JSON.stringify(p1Msg));

  const p2Msg: ServerMessage = {
    type: 'room:joined',
    roomId: room.id,
    roomName: room.name,
    role: 'p2',
    p1Name: p1Client.nickname,
    p2Name: p2Client.nickname,
    spectatorCount: 0,
    state: room.state,
    challengerQueue: [],
  };
  p2Client.ws.send(JSON.stringify(p2Msg));

  return room;
});

// Create default lobby room
createRoom('global-arena', 'Retro Arena #01 (Oficial)', 5, false);

function broadcastRoomList() {
  const listMsg: ServerMessage = {
    type: 'room:list',
    rooms: getRoomSummaries(),
  };
  const raw = JSON.stringify(listMsg);
  for (const client of connectedClients.values()) {
    if (client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(raw);
    }
  }
}

function broadcastServerStats() {
  const stats: ServerStats = {
    activeRooms: rooms.size,
    connectedClients: connectedClients.size,
    totalMatchesPlayed,
    serverUptimeSeconds: Math.floor((Date.now() - serverStartTime) / 1000),
    tickRateHz: 30.0,
    avgTickDurationMs: 0.5,
    memoryUsageMb: Math.round((process.memoryUsage().heapUsed / 1024 / 1024) * 10) / 10,
  };

  const raw = JSON.stringify({ type: 'server:stats', stats });
  for (const client of connectedClients.values()) {
    if (client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(raw);
    }
  }
}

// Periodic server telemetry broadcast every 3s
setInterval(broadcastServerStats, 3000);

// WebSocket connection handling
wss.on('connection', (ws: WebSocket) => {
  const clientId = `client_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  connectedClients.set(clientId, { ws, name: 'Anônimo' });

  // Welcome client
  ws.send(JSON.stringify({ type: 'connected', clientId }));
  ws.send(JSON.stringify({ type: 'room:list', rooms: getRoomSummaries() }));

  ws.on('message', (data: string) => {
    try {
      const msg: ClientMessage = JSON.parse(data.toString());

      switch (msg.type) {
        case 'ping': {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(
              JSON.stringify({
                type: 'pong',
                clientTimestamp: msg.timestamp,
                serverTimestamp: Date.now(),
              })
            );
          }
          break;
        }

        case 'matchmaking:join': {
          connectedClients.get(clientId)!.name = msg.nickname;
          matchmaker.enqueue(ws, clientId, msg.nickname, msg.rating || 1000);
          break;
        }

        case 'matchmaking:leave': {
          matchmaker.dequeue(clientId);
          ws.send(
            JSON.stringify({
              type: 'matchmaking:status',
              inQueue: false,
              position: 0,
              totalInQueue: matchmaker.getQueueLength(),
            })
          );
          break;
        }

        case 'room:create': {
          const roomId = `room_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
          const room = createRoom(roomId, msg.name || 'Nova Sala', msg.maxScore || 5, msg.isPrivate);
          connectedClients.get(clientId)!.name = msg.nickname;

          const role = room.addClient(ws, clientId, msg.nickname, 'p1');
          clientToRoom.set(clientId, room.id);

          ws.send(
            JSON.stringify({
              type: 'room:joined',
              roomId: room.id,
              roomName: room.name,
              role,
              p1Name: room.p1?.name || '',
              p2Name: room.p2?.name || '',
              spectatorCount: room.spectators.size,
              state: room.state,
              challengerQueue: room.challengerQueue.map((c) => c.name),
            })
          );
          broadcastRoomList();
          break;
        }

        case 'room:join': {
          const room = rooms.get(msg.roomId);
          if (!room) {
            ws.send(JSON.stringify({ type: 'error', message: 'Sala não encontrada.' }));
            return;
          }

          // Leave current room if any
          const oldRoomId = clientToRoom.get(clientId);
          if (oldRoomId && rooms.has(oldRoomId)) {
            rooms.get(oldRoomId)!.removeClient(clientId);
          }

          connectedClients.get(clientId)!.name = msg.nickname;
          const role = room.addClient(
            ws,
            clientId,
            msg.nickname,
            msg.asSpectator ? 'spectator' : undefined
          );
          clientToRoom.set(clientId, room.id);

          ws.send(
            JSON.stringify({
              type: 'room:joined',
              roomId: room.id,
              roomName: room.name,
              role,
              p1Name: room.p1?.name || '',
              p2Name: room.p2?.name || '',
              spectatorCount: room.spectators.size,
              state: room.state,
              challengerQueue: room.challengerQueue.map((c) => c.name),
            })
          );
          broadcastRoomList();
          break;
        }

        case 'room:leave': {
          const roomId = msg.roomId || clientToRoom.get(clientId);
          if (roomId && rooms.has(roomId)) {
            rooms.get(roomId)!.removeClient(clientId);
            clientToRoom.delete(clientId);
            broadcastRoomList();
          }
          break;
        }

        case 'room:list_req': {
          ws.send(JSON.stringify({ type: 'room:list', rooms: getRoomSummaries() }));
          break;
        }

        case 'Input': {
          const roomId = clientToRoom.get(clientId);
          if (roomId) {
            const room = rooms.get(roomId);
            if (room) {
              room.handleInput(clientId, msg.dir);
            }
          }
          break;
        }

        case 'chat:send': {
          const roomId = msg.roomId || clientToRoom.get(clientId);
          if (roomId) {
            const room = rooms.get(roomId);
            if (room) {
              const clientInfo = connectedClients.get(clientId);
              const senderName = clientInfo?.name || 'Jogador';
              let role: PlayerRole = 'spectator';
              if (room.p1?.id === clientId) role = 'p1';
              if (room.p2?.id === clientId) role = 'p2';
              room.broadcastChat(senderName, role, msg.text);
            }
          }
          break;
        }

        case 'reaction:send': {
          const roomId = msg.roomId || clientToRoom.get(clientId);
          if (roomId) {
            const room = rooms.get(roomId);
            if (room) {
              const clientInfo = connectedClients.get(clientId);
              const senderName = clientInfo?.name || 'Espectador';
              room.broadcast({
                type: 'reaction:broadcast',
                emoji: msg.emoji,
                from: senderName,
              });
            }
          }
          break;
        }

        case 'challenge:queue': {
          const roomId = msg.roomId || clientToRoom.get(clientId);
          if (roomId) {
            const room = rooms.get(roomId);
            if (room) {
              const queued = room.queueChallenger(clientId, msg.nickname);
              if (queued) {
                room.broadcast({
                  type: 'room:player_joined',
                  role: 'spectator',
                  name: `${msg.nickname} (Fila de Desafio)`,
                  spectatorCount: room.spectators.size,
                });
              }
            }
          }
          break;
        }

        case 'game:restart': {
          const roomId = msg.roomId || clientToRoom.get(clientId);
          if (roomId) {
            const room = rooms.get(roomId);
            if (room && (room.p1?.id === clientId || room.p2?.id === clientId)) {
              room.restartGame();
            }
          }
          break;
        }
      }
    } catch (err) {
      console.error('Error parsing client message:', err);
    }
  });

  ws.on('close', () => {
    matchmaker.dequeue(clientId);
    const roomId = clientToRoom.get(clientId);
    if (roomId && rooms.has(roomId)) {
      rooms.get(roomId)!.removeClient(clientId);
      clientToRoom.delete(clientId);
      broadcastRoomList();
    }
    connectedClients.delete(clientId);
  });
});

// REST API Endpoints
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'online',
    uptimeSeconds: Math.floor((Date.now() - serverStartTime) / 1000),
    version: '1.0.0-state-sync',
    authoritativeHz: 30,
    fpsLock: 30,
  });
});

app.get('/api/stats', (_req, res) => {
  res.json({
    activeRooms: rooms.size,
    connectedClients: connectedClients.size,
    queueLength: matchmaker.getQueueLength(),
    totalMatchesPlayed,
    serverUptimeSeconds: Math.floor((Date.now() - serverStartTime) / 1000),
    tickRate: 30,
    fpsLock: 30,
  });
});

app.get('/api/rooms', (_req, res) => {
  res.json(getRoomSummaries());
});

app.get('/api/download-repo', (_req, res) => {
  const filePath = path.resolve(__dirname, 'public', 'retrogaming-hub.tar.gz');
  res.download(filePath, 'retrogaming-hub.tar.gz');
});

// Mounting Vite or Static files
async function startServer() {
  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  server.listen(PORT, () => {
    console.log(`🎮 RetroGaming Dedicated Server rodando na porta ${PORT}`);
    console.log(`⚡ WebSocket Server ativo em ws://0.0.0.0:${PORT} (30Hz / 30 FPS Lock)`);
  });
}

startServer();
