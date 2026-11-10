/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { RoomSummary } from '../types/game.js';
import { Plus, Users, Eye, Play, Lock, RefreshCw, Radio } from 'lucide-react';

interface LobbyBrowserProps {
  rooms: RoomSummary[];
  currentRoomId: string | null;
  onJoinRoom: (roomId: string, asSpectator?: boolean) => void;
  onCreateRoom: (name: string, maxScore: number, isPrivate: boolean) => void;
  onRefresh: () => void;
}

export const LobbyBrowser: React.FC<LobbyBrowserProps> = ({
  rooms,
  currentRoomId,
  onJoinRoom,
  onCreateRoom,
  onRefresh,
}) => {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');
  const [maxScore, setMaxScore] = useState(5);
  const [isPrivate, setIsPrivate] = useState(false);
  const [directCode, setDirectCode] = useState('');

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoomName.trim()) return;
    onCreateRoom(newRoomName.trim(), maxScore, isPrivate);
    setShowCreateModal(false);
    setNewRoomName('');
  };

  const handleJoinDirect = (e: React.FormEvent) => {
    e.preventDefault();
    if (!directCode.trim()) return;
    onJoinRoom(directCode.trim(), false);
    setDirectCode('');
  };

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 font-mono">
      {/* Top Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <Radio className="w-5 h-5 text-cyan-400 animate-pulse" />
          <h3 className="font-bold text-white text-sm tracking-wider">SALAS DEDICADAS DO SERVIDOR</h3>
          <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-cyan-400 border border-slate-700">
            {rooms.length} ativas
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onRefresh}
            title="Atualizar lista"
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs shadow-md shadow-cyan-500/20 transition active:scale-95"
          >
            <Plus className="w-4 h-4" />
            CRIAR SALA
          </button>
        </div>
      </div>

      {/* Direct Room Code Join */}
      <form onSubmit={handleJoinDirect} className="mb-4 flex gap-2">
        <input
          type="text"
          value={directCode}
          onChange={(e) => setDirectCode(e.target.value)}
          placeholder="Código de Sala Privada..."
          className="flex-1 px-3 py-1.5 bg-slate-800/80 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-cyan-400"
        />
        <button
          type="submit"
          className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-cyan-400 border border-slate-700 rounded-xl text-xs font-bold transition"
        >
          CONECTAR
        </button>
      </form>

      {/* Rooms Table / Grid */}
      <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
        {rooms.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500 border border-dashed border-slate-800 rounded-xl">
            Nenhuma sala ativa no momento. Crie a primeira sala ou entre no pareamento!
          </div>
        ) : (
          rooms.map((room) => {
            const isCurrent = currentRoomId === room.id;
            const hasSlot =
              room.p1Name === 'Aguardando...' || room.p2Name === 'Aguardando...';

            return (
              <div
                key={room.id}
                className={`p-3 rounded-xl border transition flex items-center justify-between gap-3 ${
                  isCurrent
                    ? 'bg-cyan-950/30 border-cyan-500/50'
                    : 'bg-slate-800/50 hover:bg-slate-800/80 border-slate-700/60'
                }`}
              >
                {/* Room Info */}
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    {room.isPrivate && <Lock className="w-3.5 h-3.5 text-amber-400" />}
                    <span className="font-bold text-xs text-slate-100 truncate">{room.name}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase ${
                        room.status === 'playing'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                          : room.status === 'countdown'
                          ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                          : 'bg-slate-700/40 text-slate-400'
                      }`}
                    >
                      {room.status === 'playing' ? 'EM JOGO' : room.status === 'waiting' ? 'AGUARDANDO' : room.status}
                    </span>
                  </div>

                  {/* Players & Score */}
                  <div className="mt-1 flex items-center gap-2 text-xs text-slate-400">
                    <span className="text-cyan-400">{room.p1Name}</span>
                    <span className="font-bold text-white">
                      {room.score_p1} - {room.score_p2}
                    </span>
                    <span className="text-pink-400">{room.p2Name}</span>
                  </div>
                </div>

                {/* Spectators & Actions */}
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1 text-xs text-slate-400" title="Espectadores ao vivo">
                    <Eye className="w-3.5 h-3.5 text-amber-400" />
                    <span>{room.spectators}</span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {hasSlot && !isCurrent ? (
                      <button
                        onClick={() => onJoinRoom(room.id, false)}
                        className="px-3 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs flex items-center gap-1 shadow-sm transition active:scale-95"
                      >
                        <Play className="w-3 h-3 fill-current" />
                        JOGAR
                      </button>
                    ) : null}

                    {!isCurrent && (
                      <button
                        onClick={() => onJoinRoom(room.id, true)}
                        className="px-2.5 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs flex items-center gap-1 transition"
                      >
                        <Eye className="w-3 h-3" />
                        ASSISTIR
                      </button>
                    )}

                    {isCurrent && (
                      <span className="px-2.5 py-1 rounded bg-cyan-500/20 text-cyan-400 text-xs font-bold border border-cyan-500/40">
                        CONECTADO
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Create Room Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <form
            onSubmit={handleCreate}
            className="w-full max-w-sm bg-slate-900 border border-cyan-500/40 rounded-2xl p-5 shadow-2xl space-y-4"
          >
            <h3 className="font-bold text-white text-base">CRIAR SALA DEDICADA</h3>

            <div>
              <label className="block text-xs text-slate-300 mb-1">Nome da Sala</label>
              <input
                type="text"
                value={newRoomName}
                onChange={(e) => setNewRoomName(e.target.value)}
                placeholder="Ex: Arena Cyber 2026"
                required
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-cyan-400"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-300 mb-1">Pontos para Vitória</label>
              <div className="grid grid-cols-4 gap-2">
                {[3, 5, 7, 11].map((pts) => (
                  <button
                    key={pts}
                    type="button"
                    onClick={() => setMaxScore(pts)}
                    className={`py-1.5 rounded-lg text-xs font-bold border transition ${
                      maxScore === pts
                        ? 'bg-cyan-500 text-slate-950 border-cyan-400'
                        : 'bg-slate-800 text-slate-300 border-slate-700'
                    }`}
                  >
                    {pts} PTS
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="privCheck"
                checked={isPrivate}
                onChange={(e) => setIsPrivate(e.target.checked)}
                className="rounded border-slate-700 bg-slate-800 text-cyan-500 focus:ring-0"
              />
              <label htmlFor="privCheck" className="text-xs text-slate-300 cursor-pointer">
                Sala Privada (Entrada apenas via código)
              </label>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="px-3 py-1.5 rounded-xl bg-slate-800 text-slate-300 text-xs hover:bg-slate-700"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs shadow-md shadow-cyan-500/20"
              >
                Criar e Entrar
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
