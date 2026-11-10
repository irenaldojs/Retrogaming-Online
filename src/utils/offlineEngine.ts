/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GameState, GameEvent } from '../types/game.js';

export type BotDifficulty = 'easy' | 'medium' | 'hard' | 'nightmare' | 'pvp';

export class OfflineEngine {
  public state: GameState;
  public difficulty: BotDifficulty = 'medium';
  private animFrameId: number | null = null;
  private lastTime: number = 0;
  private p1Input: number = 0;
  private p2Input: number = 0;
  private onStateChange: (state: GameState) => void;
  private onEvent?: (event: GameEvent) => void;

  public static readonly WIDTH = 800;
  public static readonly HEIGHT = 600;
  public static readonly PADDLE_HEIGHT = 90;
  public static readonly PADDLE_WIDTH = 12;
  public static readonly P1_X = 25;
  public static readonly P2_X = 763;
  public static readonly BALL_SIZE = 12;

  constructor(
    difficulty: BotDifficulty = 'medium',
    onStateChange: (state: GameState) => void,
    onEvent?: (event: GameEvent) => void
  ) {
    this.difficulty = difficulty;
    this.onStateChange = onStateChange;
    this.onEvent = onEvent;

    this.state = {
      p1_y: 255,
      p2_y: 255,
      ball_x: 400,
      ball_y: 300,
      ball_vx: 9.0,
      ball_vy: 5.8,
      score_p1: 0,
      score_p2: 0,
      status: 'playing',
      countdown: undefined,
      winner: null,
      lastHitBy: null,
      rallyCount: 0,
      maxScore: 5,
    };
  }

  public setInput(player: 'p1' | 'p2', dir: number) {
    if (player === 'p1') {
      this.p1Input = dir;
    } else {
      this.p2Input = dir;
    }
  }

  public start() {
    this.lastTime = performance.now();
    this.loop(this.lastTime);
  }

  public stop() {
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
  }

  public restart() {
    this.state.score_p1 = 0;
    this.state.score_p2 = 0;
    this.state.status = 'playing';
    this.state.winner = null;
    this.state.p1_y = 255;
    this.state.p2_y = 255;
    this.resetBall(Math.random() > 0.5);
    this.onStateChange({ ...this.state });
  }

  private loop = (time: number) => {
    this.animFrameId = requestAnimationFrame(this.loop);

    // Lock offline loop to 30 FPS (33.33ms)
    const elapsed = time - this.lastTime;
    if (elapsed < 33) {
      return;
    }
    this.lastTime = time - (elapsed % 33.33);

    if (this.state.status === 'playing') {
      this.updatePhysics();
    }

    this.onStateChange({ ...this.state });
  };

