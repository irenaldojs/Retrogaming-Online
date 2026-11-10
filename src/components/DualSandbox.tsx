/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import { GameState, ServerMessage } from '../types/game.js';
import { GameCanvas } from './GameCanvas.js';
import { SplitSquareVertical, Radio, RotateCcw } from 'lucide-react';

export const DualSandbox: React.FC = () => {
  const [p1State, setP1State] = useState<GameState | null>(null);
  const [p2State, setP2State] = useState<GameState | null>(null);
  const [p1Ping, setP1Ping] = useState<number | null>(null);
  const [p2Ping, setP2Ping] = useState<number | null>(null);
  const [connected, setConnected] = useState(false);

  const ws1Ref = useRef<WebSocket | null>(null);
  const ws2Ref = useRef<WebSocket | null>(null);
  const roomIdRef = useRef<string>(`sandbox_${Date.now()}`);

  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = import.meta.env.VITE_WS_URL || `${protocol}//${window.location.host}`;
    const roomId = roomIdRef.current;

    // Connect Client 1
    const ws1 = new WebSocket(wsUrl);
    ws1Ref.current = ws1;

    ws1.onopen = () => {
      // Create and join room as P1
      ws1.send(
        JSON.stringify({
          type: 'room:create',
          name: 'Simulador 1v1 Split-Screen',
          maxScore: 5,
          isPrivate: true,
          nickname: 'Sandbox P1',
        })
      );
    };

    ws1.onmessage = (event) => {
      try {
        const msg: ServerMessage = JSON.parse(event.data);
        if (msg.type === 'room:joined') {
          roomIdRef.current = msg.roomId;
          setP1State(msg.state);

          // Now connect Client 2 to that same room
          connectClient2(wsUrl, msg.roomId);
        } else if (msg.type === 'game:tick') {
          setP1State(msg.state);
        } else if (msg.type === 'pong') {
          setP1Ping(Date.now() - msg.clientTimestamp);
        }
      } catch {}
    };

    const connectClient2 = (url: string, targetRoomId: string) => {
      const ws2 = new WebSocket(url);
      ws2Ref.current = ws2;

      ws2.onopen = () => {
        ws2.send(
          JSON.stringify({
            type: 'room:join',
            roomId: targetRoomId,
            nickname: 'Sandbox P2',
            asSpectator: false,
          })
        );
        setConnected(true);
      };

      ws2.onmessage = (event) => {
        try {
          const msg: ServerMessage = JSON.parse(event.data);
          if (msg.type === 'room:joined') {
            setP2State(msg.state);
          } else if (msg.type === 'game:tick') {
            setP2State(msg.state);
          } else if (msg.type === 'pong') {
            setP2Ping(Date.now() - msg.clientTimestamp);
          }
        } catch {}
      };
    };

    // Ping interval for both
    const pingTimer = setInterval(() => {
      if (ws1.readyState === WebSocket.OPEN) {
        ws1.send(JSON.stringify({ type: 'ping', timestamp: Date.now() }));
      }
      if (ws2Ref.current && ws2Ref.current.readyState === WebSocket.OPEN) {
        ws2Ref.current.send(JSON.stringify({ type: 'ping', timestamp: Date.now() }));
      }
    }, 2000);

    return () => {
      clearInterval(pingTimer);
      ws1.close();
      if (ws2Ref.current) ws2Ref.current.close();
    };
  }, []);

  const handleP1Input = (dir: number) => {
    if (ws1Ref.current && ws1Ref.current.readyState === WebSocket.OPEN) {
      ws1Ref.current.send(JSON.stringify({ type: 'Input', dir }));
    }
  };

  const handleP2Input = (dir: number) => {
    if (ws2Ref.current && ws2Ref.current.readyState === WebSocket.OPEN) {
      ws2Ref.current.send(JSON.stringify({ type: 'Input', dir }));
    }
  };

  const handleRestart = () => {
    if (ws1Ref.current && ws1Ref.current.readyState === WebSocket.OPEN) {
      ws1Ref.current.send(
        JSON.stringify({ type: 'game:restart', roomId: roomIdRef.current })
      );
    }
  };

  return (
    <div className="font-mono space-y-4">
      {/* Title & Controls Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/80 p-4 rounded-2xl border border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <SplitSquareVertical className="w-5 h-5 text-cyan-400" />
            <h3 className="font-bold text-white text-base">
              SIMULADOR DE REDE DUAL-CLIENT (SPLIT-SCREEN)
            </h3>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Dois clientes WebSocket separados comunicando-se com o servidor dedicado a 30 Hz com interpolação no canvas.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs">
            <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
            <span className="text-slate-300">
              {connected ? 'AMBOS OS CLIENTES CONECTADOS' : 'SINCRONIZANDO...'}
            </span>
          </div>

          <button
            onClick={handleRestart}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-400 text-xs font-bold border border-slate-700 transition"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            REINICIAR
          </button>
        </div>
      </div>

      {/* Side-by-Side Dual Views */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Left: Client 1 (P1) */}
        <div className="bg-slate-900/80 p-4 rounded-2xl border border-cyan-500/30 shadow-lg shadow-cyan-950/20">
          <div className="flex items-center justify-between mb-3 text-xs">
            <span className="font-bold text-cyan-400 flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-400" />
              CLIENTE #1 (PLAYER 1) - CONTROLES: [W] / [S]
            </span>
            <span className="text-slate-400">RTT: {p1Ping ?? '--'} ms</span>
          </div>

          {p1State ? (
            <GameCanvas
              state={p1State}
              role="p1"
              p1Name="Player 1"
              p2Name="Player 2"
              controlScheme="wasd"
              onSendInput={handleP1Input}
              onRestart={handleRestart}
            />
          ) : (
            <div className="h-64 flex items-center justify-center text-xs text-slate-500">
              Iniciando conexão de P1...
            </div>
          )}
        </div>

        {/* Right: Client 2 (P2) */}
        <div className="bg-slate-900/80 p-4 rounded-2xl border border-pink-500/30 shadow-lg shadow-pink-950/20">
          <div className="flex items-center justify-between mb-3 text-xs">
            <span className="font-bold text-pink-400 flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-pink-400" />
              CLIENTE #2 (PLAYER 2) - CONTROLES: [↑] / [↓]
            </span>
            <span className="text-slate-400">RTT: {p2Ping ?? '--'} ms</span>
          </div>

          {p2State ? (
            <GameCanvas
              state={p2State}
              role="p2"
              p1Name="Player 1"
              p2Name="Player 2"
              controlScheme="arrows"
              onSendInput={handleP2Input}
              onRestart={handleRestart}
            />
          ) : (
            <div className="h-64 flex items-center justify-center text-xs text-slate-500">
              Aguardando pareamento de P2...
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
