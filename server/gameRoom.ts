/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { WebSocket } from 'ws';
import { GameState, GameEvent, PlayerRole, ServerMessage, ChatMessage } from '../src/types/game.js';
import gameConfig from '../game-config.json';

export interface RoomClient {
  ws: WebSocket;
  id: string;
  name: string;
  role: PlayerRole;
  currentInput: number; // -1, 0, 1
  lastPing: number;
}

export class GameRoom {
  public id: string;
  public name: string;
  public maxScore: number;
  public isPrivate: boolean;
  public createdAt: number;

  public p1: RoomClient | null = null;
  public p2: RoomClient | null = null;
  public spectators: Map<string, RoomClient> = new Map();
  public challengerQueue: Array<{ id: string; name: string }> = [];

  public state: GameState;
  public tickNumber: number = 0;
  private intervalHandle: NodeJS.Timeout | null = null;
  private countdownHandle: NodeJS.Timeout | null = null;
  private onEmptyCallback: (roomId: string) => void;
  private onGameOverCallback?: (winner: 'p1' | 'p2', room: GameRoom) => void;

  public static readonly WIDTH = gameConfig.width;
  public static readonly HEIGHT = gameConfig.height;
  public static readonly PADDLE_HEIGHT = gameConfig.paddleHeight;
  public static readonly PADDLE_WIDTH = gameConfig.paddleWidth;
  public static readonly P1_X = gameConfig.p1X;
  public static readonly P2_X = gameConfig.p2X;
  public static readonly BALL_SIZE = gameConfig.ballSize;
  public static readonly INITIAL_SPEED_X = gameConfig.initialSpeedX;
  public static readonly INITIAL_SPEED_Y = gameConfig.initialSpeedY;
  public static readonly MAX_BALL_SPEED = gameConfig.maxBallSpeed;
  public static readonly PADDLE_SPEED = gameConfig.paddleSpeed;
  public static readonly PADDLE_SPIN = gameConfig.paddleSpin;
  public static readonly BOUNCE_ANGLE = gameConfig.bounceAngle;
  public static readonly SPEED_INCREASE = gameConfig.speedIncrease;
  public static readonly RESET_SPEED_Y_MIN = gameConfig.resetSpeedYMin;
  public static readonly RESET_SPEED_Y_MAX = gameConfig.resetSpeedYMax;

  constructor(
    id: string,
    name: string,
    maxScore: number = 5,
    isPrivate: boolean = false,
    onEmpty: (roomId: string) => void
  ) {
    this.id = id;
    this.name = name;
    this.maxScore = maxScore;
    this.isPrivate = isPrivate;
    this.createdAt = Date.now();
    this.onEmptyCallback = onEmpty;

    this.state = {
      p1_y: (GameRoom.HEIGHT - GameRoom.PADDLE_HEIGHT) / 2,
      p2_y: (GameRoom.HEIGHT - GameRoom.PADDLE_HEIGHT) / 2,
      ball_x: GameRoom.WIDTH / 2,
      ball_y: GameRoom.HEIGHT / 2,
      ball_vx: GameRoom.INITIAL_SPEED_X,
      ball_vy: GameRoom.INITIAL_SPEED_Y,
      score_p1: 0,
      score_p2: 0,
      status: 'waiting',
      countdown: undefined,
      winner: null,
      lastHitBy: null,
      rallyCount: 0,
      maxScore: this.maxScore,
    };
  }

  public setGameOverCallback(cb: (winner: 'p1' | 'p2', room: GameRoom) => void) {
    this.onGameOverCallback = cb;
  }

  public addClient(ws: WebSocket, id: string, name: string, preferredRole?: PlayerRole): PlayerRole {
    let assignedRole: PlayerRole = 'spectator';

    if (preferredRole === 'p1' && !this.p1) {
      assignedRole = 'p1';
    } else if (preferredRole === 'p2' && !this.p2) {
      assignedRole = 'p2';
    } else if (!this.p1 && preferredRole !== 'spectator') {
      assignedRole = 'p1';
    } else if (!this.p2 && preferredRole !== 'spectator') {
      assignedRole = 'p2';
    } else {
      assignedRole = 'spectator';
    }

    const client: RoomClient = {
      ws,
      id,
      name,
      role: assignedRole,
      currentInput: 0,
      lastPing: 0,
    };

    if (assignedRole === 'p1') {
      this.p1 = client;
    } else if (assignedRole === 'p2') {
      this.p2 = client;
    } else {
      this.spectators.set(id, client);
    }

    // Notify room of player join
    this.broadcast({
      type: 'room:player_joined',
      role: assignedRole,
      name,
      spectatorCount: this.spectators.size,
    });

    // If both players are present and status is waiting, start countdown
    if (this.p1 && this.p2 && (this.state.status === 'waiting' || this.state.status === 'paused')) {
      this.startCountdown();
    }

    return assignedRole;
  }

