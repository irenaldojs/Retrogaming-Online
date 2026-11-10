/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import { GameState, GameEvent, PlayerRole } from '../types/game.js';
import confetti from 'canvas-confetti';

interface SparkParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

interface FloatingReaction {
  id: string;
  emoji: string;
  x: number;
  y: number;
  vy: number;
  alpha: number;
  from: string;
}

interface GameCanvasProps {
  state: GameState;
  role: PlayerRole;
  p1Name?: string;
  p2Name?: string;
  enableCrt?: boolean;
  controlScheme?: 'both' | 'wasd' | 'arrows' | 'none';
  onSendInput?: (dir: number) => void;
  onSendInputP2?: (dir: number) => void;
  onRestart?: () => void;
  events?: GameEvent[];
  incomingReaction?: { emoji: string; from: string } | null;
}

export const GameCanvas: React.FC<GameCanvasProps> = ({
  state,
  role,
  p1Name = 'Player 1',
  p2Name = 'Player 2',
  enableCrt = true,
  controlScheme = 'both',
  onSendInput,
  onSendInputP2,
  onRestart,
  incomingReaction,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const sparksRef = useRef<SparkParticle[]>([]);
  const trailRef = useRef<Array<{ x: number; y: number; alpha: number }>>([]);
  const reactionsRef = useRef<FloatingReaction[]>([]);
  const lastStateRef = useRef<GameState>(state);
  lastStateRef.current = state;

  // Track key states
  const keysPressed = useRef<{ up: boolean; down: boolean }>({ up: false, down: false });
  const keysPressedP2 = useRef<{ up: boolean; down: boolean }>({ up: false, down: false });
  const currentDir = useRef<number>(0);
  const currentDirP2 = useRef<number>(0);

  // Add floating reaction when received
  useEffect(() => {
    if (incomingReaction) {
      reactionsRef.current.push({
        id: Math.random().toString(),
        emoji: incomingReaction.emoji,
        x: 100 + Math.random() * 600,
        y: 560,
        vy: -(1.5 + Math.random() * 2.0),
        alpha: 1.0,
        from: incomingReaction.from,
      });
    }
  }, [incomingReaction]);

  // Celebrate on game over
  useEffect(() => {
    if (state.status === 'finished' && state.winner) {
      try {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 },
          colors: state.winner === 'p1' ? ['#00f0ff', '#ffffff'] : ['#ff007f', '#ffffff'],
        });
      } catch {}
    }
  }, [state.status, state.winner]);

  // Keyboard handler with explicit control separation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't capture inputs if typing in an input field
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return;

      // Mode A: Local 2-Player on single canvas (P1 on WASD, P2 on Arrows)
      if (onSendInputP2) {
        if (e.key === 'w' || e.key === 'W') {
          keysPressed.current.up = true;
          updateDirection();
        } else if (e.key === 's' || e.key === 'S') {
          keysPressed.current.down = true;
          updateDirection();
        }
        if (e.key === 'ArrowUp') {
          keysPressedP2.current.up = true;
          updateDirectionP2();
        } else if (e.key === 'ArrowDown') {
          keysPressedP2.current.down = true;
          updateDirectionP2();
        }
        return;
      }

      // Mode B: Dedicated player role with controlScheme
      if (role === 'spectator' || controlScheme === 'none') return;

      const allowWasd = controlScheme === 'both' || controlScheme === 'wasd';
      const allowArrows = controlScheme === 'both' || controlScheme === 'arrows';

      let changed = false;
      const isUp =
        (allowWasd && (e.key === 'w' || e.key === 'W')) ||
        (allowArrows && e.key === 'ArrowUp');
      const isDown =
        (allowWasd && (e.key === 's' || e.key === 'S')) ||
        (allowArrows && e.key === 'ArrowDown');

      if (isUp) {
        keysPressed.current.up = true;
        changed = true;
      }
      if (isDown) {
        keysPressed.current.down = true;
        changed = true;
      }

      if (changed) {
        updateDirection();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return;

      if (onSendInputP2) {
        if (e.key === 'w' || e.key === 'W') {
          keysPressed.current.up = false;
          updateDirection();
        } else if (e.key === 's' || e.key === 'S') {
          keysPressed.current.down = false;
          updateDirection();
        }
        if (e.key === 'ArrowUp') {
          keysPressedP2.current.up = false;
          updateDirectionP2();
        } else if (e.key === 'ArrowDown') {
          keysPressedP2.current.down = false;
          updateDirectionP2();
        }
        return;
      }

      if (role === 'spectator' || controlScheme === 'none') return;

      const allowWasd = controlScheme === 'both' || controlScheme === 'wasd';
      const allowArrows = controlScheme === 'both' || controlScheme === 'arrows';

      let changed = false;
      const isUp =
        (allowWasd && (e.key === 'w' || e.key === 'W')) ||
        (allowArrows && e.key === 'ArrowUp');
      const isDown =
        (allowWasd && (e.key === 's' || e.key === 'S')) ||
        (allowArrows && e.key === 'ArrowDown');

      if (isUp) {
        keysPressed.current.up = false;
        changed = true;
      }
      if (isDown) {
        keysPressed.current.down = false;
        changed = true;
      }

      if (changed) {
        updateDirection();
      }
    };

    const updateDirection = () => {
      let dir = 0;
      if (keysPressed.current.up && !keysPressed.current.down) {
        dir = -1;
      } else if (keysPressed.current.down && !keysPressed.current.up) {
        dir = 1;
      }

      if (dir !== currentDir.current) {
        currentDir.current = dir;
        onSendInput?.(dir);
      }
    };

    const updateDirectionP2 = () => {
      let dir = 0;
      if (keysPressedP2.current.up && !keysPressedP2.current.down) {
        dir = -1;
      } else if (keysPressedP2.current.down && !keysPressedP2.current.up) {
        dir = 1;
      }

      if (dir !== currentDirP2.current) {
        currentDirP2.current = dir;
        onSendInputP2?.(dir);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [role, controlScheme, onSendInput, onSendInputP2]);

  // Main rendering animation loop (Locked to 30 FPS)
  useEffect(() => {
    let animId: number;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const targetFps = 30;
    const frameInterval = 1000 / targetFps; // 33.33ms per frame
    let lastTime = performance.now();

    const render = (currentTime: number) => {
      animId = requestAnimationFrame(render);

      // Frame rate lock to 30 FPS
      const elapsed = currentTime - lastTime;
      if (elapsed < frameInterval) {
        return;
      }
      lastTime = currentTime - (elapsed % frameInterval);

      const s = lastStateRef.current;

      // 1. Clear background
      ctx.fillStyle = '#0a0d14';
      ctx.fillRect(0, 0, 800, 600);

      // Subtle grid
      ctx.strokeStyle = '#141c2c';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = 0; x <= 800; x += 40) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, 600);
      }
      for (let y = 0; y <= 600; y += 40) {
        ctx.moveTo(0, y);
        ctx.lineTo(800, y);
      }
      ctx.stroke();

      // 2. Center court dotted line
      ctx.setLineDash([12, 12]);
      ctx.strokeStyle = '#22324e';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(400, 0);
      ctx.lineTo(400, 600);
      ctx.stroke();
      ctx.setLineDash([]);

      // Center court circle
      ctx.strokeStyle = '#1b263b';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(400, 300, 70, 0, Math.PI * 2);
      ctx.stroke();

      // 3. Ball motion trail
      trailRef.current.push({ x: s.ball_x, y: s.ball_y, alpha: 0.6 });
      if (trailRef.current.length > 8) {
        trailRef.current.shift();
      }

      trailRef.current.forEach((t, idx) => {
        const factor = (idx + 1) / trailRef.current.length;
        ctx.fillStyle = `rgba(255, 230, 80, ${factor * 0.25})`;
        ctx.fillRect(t.x + (1 - factor) * 3, t.y + (1 - factor) * 3, 12 * factor, 12 * factor);
      });

      // 4. Render Sparks
      sparksRef.current.forEach((p, idx) => {
        p.x += p.vx;
        p.y += p.vy;
        p.life -= 1;

        const alpha = Math.max(0, p.life / p.maxLife);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = alpha;
        ctx.fillRect(p.x, p.y, p.size, p.size);
      });
      ctx.globalAlpha = 1.0;
      sparksRef.current = sparksRef.current.filter((p) => p.life > 0);

      // 5. Floating Reactions
      reactionsRef.current.forEach((r) => {
        r.y += r.vy;
        r.alpha -= 0.008;
        ctx.save();
        ctx.globalAlpha = Math.max(0, r.alpha);
        ctx.font = '24px sans-serif';
        ctx.fillText(r.emoji, r.x, r.y);
        ctx.font = '10px monospace';
        ctx.fillStyle = '#94a3b8';
        ctx.fillText(r.from, r.x - 5, r.y + 14);
        ctx.restore();
      });
      reactionsRef.current = reactionsRef.current.filter((r) => r.alpha > 0);

      // 6. Draw Player 1 Paddle (Neon Cyan)
      ctx.save();
      ctx.shadowColor = '#00f0ff';
      ctx.shadowBlur = 14;
      ctx.fillStyle = '#00f0ff';
      ctx.fillRect(25, s.p1_y, 12, 90);
      // Paddle core highlight
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(28, s.p1_y + 4, 6, 82);
      ctx.restore();

      // 7. Draw Player 2 Paddle (Neon Pink)
      ctx.save();
      ctx.shadowColor = '#ff007f';
      ctx.shadowBlur = 14;
      ctx.fillStyle = '#ff007f';
      ctx.fillRect(763, s.p2_y, 12, 90);
      // Paddle core highlight
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(766, s.p2_y + 4, 6, 82);
      ctx.restore();

      // 8. Draw Ball (Neon Yellow/White)
      ctx.save();
      ctx.shadowColor = '#facc15';
      ctx.shadowBlur = 18;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(s.ball_x, s.ball_y, 12, 12);
      ctx.fillStyle = '#fef08a';
      ctx.fillRect(s.ball_x + 2, s.ball_y + 2, 8, 8);
      ctx.restore();

      // 9. Score Board
      ctx.save();
      ctx.font = '900 48px monospace';
      ctx.textAlign = 'center';

      // P1 Score
      ctx.fillStyle = '#00f0ff';
      ctx.shadowColor = '#00f0ff';
      ctx.shadowBlur = 10;
      ctx.fillText(s.score_p1.toString().padStart(2, '0'), 330, 68);

      // P2 Score
      ctx.fillStyle = '#ff007f';
      ctx.shadowColor = '#ff007f';
      ctx.shadowBlur = 10;
      ctx.fillText(s.score_p2.toString().padStart(2, '0'), 470, 68);
      ctx.restore();

      // Player names below score
      ctx.font = '12px monospace';
      ctx.fillStyle = '#00f0ff';
      ctx.fillText(p1Name.toUpperCase(), 330, 88);
      ctx.fillStyle = '#ff007f';
      ctx.fillText(p2Name.toUpperCase(), 470, 88);

      // Rally Counter
      if (s.rallyCount > 2) {
        ctx.font = '11px monospace';
        ctx.fillStyle = '#64748b';
        ctx.textAlign = 'center';
        ctx.fillText(`RALLY: ${s.rallyCount}x`, 400, 115);
      }

      // 10. Countdown Banner
      if (s.status === 'countdown' && s.countdown !== undefined) {
        ctx.save();
        ctx.fillStyle = 'rgba(0,0,0,0.4)';
        ctx.fillRect(0, 0, 800, 600);
        ctx.font = '900 80px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#facc15';
        ctx.shadowColor = '#facc15';
        ctx.shadowBlur = 25;
        const text = s.countdown > 0 ? s.countdown.toString() : 'JOGAR!';
        ctx.fillText(text, 400, 300);
        ctx.restore();
      }

      // 11. Waiting / Paused Overlay
      if (s.status === 'waiting') {
        ctx.save();
        ctx.fillStyle = 'rgba(10, 13, 20, 0.7)';
        ctx.fillRect(0, 250, 800, 100);
        ctx.font = '700 20px monospace';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#38bdf8';
        ctx.fillText('AGUARDANDO OPONENTE...', 400, 295);
        ctx.font = '12px monospace';
        ctx.fillStyle = '#94a3b8';
        ctx.fillText('Abra uma segunda aba ou use o Simulador Dividido para parear', 400, 325);
        ctx.restore();
      } else if (s.status === 'paused') {
        ctx.save();
        ctx.fillStyle = 'rgba(10, 13, 20, 0.7)';
        ctx.fillRect(0, 250, 800, 100);
        ctx.font = '700 22px monospace';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#f59e0b';
        ctx.fillText('PARTIDA PAUSADA (JOGADOR DESCONECTOU)', 400, 305);
        ctx.restore();
      }

      // 12. Winner Declaration
      if (s.status === 'finished' && s.winner) {
        ctx.save();
        ctx.fillStyle = 'rgba(10, 13, 20, 0.85)';
        ctx.fillRect(0, 180, 800, 240);

        const winnerColor = s.winner === 'p1' ? '#00f0ff' : '#ff007f';
        const winnerName = s.winner === 'p1' ? p1Name : p2Name;

        ctx.font = '900 42px monospace';
        ctx.textAlign = 'center';
        ctx.fillStyle = winnerColor;
        ctx.shadowColor = winnerColor;
        ctx.shadowBlur = 20;
        ctx.fillText('VITÓRIA!', 400, 250);

        ctx.font = '700 24px monospace';
        ctx.fillStyle = '#ffffff';
        ctx.fillText(`${winnerName.toUpperCase()} VENCEU A PARTIDA`, 400, 300);

        ctx.font = '14px monospace';
        ctx.fillStyle = '#94a3b8';
        ctx.fillText('Pressione Reiniciar ou desafie o campeão', 400, 340);
        ctx.restore();
      }
    };

    animId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [p1Name, p2Name]);

  // Handle touch / virtual button controls
  const handleTouchDir = (dir: number) => {
    currentDir.current = dir;
    onSendInput?.(dir);
  };

  return (
    <div className="relative flex flex-col items-center select-none" ref={containerRef}>
      {/* Outer CRT Bezel */}
      <div className="relative p-2 rounded-2xl bg-gradient-to-b from-slate-800 to-slate-950 border border-slate-700 shadow-2xl shadow-cyan-950/40">
        {/* Canvas Screen */}
        <div className="relative overflow-hidden rounded-xl border-2 border-slate-700/80 bg-black">
          <canvas
            ref={canvasRef}
            id="stage"
            width={800}
            height={600}
            className="w-full max-w-[800px] aspect-[4/3] block bg-black"
          />

          {/* Retro CRT Scanlines & Phosphor Glow */}
          {enableCrt && (
            <div
              className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_60%,rgba(0,0,0,0.6)_100%)]"
              style={{
                backgroundImage:
                  'repeating-linear-gradient(0deg, rgba(0,0,0,0.18) 0px, rgba(0,0,0,0.18) 1px, transparent 1px, transparent 2px)',
              }}
            />
          )}

          {/* Role Badge in Corner */}
          <div className="absolute top-3 left-3 flex items-center gap-2 px-2.5 py-1 rounded bg-slate-900/80 backdrop-blur border border-slate-700/60 text-xs font-mono">
            <span
              className={`w-2 h-2 rounded-full ${
                role === 'p1' ? 'bg-cyan-400 animate-pulse' : role === 'p2' ? 'bg-pink-500 animate-pulse' : 'bg-amber-400'
              }`}
            />
            <span className="text-slate-300">
              {role === 'p1' ? 'VOCÊ: P1 (ESQUERDA)' : role === 'p2' ? 'VOCÊ: P2 (DIREITA)' : 'MODO ESPECTADOR'}
            </span>
          </div>

          {/* 30 FPS Lock Badge in Top Right */}
          <div className="absolute top-3 right-3 flex items-center gap-1.5 px-2 py-0.5 rounded bg-emerald-950/80 backdrop-blur border border-emerald-500/40 text-[10px] font-mono text-emerald-400 font-bold">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>30 FPS (TRAVADO)</span>
          </div>

          {/* Quick Restart button if finished */}
          {state.status === 'finished' && onRestart && (
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-3">
              <button
                onClick={onRestart}
                className="px-6 py-2.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-mono font-bold text-sm shadow-lg shadow-cyan-500/30 transition-transform active:scale-95"
              >
                🔄 REINICIAR PARTIDA
              </button>
            </div>
          )}
        </div>
      </div>

      {/* On-screen controls for Mobile / Touch screens */}
      {(role === 'p1' || role === 'p2') && (
        <div className="mt-4 flex sm:hidden items-center justify-center gap-8 w-full max-w-sm">
          <button
            onPointerDown={() => handleTouchDir(-1)}
            onPointerUp={() => handleTouchDir(0)}
            onPointerCancel={() => handleTouchDir(0)}
            className="flex-1 py-4 bg-slate-800 active:bg-cyan-600 rounded-xl border border-slate-700 font-mono font-bold text-lg text-white text-center select-none"
          >
            ▲ CIMA
          </button>
          <button
            onPointerDown={() => handleTouchDir(1)}
            onPointerUp={() => handleTouchDir(0)}
            onPointerCancel={() => handleTouchDir(0)}
            className="flex-1 py-4 bg-slate-800 active:bg-cyan-600 rounded-xl border border-slate-700 font-mono font-bold text-lg text-white text-center select-none"
          >
            ▼ BAIXO
          </button>
        </div>
      )}
    </div>
  );
};