  private updatePhysics() {
    // 1. Calculate P2 Bot input if not in local 2-Player mode
    if (this.difficulty !== 'pvp') {
      this.p2Input = this.calculateBotInput();
    }

    // 2. Paddle movement (Speed: 12.0 px per tick at 30 FPS)
    const maxPaddleY = OfflineEngine.HEIGHT - OfflineEngine.PADDLE_HEIGHT;
    this.state.p1_y = Math.max(0, Math.min(maxPaddleY, this.state.p1_y + this.p1Input * 12.0));
    this.state.p2_y = Math.max(0, Math.min(maxPaddleY, this.state.p2_y + this.p2Input * 12.0));

    // 3. Ball movement
    this.state.ball_x += this.state.ball_vx;
    this.state.ball_y += this.state.ball_vy;

    // 4. Wall collision
    if (this.state.ball_y <= 0) {
      this.state.ball_y = 0;
      this.state.ball_vy = Math.abs(this.state.ball_vy);
      this.onEvent?.({ type: 'wall_hit', x: this.state.ball_x, y: 0 });
    } else if (this.state.ball_y >= OfflineEngine.HEIGHT - OfflineEngine.BALL_SIZE) {
      this.state.ball_y = OfflineEngine.HEIGHT - OfflineEngine.BALL_SIZE;
      this.state.ball_vy = -Math.abs(this.state.ball_vy);
      this.onEvent?.({ type: 'wall_hit', x: this.state.ball_x, y: OfflineEngine.HEIGHT });
    }

    // 5. Paddle 1 Collision
    const p1Right = OfflineEngine.P1_X + OfflineEngine.PADDLE_WIDTH;
    if (
      this.state.ball_vx < 0 &&
      this.state.ball_x <= p1Right &&
      this.state.ball_x + OfflineEngine.BALL_SIZE >= OfflineEngine.P1_X &&
      this.state.ball_y + OfflineEngine.BALL_SIZE >= this.state.p1_y &&
      this.state.ball_y <= this.state.p1_y + OfflineEngine.PADDLE_HEIGHT
    ) {
      const center = this.state.p1_y + OfflineEngine.PADDLE_HEIGHT / 2;
      const offset = (this.state.ball_y + OfflineEngine.BALL_SIZE / 2 - center) / (OfflineEngine.PADDLE_HEIGHT / 2);
      const newSpeed = Math.min(24.0, Math.abs(this.state.ball_vx) * 1.05);
      this.state.ball_vx = newSpeed;
      this.state.ball_vy = offset * 7.5 + this.p1Input * 2.2;
      this.state.ball_x = p1Right;
      this.state.lastHitBy = 'p1';
      this.state.rallyCount++;

      this.onEvent?.({
        type: 'paddle_hit',
        player: 'p1',
        x: p1Right,
        y: this.state.ball_y,
        speed: newSpeed,
      });
    }

    // 6. Paddle 2 Collision
    if (
      this.state.ball_vx > 0 &&
      this.state.ball_x + OfflineEngine.BALL_SIZE >= OfflineEngine.P2_X &&
      this.state.ball_x <= OfflineEngine.P2_X + OfflineEngine.PADDLE_WIDTH &&
      this.state.ball_y + OfflineEngine.BALL_SIZE >= this.state.p2_y &&
      this.state.ball_y <= this.state.p2_y + OfflineEngine.PADDLE_HEIGHT
    ) {
      const center = this.state.p2_y + OfflineEngine.PADDLE_HEIGHT / 2;
      const offset = (this.state.ball_y + OfflineEngine.BALL_SIZE / 2 - center) / (OfflineEngine.PADDLE_HEIGHT / 2);
      const newSpeed = Math.min(24.0, Math.abs(this.state.ball_vx) * 1.05);
      this.state.ball_vx = -newSpeed;
      this.state.ball_vy = offset * 7.5 + this.p2Input * 2.2;
      this.state.ball_x = OfflineEngine.P2_X - OfflineEngine.BALL_SIZE;
      this.state.lastHitBy = 'p2';
      this.state.rallyCount++;

      this.onEvent?.({
        type: 'paddle_hit',
        player: 'p2',
        x: OfflineEngine.P2_X,
        y: this.state.ball_y,
        speed: newSpeed,
      });
    }

    // 7. Goals
    if (this.state.ball_x < 0) {
      this.state.score_p2++;
      this.onEvent?.({
        type: 'goal',
        player: 'p2',
        score_p1: this.state.score_p1,
        score_p2: this.state.score_p2,
      });
      if (this.state.score_p2 >= this.state.maxScore) {
        this.finishGame('p2');
      } else {
        this.resetBall(true);
      }
    } else if (this.state.ball_x > OfflineEngine.WIDTH) {
      this.state.score_p1++;
      this.onEvent?.({
        type: 'goal',
        player: 'p1',
        score_p1: this.state.score_p1,
        score_p2: this.state.score_p2,
      });
      if (this.state.score_p1 >= this.state.maxScore) {
        this.finishGame('p1');
      } else {
        this.resetBall(false);
      }
    }
  }

  private calculateBotInput(): number {
    const paddleCenter = this.state.p2_y + OfflineEngine.PADDLE_HEIGHT / 2;
    const ballCenter = this.state.ball_y + OfflineEngine.BALL_SIZE / 2;

    // Reaction distance & accuracy based on difficulty
    let targetY = ballCenter;
    let deadZone = 14;

    if (this.difficulty === 'easy') {
      if (this.state.ball_vx < 0 && this.state.ball_x < 500) return 0;
      deadZone = 36;
    } else if (this.difficulty === 'medium') {
      if (this.state.ball_vx < 0 && this.state.ball_x < 350) return 0;
      deadZone = 20;
    } else if (this.difficulty === 'hard') {
      deadZone = 10;
      if (this.state.ball_vx > 0) {
        const timeToHit = (OfflineEngine.P2_X - this.state.ball_x) / this.state.ball_vx;
        targetY = this.state.ball_y + this.state.ball_vy * timeToHit;
      }
    } else if (this.difficulty === 'nightmare') {
      deadZone = 5;
      targetY = ballCenter;
    }

    if (paddleCenter < targetY - deadZone) {
      return 1;
    } else if (paddleCenter > targetY + deadZone) {
      return -1;
    }
    return 0;
  }

  private resetBall(serveLeft: boolean) {
    this.state.ball_x = OfflineEngine.WIDTH / 2;
    this.state.ball_y = OfflineEngine.HEIGHT / 2;
    this.state.ball_vx = serveLeft ? -9.0 : 9.0;
    this.state.ball_vy = (Math.random() > 0.5 ? 1 : -1) * (3.5 + Math.random() * 3.5);
    this.state.rallyCount = 0;
  }

  private finishGame(winner: 'p1' | 'p2') {
    this.state.status = 'finished';
    this.state.winner = winner;
    this.onEvent?.({
      type: 'game_over',
      winner,
      final_p1: this.state.score_p1,
      final_p2: this.state.score_p2,
    });
  }
}