  public removeClient(id: string): PlayerRole | null {
    let role: PlayerRole | null = null;
    let name = '';

    if (this.p1 && this.p1.id === id) {
      role = 'p1';
      name = this.p1.name;
      this.p1 = null;
    } else if (this.p2 && this.p2.id === id) {
      role = 'p2';
      name = this.p2.name;
      this.p2 = null;
    } else if (this.spectators.has(id)) {
      role = 'spectator';
      const spec = this.spectators.get(id);
      name = spec ? spec.name : 'Espectador';
      this.spectators.delete(id);
      this.challengerQueue = this.challengerQueue.filter((c) => c.id !== id);
    }

    if (role) {
      this.broadcast({
        type: 'room:player_left',
        role,
        name,
        spectatorCount: this.spectators.size,
      });

      // If an active player left during game, pause or promote next challenger
      if (role === 'p1' || role === 'p2') {
        if (this.countdownHandle) {
          clearInterval(this.countdownHandle);
          this.countdownHandle = null;
        }
        if (this.challengerQueue.length > 0) {
          this.promoteChallenger(role);
        } else {
          this.state.status = 'paused';
          this.broadcastTick();
        }
      }
    }

    // Check if room is completely empty
    if (!this.p1 && !this.p2 && this.spectators.size === 0) {
      this.destroy();
      this.onEmptyCallback(this.id);
    }

    return role;
  }

  public handleInput(id: string, dir: number): boolean {
    if (!Number.isFinite(dir) || ![-1, 0, 1].includes(dir)) return false;
    if (this.p1 && this.p1.id === id) {
      this.p1.currentInput = dir;
      return true;
    } else if (this.p2 && this.p2.id === id) {
      this.p2.currentInput = dir;
      return true;
    }
    return false;
  }

  public queueChallenger(id: string, name: string): boolean {
    if (!this.spectators.has(id)) return false;
    if (this.challengerQueue.some((c) => c.id === id)) return false;
    this.challengerQueue.push({ id, name });
    return true;
  }

  private promoteChallenger(vacantSlot: 'p1' | 'p2') {
    if (this.challengerQueue.length === 0) return;
    const next = this.challengerQueue.shift();
    if (!next) return;

    const spec = this.spectators.get(next.id);
    if (!spec) return;

    this.spectators.delete(next.id);
    spec.role = vacantSlot;
    if (vacantSlot === 'p1') {
      this.p1 = spec;
    } else {
      this.p2 = spec;
    }

    this.broadcast({
      type: 'room:player_joined',
      role: vacantSlot,
      name: spec.name,
      spectatorCount: this.spectators.size,
    });

    if (this.p1 && this.p2) {
      this.resetMatch();
      this.startCountdown();
    }
  }

  public startCountdown() {
    if (this.countdownHandle) {
      clearInterval(this.countdownHandle);
      this.countdownHandle = null;
    }
    if (!this.p1 || !this.p2) {
      this.state.status = 'waiting';
      this.state.countdown = undefined;
      this.broadcastTick();
      return;
    }

    this.state.status = 'countdown';
    let count = 3;
    this.state.countdown = count;

    this.broadcastEvent({ type: 'countdown_tick', count });
    this.broadcastTick();

    const timer = setInterval(() => {
      if (!this.p1 || !this.p2) {
        clearInterval(timer);
        this.countdownHandle = null;
        this.state.status = 'waiting';
        this.state.countdown = undefined;
        this.broadcastTick();
        return;
      }
      count -= 1;
      this.state.countdown = count;
      if (count > 0) {
        this.broadcastEvent({ type: 'countdown_tick', count });
        this.broadcastTick();
      } else {
        clearInterval(timer);
        this.countdownHandle = null;
        this.state.status = 'playing';
        this.state.countdown = undefined;
        this.broadcastEvent({ type: 'countdown_tick', count: 0 });
        this.startTickLoop();
      }
    }, 1000);
    this.countdownHandle = timer;
  }

  public startTickLoop() {
    if (this.intervalHandle) return;

    // Run the authoritative simulation at the shared 30 Hz rate.
    this.intervalHandle = setInterval(() => {
      this.tick();
    }, 1000 / gameConfig.tickRateHz);
  }

