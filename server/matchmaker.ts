/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { WebSocket } from 'ws';
import { MatchmakingQueueEntry, ServerMessage } from '../src/types/game.js';
import { GameRoom } from './gameRoom.js';

export interface MatchmakerClient {
  ws: WebSocket;
  id: string;
  nickname: string;
  rating: number;
  joinedAt: number;
}

export class Matchmaker {
  private queue: MatchmakerClient[] = [];
  private createRoomFn: (p1: MatchmakerClient, p2: MatchmakerClient) => GameRoom;

  constructor(createRoom: (p1: MatchmakerClient, p2: MatchmakerClient) => GameRoom) {
    this.createRoomFn = createRoom;
    // Periodic queue processor and status broadcaster
    setInterval(() => {
      this.processQueue();
      this.broadcastQueueStatus();
    }, 1000);
  }

  public enqueue(ws: WebSocket, id: string, nickname: string, rating: number = 1000) {
    // Remove any existing entry for this client id
    this.dequeue(id);

    const client: MatchmakerClient = {
      ws,
      id,
      nickname: nickname || `Player_${id.slice(0, 4)}`,
      rating,
      joinedAt: Date.now(),
    };

    this.queue.push(client);
    this.sendQueueStatus(client, this.queue.length);
    this.processQueue();
  }

  public dequeue(id: string) {
    this.queue = this.queue.filter((c) => c.id !== id);
  }

  public getQueueLength(): number {
    return this.queue.length;
  }

  private processQueue() {
    // Pair players as soon as 2 or more are ready
    while (this.queue.length >= 2) {
      const p1 = this.queue.shift()!;
      const p2 = this.queue.shift()!;

      // Verify both websockets are still open
      if (p1.ws.readyState !== WebSocket.OPEN) {
        if (p2.ws.readyState === WebSocket.OPEN) {
          this.queue.unshift(p2);
        }
        continue;
      }
      if (p2.ws.readyState !== WebSocket.OPEN) {
        if (p1.ws.readyState === WebSocket.OPEN) {
          this.queue.unshift(p1);
        }
        continue;
      }

      // Create dedicated game room and assign slots
      const room = this.createRoomFn(p1, p2);

      // Notify P1
      const msgP1: ServerMessage = {
        type: 'matchmaking:matched',
        roomId: room.id,
        role: 'p1',
        opponentName: p2.nickname,
      };
      p1.ws.send(JSON.stringify(msgP1));

      // Notify P2
      const msgP2: ServerMessage = {
        type: 'matchmaking:matched',
        roomId: room.id,
        role: 'p2',
        opponentName: p1.nickname,
      };
      p2.ws.send(JSON.stringify(msgP2));
    }
  }

  private broadcastQueueStatus() {
    this.queue.forEach((client, index) => {
      this.sendQueueStatus(client, index + 1);
    });
  }

  private sendQueueStatus(client: MatchmakerClient, position: number) {
    if (client.ws.readyState === WebSocket.OPEN) {
      const statusMsg: ServerMessage = {
        type: 'matchmaking:status',
        inQueue: true,
        position,
        totalInQueue: this.queue.length,
      };
      client.ws.send(JSON.stringify(statusMsg));
    }
  }
}
