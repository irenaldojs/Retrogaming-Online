/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Swords, Loader2, X, CheckCircle2, Shield, Users } from 'lucide-react';

interface MatchmakerModalProps {
  isOpen: boolean;
  onClose: () => void;
  nickname: string;
  onNicknameChange: (val: string) => void;
  inQueue: boolean;
  queuePosition: number;
  totalInQueue: number;
  onJoinQueue: () => void;
  onLeaveQueue: () => void;
  matchedOpponent: string | null;
  matchCountdown: number | null;
}

export const MatchmakerModal: React.FC<MatchmakerModalProps> = ({
  isOpen,
  onClose,
  nickname,
  onNicknameChange,
  inQueue,
  queuePosition,
  totalInQueue,
  onJoinQueue,
  onLeaveQueue,
  matchedOpponent,
  matchCountdown,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
      <div className="relative w-full max-w-md bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 border border-cyan-500/30 rounded-2xl p-6 shadow-2xl shadow-cyan-950/60 overflow-hidden font-mono">
        {/* Glow ambient accent */}
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-pink-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Close Button */}
        {!inQueue && !matchedOpponent && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        )}

        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 mb-3">
            <Swords className="w-8 h-8 animate-pulse" />
          </div>
          <h2 className="text-xl font-black tracking-wider text-white">PAREAMENTO EM TEMPO REAL</h2>
          <p className="text-xs text-slate-400 mt-1">
            Sistema de matchmaking dedicado com servidor autoritativo
          </p>
        </div>

        {/* Content based on status */}
        {matchedOpponent ? (
          /* Match Found View */
          <div className="flex flex-col items-center py-4 text-center">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 border-2 border-emerald-400 flex items-center justify-center text-emerald-400 mb-4 animate-bounce">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <h3 className="text-lg font-bold text-emerald-400">PARTIDA ENCONTRADA!</h3>
            <p className="text-sm text-slate-300 mt-1">
              Oponente: <span className="text-pink-400 font-bold">{matchedOpponent}</span>
            </p>
            <div className="mt-4 px-4 py-2 bg-slate-800/80 rounded-lg border border-slate-700 text-xs text-cyan-300">
              Iniciando servidor de jogo em {matchCountdown ?? 3}s...
            </div>
          </div>
        ) : inQueue ? (
          /* Searching Queue View */
          <div className="flex flex-col items-center py-6 text-center">
            {/* Animated Radar Pulse */}
            <div className="relative w-28 h-28 flex items-center justify-center mb-6">
              <div className="absolute inset-0 rounded-full border border-cyan-500/20 animate-ping" />
              <div className="absolute inset-2 rounded-full border border-cyan-500/40 animate-pulse" />
              <div className="w-16 h-16 rounded-full bg-cyan-500/10 border-2 border-cyan-400 flex items-center justify-center text-cyan-400">
                <Loader2 className="w-8 h-8 animate-spin" />
              </div>
            </div>

            <div className="text-cyan-400 font-bold text-sm tracking-widest animate-pulse">
              BUSCANDO OPONENTE...
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Procurando jogadores disponíveis na fila dedicada
            </p>

            {/* Queue Metrics */}
            <div className="mt-5 w-full grid grid-cols-2 gap-3 text-xs">
              <div className="p-2.5 rounded-lg bg-slate-800/60 border border-slate-700">
                <div className="text-slate-400">Sua Posição</div>
                <div className="text-white font-bold text-sm">#{queuePosition || 1}</div>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-800/60 border border-slate-700">
                <div className="text-slate-400">Na Fila</div>
                <div className="text-cyan-400 font-bold text-sm">{totalInQueue} jogadores</div>
              </div>
            </div>

            {/* Cancel Button */}
            <button
              onClick={onLeaveQueue}
              className="mt-6 w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-bold text-xs border border-slate-700 transition"
            >
              CANCELAR BUSCA
            </button>
          </div>
        ) : (
          /* Initial Form to Enter Queue */
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                SEU APELIDO / GAMERTAG
              </label>
              <input
                type="text"
                value={nickname}
                onChange={(e) => onNicknameChange(e.target.value)}
                placeholder="Ex: CyberStriker"
                maxLength={16}
                className="w-full px-4 py-2.5 bg-slate-800/80 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-cyan-400 transition"
              />
            </div>

            {/* Matchmaking Info */}
            <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-700/60 text-xs text-slate-400 space-y-1.5">
              <div className="flex items-center gap-2 text-slate-300">
                <Shield className="w-3.5 h-3.5 text-cyan-400" />
                <span>Simulação 100% Server-Authoritative a 60 Hz</span>
              </div>
              <div className="flex items-center gap-2 text-slate-300">
                <Users className="w-3.5 h-3.5 text-pink-400" />
                <span>Pareamento automático 1v1 com suporte a espectadores</span>
              </div>
            </div>

            {/* Start Button */}
            <button
              onClick={onJoinQueue}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold text-sm tracking-wider shadow-lg shadow-cyan-500/25 transition active:scale-98"
            >
              ENTRAR NA FILA DE PAREAMENTO
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