  public stopTickLoop() {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
    }
  }

  private tick() {
    if (this.state.status !== 'playing') {
      return;
    }

    this.tickNumber++;
    const p1_input = this.p1 ? this.p1.currentInput : 0;
    const p2_input = this.p2 ? this.p2.currentInput : 0;

    // 1. Update paddle positions (clamped within [0, HEIGHT - PADDLE_HEIGHT])
    const maxPaddleY = GameRoom.HEIGHT - GameRoom.PADDLE_HEIGHT;
    this.state.p1_y = Math.max(0, Math.min(maxPaddleY, this.state.p1_y + p1_input * GameRoom.PADDLE_SPEED));
    this.state.p2_y = Math.max(0, Math.min(maxPaddleY, this.state.p2_y + p2_input * GameRoom.PADDLE_SPEED));

    // 2. Update ball position
    this.state.ball_x += this.state.ball_vx;
    this.state.ball_y += this.state.ball_vy;

    // 3. Collision with top and bottom walls
    const ballRadius = GameRoom.BALL_SIZE / 2;
    if (this.state.ball_y <= 0) {
      this.state.ball_y = 0;
      this.state.ball_vy = Math.abs(this.state.ball_vy);
      this.broadcastEvent({ type: 'wall_hit', x: this.state.ball_x, y: 0 });
    } else if (this.state.ball_y >= GameRoom.HEIGHT - GameRoom.BALL_SIZE) {
      this.state.ball_y = GameRoom.HEIGHT - GameRoom.BALL_SIZE;
      this.state.ball_vy = -Math.abs(this.state.ball_vy);
      this.broadcastEvent({ type: 'wall_hit', x: this.state.ball_x, y: GameRoom.HEIGHT });
    }

    // 4. Collision with Paddles
    // Player 1 Paddle: x in [P1_X, P1_X + PADDLE_WIDTH]
    const p1Right = GameRoom.P1_X + GameRoom.PADDLE_WIDTH;
    if (
      this.state.ball_vx < 0 &&
      this.state.ball_x <= p1Right &&
      this.state.ball_x + GameRoom.BALL_SIZE >= GameRoom.P1_X &&
      this.state.ball_y + GameRoom.BALL_SIZE >= this.state.p1_y &&
      this.state.ball_y <= this.state.p1_y + GameRoom.PADDLE_HEIGHT
    ) {
      // Calculate impact point (-1 at top edge, 0 at center, +1 at bottom edge)
      const paddleCenter = this.state.p1_y + GameRoom.PADDLE_HEIGHT / 2;
      const hitOffset = (this.state.ball_y + ballRadius - paddleCenter) / (GameRoom.PADDLE_HEIGHT / 2);
      const clampedOffset = Math.max(-1, Math.min(1, hitOffset));

      // Reverse horizontal velocity and accelerate gradually
      const newSpeed = Math.min(
        GameRoom.MAX_BALL_SPEED,
        Math.abs(this.state.ball_vx) * GameRoom.SPEED_INCREASE
      );
      this.state.ball_vx = newSpeed;
      // Add spin/angle based on paddle offset + paddle movement
      this.state.ball_vy =
        clampedOffset * GameRoom.BOUNCE_ANGLE + p1_input * GameRoom.PADDLE_SPIN;
      this.state.ball_x = p1Right;
      this.state.lastHitBy = 'p1';
      this.state.rallyCount++;

      this.broadcastEvent({
        type: 'paddle_hit',
        player: 'p1',
        x: p1Right,
        y: this.state.ball_y,
        speed: newSpeed,
      });
    }

    // Player 2 Paddle: x in [P2_X, P2_X + PADDLE_WIDTH]
    if (
      this.state.ball_vx > 0 &&
      this.state.ball_x + GameRoom.BALL_SIZE >= GameRoom.P2_X &&
      this.state.ball_x <= GameRoom.P2_X + GameRoom.PADDLE_WIDTH &&
      this.state.ball_y + GameRoom.BALL_SIZE >= this.state.p2_y &&
      this.state.ball_y <= this.state.p2_y + GameRoom.PADDLE_HEIGHT
    ) {
      const paddleCenter = this.state.p2_y + GameRoom.PADDLE_HEIGHT / 2;
      const hitOffset = (this.state.ball_y + ballRadius - paddleCenter) / (GameRoom.PADDLE_HEIGHT / 2);
      const clampedOffset = Math.max(-1, Math.min(1, hitOffset));

      const newSpeed = Math.min(
        GameRoom.MAX_BALL_SPEED,
        Math.abs(this.state.ball_vx) * GameRoom.SPEED_INCREASE
      );
      this.state.ball_vx = -newSpeed;
      this.state.ball_vy =
        clampedOffset * GameRoom.BOUNCE_ANGLE + p2_input * GameRoom.PADDLE_SPIN;
      this.state.ball_x = GameRoom.P2_X - GameRoom.BALL_SIZE;
      this.state.lastHitBy = 'p2';
      this.state.rallyCount++;

      this.broadcastEvent({
        type: 'paddle_hit',
        player: 'p2',
        x: GameRoom.P2_X,
        y: this.state.ball_y,
        speed: newSpeed,
      });
    }

    // 5. Scoring and Reset
    if (this.state.ball_x < 0) {
      // P2 Scores
      this.state.score_p2 += 1;
      this.broadcastEvent({
        type: 'goal',
        player: 'p2',
        score_p1: this.state.score_p1,
        score_p2: this.state.score_p2,
      });

      if (this.state.score_p2 >= this.maxScore) {
        this.finishGame('p2');
      } else {
        this.resetBall(true); // serve towards P1
      }
    } else if (this.state.ball_x > GameRoom.WIDTH) {
      // P1 Scores
      this.state.score_p1 += 1;
      this.broadcastEvent({
        type: 'goal',
        player: 'p1',
        score_p1: this.state.score_p1,
        score_p2: this.state.score_p2,
      });

      if (this.state.score_p1 >= this.maxScore) {
        this.finishGame('p1');
      } else {
        this.resetBall(false); // serve towards P2
      }
    }

    // Broadcast the authoritative state to all room members.
    this.broadcastTick();
  }

  private resetBall(serveLeft: boolean) {
    this.state.ball_x = GameRoom.WIDTH / 2;
    this.state.ball_y = GameRoom.HEIGHT / 2;
    const initialVx = serveLeft ? -GameRoom.INITIAL_SPEED_X : GameRoom.INITIAL_SPEED_X;
    const initialVy =
      (Math.random() > 0.5 ? 1 : -1) *
      (GameRoom.RESET_SPEED_Y_MIN +
        Math.random() * (GameRoom.RESET_SPEED_Y_MAX - GameRoom.RESET_SPEED_Y_MIN));
    this.state.ball_vx = initialVx;
    this.state.ball_vy = initialVy;
    this.state.rallyCount = 0;
  }

  private finishGame(winner: 'p1' | 'p2') {
    this.state.status = 'finished';
    this.state.winner = winner;
    this.stopTickLoop();

    this.broadcastEvent({
      type: 'game_over',
      winner,
      final_p1: this.state.score_p1,
      final_p2: this.state.score_p2,
    });
    this.broadcastTick();

    if (this.onGameOverCallback) {
      this.onGameOverCallback(winner, this);
    }
  }

  public restartGame() {
    this.resetMatch();
    if (this.p1 && this.p2) {
      this.startCountdown();
    } else {
      this.broadcastTick();
    }
  }

  public resetMatch() {
    this.stopTickLoop();
    if (this.countdownHandle) {
      clearInterval(this.countdownHandle);
      this.countdownHandle = null;
    }
    this.state.p1_y = (GameRoom.HEIGHT - GameRoom.PADDLE_HEIGHT) / 2;
    this.state.p2_y = (GameRoom.HEIGHT - GameRoom.PADDLE_HEIGHT) / 2;
    this.state.score_p1 = 0;
    this.state.score_p2 = 0;
    this.state.winner = null;
    this.state.status = 'waiting';
    this.resetBall(Math.random() > 0.5);
  }

  public broadcast(msg: ServerMessage) {
    const raw = JSON.stringify(msg);
    this.sendToWs(this.p1?.ws, raw);
    this.sendToWs(this.p2?.ws, raw);
    for (const spec of this.spectators.values()) {
      this.sendToWs(spec.ws, raw);
    }
  }

  public broadcastTick() {
    const raw = JSON.stringify({
      type: 'game:tick',
      state: this.state,
      tick: this.tickNumber,
    });
    this.sendToWs(this.p1?.ws, raw);
    this.sendToWs(this.p2?.ws, raw);
    for (const spec of this.spectators.values()) {
      this.sendToWs(spec.ws, raw);
    }
  }

  public broadcastEvent(event: GameEvent) {
    this.broadcast({
      type: 'game:event',
      event,
    });
  }

  public broadcastChat(from: string, role: PlayerRole, text: string) {
    const chatMsg: ChatMessage = {
      id: Math.random().toString(36).substring(2, 9),
      from,
      role,
      text: [...text.trim()].slice(0, 100).join(''),
      timestamp: Date.now(),
    };
    this.broadcast({
      type: 'chat:message',
      message: chatMsg,
    });
  }

  private sendToWs(ws: WebSocket | undefined, data: string) {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(data);
    }
  }

  public destroy() {
    this.stopTickLoop();
    this.spectators.clear();
    this.p1 = null;
    this.p2 = null;
  }
}
