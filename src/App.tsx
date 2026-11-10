/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  GameState,
  PlayerRole,
  ServerMessage,
  ClientMessage,
  RoomSummary,
  ServerStats,
  ChatMessage,
  GameEvent,
} from './types/game.js';
import { soundFx } from './utils/audio.js';
import { OfflineEngine, BotDifficulty } from './utils/offlineEngine.js';
import { GameCanvas } from './components/GameCanvas.js';
import { TelemetryBar } from './components/TelemetryBar.js';
import { MatchmakerModal } from './components/MatchmakerModal.js';
import { LobbyBrowser } from './components/LobbyBrowser.js';
import { SpectatorHud } from './components/SpectatorHud.js';
import { DualSandbox } from './components/DualSandbox.js';
import { RustCodeViewer } from './components/RustCodeViewer.js';
import { ShareModal } from './components/ShareModal.js';
import gameConfig from '../game-config.json';
import {
  Gamepad2,
  Wifi,
  Radio,
  Volume2,
  VolumeX,
  Tv,
  Users,
  Swords,
  Bot,
  SplitSquareVertical,
  Cpu,
  Share2,
} from 'lucide-react';

export default function App() {
  const rustServerMode = import.meta.env.VITE_GAME_SERVER === 'rust';

  // Navigation & View Mode
  const [activeTab, setActiveTab] = useState<'online' | 'offline' | 'sandbox' | 'rust'>('online');
  const [showMatchmakerModal, setShowMatchmakerModal] = useState<boolean>(false);
  const [showLobbyBrowser, setShowLobbyBrowser] = useState<boolean>(false);
  const [showShareModal, setShowShareModal] = useState<boolean>(false);

  // User Profile
  const [nickname, setNickname] = useState<string>('Gamer_' + Math.floor(100 + Math.random() * 900));

  // Audio & Display Preferences
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [crtEnabled, setCrtEnabled] = useState<boolean>(true);

  // Online Multiplayer State
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [currentRoomId, setCurrentRoomId] = useState<string | null>(null);
  const [currentRoomName, setCurrentRoomName] = useState<string>('Retro Arena #01 (Oficial)');
  const [userRole, setUserRole] = useState<PlayerRole>('spectator');
  const [p1Name, setP1Name] = useState<string>('Player 1');
  const [p2Name, setP2Name] = useState<string>('Player 2');
  const [spectatorCount, setSpectatorCount] = useState<number>(0);
  const [challengerQueue, setChallengerQueue] = useState<string[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [incomingReaction, setIncomingReaction] = useState<{ emoji: string; from: string } | null>(null);

  // Matchmaking State
  const [inQueue, setInQueue] = useState<boolean>(false);
  const [queuePosition, setQueuePosition] = useState<number>(1);
  const [totalInQueue, setTotalInQueue] = useState<number>(0);
  const [matchedOpponent, setMatchedOpponent] = useState<string | null>(null);
  const [matchCountdown, setMatchCountdown] = useState<number | null>(null);

  // Server Telemetry & Rooms
  const [rooms, setRooms] = useState<RoomSummary[]>([]);
  const [serverStats, setServerStats] = useState<ServerStats | null>(null);
  const [ping, setPing] = useState<number | null>(null);

  // Online Authoritative Game State
  const [onlineGameState, setOnlineGameState] = useState<GameState>({
    p1_y: (gameConfig.height - gameConfig.paddleHeight) / 2,
    p2_y: (gameConfig.height - gameConfig.paddleHeight) / 2,
    ball_x: gameConfig.width / 2,
    ball_y: gameConfig.height / 2,
    ball_vx: gameConfig.initialSpeedX,
    ball_vy: gameConfig.initialSpeedY,
    score_p1: 0,
    score_p2: 0,
    status: 'waiting',
    rallyCount: 0,
    maxScore: 5,
  });

  // Offline Engine State
  const [botDifficulty, setBotDifficulty] = useState<BotDifficulty>('medium');
  const [offlineGameState, setOfflineGameState] = useState<GameState>({
    p1_y: (gameConfig.height - gameConfig.paddleHeight) / 2,
    p2_y: (gameConfig.height - gameConfig.paddleHeight) / 2,
    ball_x: gameConfig.width / 2,
    ball_y: gameConfig.height / 2,
    ball_vx: gameConfig.initialSpeedX,
    ball_vy: gameConfig.initialSpeedY,
    score_p1: 0,
    score_p2: 0,
    status: 'playing',
    rallyCount: 0,
    maxScore: 5,
  });
  const offlineEngineRef = useRef<OfflineEngine | null>(null);

  // WebSocket Ref
  const wsRef = useRef<WebSocket | null>(null);

  // Sound toggle sync
  const toggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    soundFx.enabled = next;
  };

  // ----------------------------------------------------
  // Online WebSocket Connection Setup
  // ----------------------------------------------------
  useEffect(() => {
    let reconnectTimeout: NodeJS.Timeout;
    let pingInterval: NodeJS.Timeout;

    const connect = () => {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = import.meta.env.VITE_WS_URL || `${protocol}//${window.location.host}`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        const params = new URLSearchParams(window.location.search);
        const targetRoom = params.get('room') || 'global-arena';
        if (rustServerMode) {
          if (targetRoom !== 'global-arena') {
            ws.send(
              JSON.stringify({
                type: 'room:join',
                roomId: targetRoom,
                nickname,
                asSpectator: false,
              })
            );
          }
          return;
        }

        // Automatically join room from URL query param (?room=...) or default to global-arena
        ws.send(
          JSON.stringify({
            type: 'room:join',
            roomId: targetRoom,
            nickname,
            asSpectator: false,
          })
        );
      };

      ws.onmessage = (event) => {
        try {
          const msg: ServerMessage = JSON.parse(event.data);

          switch (msg.type) {
            case 'connected':
              break;

            case 'room:list':
              setRooms(msg.rooms);
              break;

            case 'room:joined':
              setCurrentRoomId(msg.roomId);
              setCurrentRoomName(msg.roomName);
              setUserRole(msg.role);
              setP1Name(msg.p1Name || 'Player 1');
              setP2Name(msg.p2Name || 'Player 2');
              setSpectatorCount(msg.spectatorCount);
              setOnlineGameState(msg.state);
              setChallengerQueue(msg.challengerQueue || []);

              // Sync URL so copying from browser address bar directly shares the room
              try {
                const currentUrl = new URL(window.location.href);
                currentUrl.searchParams.set('room', msg.roomId);
                window.history.replaceState({}, '', currentUrl.toString());
              } catch {}
              break;

            case 'room:player_joined':
              setSpectatorCount(msg.spectatorCount);
              if (msg.role === 'p1') setP1Name(msg.name);
              if (msg.role === 'p2') setP2Name(msg.name);
              break;

            case 'room:player_left':
              setSpectatorCount(msg.spectatorCount);
              if (msg.role === 'p1') setP1Name('Aguardando...');
              if (msg.role === 'p2') setP2Name('Aguardando...');
              break;

            case 'room:challenger_queue':
              setChallengerQueue(msg.challengerQueue);
              break;

            case 'game:tick':
              setOnlineGameState(msg.state);
              break;

            case 'game:event':
              handleGameEvent(msg.event);
              break;

            case 'matchmaking:status':
              setInQueue(msg.inQueue);
              setQueuePosition(msg.position);
              setTotalInQueue(msg.totalInQueue);
              break;

            case 'matchmaking:matched':
              soundFx.playMatchFound();
              setInQueue(false);
              setMatchedOpponent(msg.opponentName);
              setUserRole(msg.role);
              let cd = 3;
              setMatchCountdown(cd);
              const timer = setInterval(() => {
                cd -= 1;
                setMatchCountdown(cd);
                if (cd <= 0) {
                  clearInterval(timer);
                  setMatchedOpponent(null);
                  setMatchCountdown(null);
                  setShowMatchmakerModal(false);
                }
              }, 1000);
              break;

            case 'chat:message':
              setChatMessages((prev) => [...prev.slice(-30), msg.message]);
              break;

            case 'reaction:broadcast':
              setIncomingReaction({ emoji: msg.emoji, from: msg.from });
              break;

            case 'server:stats':
              setServerStats(msg.stats);
              break;

            case 'pong':
              const rtt = Date.now() - msg.clientTimestamp;
              setPing(rtt);
              break;
          }
        } catch (err) {
          console.error('Failed to parse WebSocket message:', err);
        }
      };

      ws.onclose = () => {
        setIsConnected(false);
        reconnectTimeout = setTimeout(connect, 3000);
      };

      ws.onerror = () => {
        setIsConnected(false);
      };

      // Periodic RTT latency measurement
      pingInterval = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'ping', timestamp: Date.now() }));
        }
      }, 2000);
    };

    connect();

    return () => {
      clearTimeout(reconnectTimeout);
      clearInterval(pingInterval);
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  const handleGameEvent = (event: GameEvent) => {
    switch (event.type) {
      case 'paddle_hit':
        soundFx.playPaddleHit(event.speed / 5.0);
        break;
      case 'wall_hit':
        soundFx.playWallHit();
        break;
      case 'goal':
        soundFx.playGoal();
        break;
      case 'countdown_tick':
        soundFx.playBeep(event.count);
        break;
    }
  };

  // Send input to online server
  const sendOnlineInput = (dir: number) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      const msg: ClientMessage = { type: 'Input', dir };
      wsRef.current.send(JSON.stringify(msg));
    }
  };

  // Matchmaking actions
  const handleJoinQueue = () => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'matchmaking:join',
          nickname,
          rating: 1000,
        })
      );
      setInQueue(true);
    }
  };

  const handleLeaveQueue = () => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'matchmaking:leave' }));
      setInQueue(false);
    }
  };

  // Room actions
  const handleJoinRoom = (roomId: string, asSpectator?: boolean) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'room:join',
          roomId,
          nickname,
          asSpectator,
        })
      );
      setShowLobbyBrowser(false);
    }
  };

  const handleCreateRoom = (name: string, maxScore: number, isPrivate: boolean) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'room:create',
          name,
          maxScore,
          isPrivate,
          nickname,
        })
      );
      setShowLobbyBrowser(false);
    }
  };

  const handleRefreshRooms = () => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'room:list_req' }));
    }
  };

  const handleSendChat = (text: string) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && currentRoomId) {
      wsRef.current.send(
        JSON.stringify({
          type: 'chat:send',
          roomId: currentRoomId,
          text,
        })
      );
    }
  };

  const handleSendReaction = (emoji: string) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && currentRoomId) {
      wsRef.current.send(
        JSON.stringify({
          type: 'reaction:send',
          roomId: currentRoomId,
          emoji,
        })
      );
    }
  };

  const handleRequestChallenge = () => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && currentRoomId) {
      wsRef.current.send(
        JSON.stringify({
          type: 'challenge:queue',
          roomId: currentRoomId,
          nickname,
        })
      );
    }
  };

  const handleRestartOnlineMatch = () => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && currentRoomId) {
      wsRef.current.send(
        JSON.stringify({
          type: 'game:restart',
          roomId: currentRoomId,
        })
      );
    }
  };

  // ----------------------------------------------------
  // Offline Engine Loop
  // ----------------------------------------------------
  useEffect(() => {
    if (activeTab === 'offline') {
      const engine = new OfflineEngine(
        botDifficulty,
        (s) => setOfflineGameState(s),
        (ev) => handleGameEvent(ev)
      );
      offlineEngineRef.current = engine;
      engine.start();

      return () => {
        engine.stop();
        offlineEngineRef.current = null;
      };
    }
  }, [activeTab, botDifficulty]);

  const sendOfflineInput = (dir: number) => {
    if (offlineEngineRef.current) {
      offlineEngineRef.current.setInput('p1', dir);
    }
  };

  const sendOfflineInputP2 = (dir: number) => {
    if (offlineEngineRef.current) {
      offlineEngineRef.current.setInput('p2', dir);
    }
  };

  const restartOfflineMatch = () => {
    if (offlineEngineRef.current) {
      offlineEngineRef.current.restart();
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-mono selection:bg-cyan-500 selection:text-black">
      {/* Telemetry Bar at very top */}
      <TelemetryBar
        ping={ping}
        serverStats={serverStats}
        isConnected={isConnected}
        isOnlineMode={activeTab === 'online' || activeTab === 'sandbox'}
      />

      {/* Main Header / Navigation */}
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur-md px-4 py-3 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          {/* Logo / Brand */}
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 text-slate-950 shadow-lg shadow-cyan-500/20">
              <Gamepad2 className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-black tracking-widest text-white">RETROGAMES HUB</h1>
                <span className="text-[10px] px-2 py-0.5 rounded font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                  STATE-SYNC {gameConfig.tickRateHz}Hz // CANVAS INTERPOLADO
                </span>
              </div>
              <p className="text-[11px] text-slate-400 hidden sm:block">
                Dedicated Server & Matchmaking Architecture (Rust/Tokio + Tauri/Web)
              </p>
            </div>
          </div>

          {/* Mode Switch Tabs */}
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-900 border border-slate-800 text-xs">
            <button
              onClick={() => setActiveTab('online')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition font-bold ${
                activeTab === 'online'
                  ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/25'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <Wifi className="w-3.5 h-3.5" />
              ONLINE DEDICADO
            </button>

            <button
              onClick={() => setActiveTab('sandbox')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition font-bold ${
                activeTab === 'sandbox'
                  ? 'bg-purple-500 text-slate-950 shadow-md shadow-purple-500/25'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <SplitSquareVertical className="w-3.5 h-3.5" />
              SIMULADOR DUAL
            </button>

            <button
              onClick={() => setActiveTab('offline')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition font-bold ${
                activeTab === 'offline'
                  ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/25'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <Bot className="w-3.5 h-3.5" />
              OFFLINE / IA
            </button>

            <button
              onClick={() => setActiveTab('rust')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition font-bold ${
                activeTab === 'rust'
                  ? 'bg-orange-500 text-slate-950 shadow-md shadow-orange-500/25'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <Cpu className="w-3.5 h-3.5" />
              RUST & TAURI
            </button>
          </div>

          {/* Settings & Fast Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowShareModal(true)}
              title="Conectar outro navegador ou dispositivo"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 text-xs font-bold transition"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">CONECTAR NAVEGADOR</span>
            </button>

            <button
              onClick={() => setCrtEnabled(!crtEnabled)}
              title="Filtro CRT Retrô (Scanlines)"
              className={`p-2 rounded-xl border text-xs transition ${
                crtEnabled
                  ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/40'
                  : 'bg-slate-800 text-slate-400 border-slate-700'
              }`}
            >
              <Tv className="w-4 h-4" />
            </button>

            <button
              onClick={toggleSound}
              title="Efeitos Sonoros Retrô"
              className={`p-2 rounded-xl border text-xs transition ${
                soundEnabled
                  ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/40'
                  : 'bg-slate-800 text-slate-400 border-slate-700'
              }`}
            >
              {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </header>

      {/* Main App Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-6">
        {/* VIEW 1: ONLINE MULTIPLAYER DEDICATED */}
        {activeTab === 'online' && (
          <div className="space-y-6">
            {/* Quick Actions Bar */}
            <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl bg-slate-900/80 border border-slate-800">
              <div className="flex items-center gap-3">
                <div className="text-xs">
                  <div className="text-slate-400">SALA CONECTADA:</div>
                  <div className="text-white font-bold flex items-center gap-2">
                    <Radio className="w-4 h-4 text-cyan-400" />
                    {currentRoomName}
                  </div>
                </div>
              </div>

              {/* Matchmaking & Room Browser Trigger Buttons */}
              <div className="flex items-center gap-2.5">
                <button
                  onClick={() => setShowShareModal(true)}
                  className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 font-bold text-xs border border-purple-500/40 transition active:scale-95"
                >
                  <Share2 className="w-4 h-4 text-purple-400" />
                  CONECTAR 2º NAVEGADOR
                </button>

                <button
                  onClick={() => setShowMatchmakerModal(true)}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold text-xs tracking-wider shadow-lg shadow-cyan-500/25 transition active:scale-95"
                >
                  <Swords className="w-4 h-4" />
                  PAREAMENTO RÁPIDO (1V1)
                </button>

                <button
                  onClick={() => setShowLobbyBrowser(!showLobbyBrowser)}
                  className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs border border-slate-700 transition"
                >
                  <Users className="w-4 h-4 text-cyan-400" />
                  {showLobbyBrowser ? 'OCULTAR SALAS' : 'LISTA DE SALAS'}
                </button>
              </div>
            </div>

            {/* Optional Room Browser Drawer */}
            {showLobbyBrowser && (
              <LobbyBrowser
                rooms={rooms}
                currentRoomId={currentRoomId}
                onJoinRoom={handleJoinRoom}
                onCreateRoom={handleCreateRoom}
                onRefresh={handleRefreshRooms}
              />
            )}

            {/* Stage & HUD Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
              {/* Game Arena (Center 3 Columns) */}
              <div className="lg:col-span-3 flex flex-col items-center">
                <GameCanvas
                  state={onlineGameState}
                  role={userRole}
                  p1Name={p1Name}
                  p2Name={p2Name}
                  enableCrt={crtEnabled}
                  onSendInput={sendOnlineInput}
                  onRestart={handleRestartOnlineMatch}
                  incomingReaction={incomingReaction}
                />

                {/* Instructions card */}
                <div className="mt-4 w-full max-w-[800px] p-3 rounded-xl bg-slate-900/60 border border-slate-800 text-xs text-slate-400 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-slate-800 text-cyan-300 font-bold">W / S</span>
                    ou
                    <span className="px-2 py-0.5 rounded bg-slate-800 text-cyan-300 font-bold">SETAS</span>
                    <span>= Mover sua raquete</span>
                  </div>
                  <div className="text-slate-500">
                    O servidor autoritativo simula a {gameConfig.tickRateHz} Hz; o cliente interpola os estados
                  </div>
                </div>
              </div>

              {/* Side Spectator & Chat HUD (1 Column) */}
              <div className="lg:col-span-1 space-y-4">
                <SpectatorHud
                  role={userRole}
                  spectatorCount={spectatorCount}
                  challengerQueue={challengerQueue}
                  chatMessages={chatMessages}
                  onSendChat={handleSendChat}
                  onSendReaction={handleSendReaction}
                  onRequestChallenge={handleRequestChallenge}
                  p1Name={p1Name}
                  p2Name={p2Name}
                />
              </div>
            </div>
          </div>
        )}

        {/* VIEW 2: DUAL CLIENT NETWORK SANDBOX */}
        {activeTab === 'sandbox' && <DualSandbox />}

        {/* VIEW 3: OFFLINE PRACTICE / LOCAL AI BOT */}
        {activeTab === 'offline' && (
          <div className="space-y-6 flex flex-col items-center">
            {/* Offline Control Bar */}
            <div className="w-full max-w-[800px] flex flex-wrap items-center justify-between gap-3 p-4 rounded-2xl bg-slate-900/80 border border-slate-800">
              <div>
                <h3 className="font-bold text-white text-sm">MODO OFFLINE (MOTOR FÍSICO LOCAL)</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  100% executado localmente no navegador sem requisições de rede.
                </p>
              </div>

              {/* Bot Difficulty Selector */}
              <div className="flex items-center gap-1.5 bg-slate-800 p-1 rounded-xl border border-slate-700 text-xs">
                {(['easy', 'medium', 'hard', 'nightmare', 'pvp'] as BotDifficulty[]).map((diff) => (
                  <button
                    key={diff}
                    onClick={() => setBotDifficulty(diff)}
                    className={`px-3 py-1.5 rounded-lg font-bold uppercase transition ${
                      botDifficulty === diff
                        ? 'bg-emerald-500 text-slate-950'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    {diff === 'pvp' ? '2P Local' : diff}
                  </button>
                ))}
              </div>
            </div>

            {/* Offline Game Canvas */}
            <div className="w-full flex flex-col items-center">
              <GameCanvas
                state={offlineGameState}
                role="p1"
                p1Name={nickname}
                p2Name={botDifficulty === 'pvp' ? 'Player 2 (Setas)' : `Bot (${botDifficulty.toUpperCase()})`}
                enableCrt={crtEnabled}
                controlScheme={botDifficulty === 'pvp' ? 'wasd' : 'both'}
                onSendInput={sendOfflineInput}
                onSendInputP2={botDifficulty === 'pvp' ? sendOfflineInputP2 : undefined}
                onRestart={restartOfflineMatch}
              />

              <div className="mt-4 w-full max-w-[800px] p-3 rounded-xl bg-slate-900/60 border border-slate-800 text-xs text-slate-400 text-center">
                {botDifficulty === 'pvp'
                  ? 'Player 1 usa [W / S] e Player 2 usa [Seta Cima / Seta Baixo] no mesmo teclado.'
                  : 'Controle a raquete esquerda com [W / S] ou [Setas] contra a inteligência artificial.'}
              </div>
            </div>
          </div>
        )}

        {/* VIEW 4: RUST TOKIO & TAURI CODE VIEWER */}
        {activeTab === 'rust' && <RustCodeViewer />}
      </main>

      {/* Matchmaking Modal */}
      <MatchmakerModal
          isOpen={showMatchmakerModal}
          onClose={() => setShowMatchmakerModal(false)}
          nickname={nickname}
          onNicknameChange={setNickname}
          inQueue={inQueue}
          queuePosition={queuePosition}
          totalInQueue={totalInQueue}
          onJoinQueue={handleJoinQueue}
          onLeaveQueue={handleLeaveQueue}
          matchedOpponent={matchedOpponent}
          matchCountdown={matchCountdown}
      />

      {/* Share / Multi-browser Modal */}
      <ShareModal
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        roomId={currentRoomId}
        roomName={currentRoomName}
      />
    </div>
  );
}
