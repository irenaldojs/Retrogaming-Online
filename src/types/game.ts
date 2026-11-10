/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface GameState {
  p1_y: number;
  p2_y: number;
  ball_x: number;
  ball_y: number;
  ball_vx: number;
  ball_vy: number;
  score_p1: number;
  score_p2: number;
  status: 'waiting' | 'countdown' | 'playing' | 'paused' | 'finished';
  countdown?: number;
  winner?: 'p1' | 'p2' | null;
  lastHitBy?: 'p1' | 'p2' | null;
  rallyCount: number;
  maxScore: number;
}

export type PlayerRole = 'p1' | 'p2' | 'spectator';

export interface RoomInfo {
  id: string;
  name: string;
  p1Name: string;
  p2Name: string;
  p1Connected: boolean;
  p2Connected: boolean;
  spectatorCount: number;
  state: GameState;
  isPrivate: boolean;
  createdAt: number;
  challengerQueue: string[];
}

export interface RoomSummary {
  id: string;
  name: string;
  p1Name: string;
  p2Name: string;
  status: GameState['status'];
  score_p1: number;
  score_p2: number;
  spectators: number;
  isPrivate: boolean;
}

export interface MatchmakingQueueEntry {
  clientId: string;
  nickname: string;
  joinedAt: number;
  skillRating: number;
}

export interface ServerStats {
  activeRooms: number;
  connectedClients: number;
  totalMatchesPlayed: number;
  serverUptimeSeconds: number;
  tickRateHz: number;
  avgTickDurationMs: number;
  memoryUsageMb: number;
}

export interface ChatMessage {
  id: string;
  from: string;
  role: PlayerRole;
  text: string;
  timestamp: number;
}

export type GameEvent =
  | { type: 'paddle_hit'; player: 'p1' | 'p2'; x: number; y: number; speed: number }
  | { type: 'wall_hit'; x: number; y: number }
  | { type: 'goal'; player: 'p1' | 'p2'; score_p1: number; score_p2: number }
  | { type: 'game_over'; winner: 'p1' | 'p2'; final_p1: number; final_p2: number }
  | { type: 'countdown_tick'; count: number };

// Network Protocol Types
export type ClientMessage =
  | { type: 'Input'; dir: number; clientTick?: number }
  | { type: 'matchmaking:join'; nickname: string; rating?: number }
  | { type: 'matchmaking:leave' }
  | { type: 'room:create'; name: string; maxScore?: number; isPrivate?: boolean; nickname: string }
  | { type: 'room:join'; roomId: string; nickname: string; asSpectator?: boolean }
  | { type: 'room:leave'; roomId: string }
  | { type: 'room:list_req' }
  | { type: 'ping'; timestamp: number }
  | { type: 'chat:send'; roomId: string; text: string }
  | { type: 'reaction:send'; roomId: string; emoji: string }
  | { type: 'challenge:queue'; roomId: string; nickname: string }
  | { type: 'game:restart'; roomId: string };

export type ServerMessage =
  | { type: 'connected'; clientId: string }
  | { type: 'matchmaking:status'; inQueue: boolean; position: number; totalInQueue: number }
  | { type: 'matchmaking:matched'; roomId: string; role: 'p1' | 'p2'; opponentName: string }
  | {
      type: 'room:joined';
      roomId: string;
      roomName: string;
      role: PlayerRole;
      p1Name: string;
      p2Name: string;
      spectatorCount: number;
      state: GameState;
      challengerQueue: string[];
    }
  | { type: 'room:list'; rooms: RoomSummary[] }
  | { type: 'room:player_joined'; role: PlayerRole; name: string; spectatorCount: number }
  | { type: 'room:player_left'; role: PlayerRole; name: string; spectatorCount: number }
  | { type: 'game:tick'; state: GameState; tick: number }
  | { type: 'game:event'; event: GameEvent }
  | { type: 'pong'; clientTimestamp: number; serverTimestamp: number }
  | { type: 'chat:message'; message: ChatMessage }
  | { type: 'reaction:broadcast'; emoji: string; from: string }
  | { type: 'server:stats'; stats: ServerStats }
  | { type: 'error'; message: string };
