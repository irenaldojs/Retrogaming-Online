/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { ServerStats } from '../types/game.js';
import { Wifi, Activity, Server, Users, Clock, Cpu } from 'lucide-react';

interface TelemetryBarProps {
  ping: number | null;
  serverStats: ServerStats | null;
  isConnected: boolean;
  isOnlineMode: boolean;
}

export const TelemetryBar: React.FC<TelemetryBarProps> = ({
  ping,
  serverStats,
  isConnected,
  isOnlineMode,
}) => {
  const getPingColor = (ms: number | null) => {
    if (ms === null) return 'text-slate-400';
    if (ms < 40) return 'text-emerald-400';
    if (ms < 100) return 'text-amber-400';
    return 'text-rose-400';
  };

  return (
    <div className="w-full bg-slate-900/90 border-b border-slate-800 text-xs font-mono text-slate-300 px-4 py-2 flex flex-wrap items-center justify-between gap-3 shadow-inner">
      {/* Connection & Mode Indicator */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <span
            className={`w-2 h-2 rounded-full ${
              !isOnlineMode
                ? 'bg-blue-400'
                : isConnected
                ? 'bg-emerald-400 animate-pulse'
                : 'bg-rose-500'
            }`}
          />
          <span className="font-semibold text-slate-200">
            {!isOnlineMode
              ? 'MODO OFFLINE (SIMULAÇÃO LOCAL)'
              : isConnected
              ? 'SERVIDOR DEDICADO CONECTADO'
              : 'DESCONECTADO'}
          </span>
        </div>

        {isOnlineMode && (
          <div className="flex items-center gap-1.5 pl-3 border-l border-slate-700">
            <Wifi className="w-3.5 h-3.5 text-cyan-400" />
            <span>LATÊNCIA (RTT):</span>
            <span className={`font-bold ${getPingColor(ping)}`}>
              {ping !== null ? `${ping} ms` : '--'}
            </span>
          </div>
        )}
      </div>

      {/* Server Authoritative Telemetry */}
      {isOnlineMode && serverStats && (
        <div className="flex items-center gap-4 text-slate-400">
          <div className="flex items-center gap-1">
            <Activity className="w-3.5 h-3.5 text-cyan-400" />
            <span>TICK:</span>
            <span className="text-cyan-300 font-bold">{serverStats.tickRateHz.toFixed(1)} Hz</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 font-bold">
              30 FPS LOCK
            </span>
          </div>

          <div className="flex items-center gap-1 hidden sm:flex">
            <Server className="w-3.5 h-3.5 text-purple-400" />
            <span>SALAS:</span>
            <span className="text-purple-300 font-bold">{serverStats.activeRooms}</span>
          </div>

          <div className="flex items-center gap-1">
            <Users className="w-3.5 h-3.5 text-amber-400" />
            <span>CLIENTES:</span>
            <span className="text-amber-300 font-bold">{serverStats.connectedClients}</span>
          </div>

          <div className="flex items-center gap-1 hidden md:flex">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            <span>UPTIME:</span>
            <span className="text-slate-200">{serverStats.serverUptimeSeconds}s</span>
          </div>

          <div className="flex items-center gap-1 hidden lg:flex">
            <Cpu className="w-3.5 h-3.5 text-slate-400" />
            <span>RAM:</span>
            <span className="text-slate-200">{serverStats.memoryUsageMb} MB</span>
          </div>
        </div>
      )}

      {/* Offline info */}
      {!isOnlineMode && (
        <div className="text-slate-400 text-xs flex items-center gap-2">
          <span>Tick local:</span>
          <span className="text-emerald-400 font-bold">30.0 FPS</span>
          <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 font-bold">
            TRAVADO A 30 QUADROS
          </span>
        </div>
      )}
    </div>
  );
};
