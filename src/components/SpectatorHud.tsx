/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { PlayerRole, ChatMessage } from '../types/game.js';
import { Swords, Send, MessageSquare, Flame, Sparkles, Trophy, Zap, ThumbsUp } from 'lucide-react';

interface SpectatorHudProps {
  role: PlayerRole;
  spectatorCount: number;
  challengerQueue: string[];
  chatMessages: ChatMessage[];
  onSendChat: (text: string) => void;
  onSendReaction: (emoji: string) => void;
  onRequestChallenge: () => void;
  p1Name: string;
  p2Name: string;
}

export const SpectatorHud: React.FC<SpectatorHudProps> = ({
  role,
  spectatorCount,
  challengerQueue,
  chatMessages,
  onSendChat,
  onSendReaction,
  onRequestChallenge,
  p1Name,
  p2Name,
}) => {
  const [chatInput, setChatInput] = useState('');
  const [votes, setVotes] = useState<{ p1: number; p2: number }>({ p1: 1, p2: 1 });
  const [userVoted, setUserVoted] = useState<'p1' | 'p2' | null>(null);

  const handleVote = (player: 'p1' | 'p2') => {
    if (userVoted) return;
    setUserVoted(player);
    setVotes((prev) => ({
      ...prev,
      [player]: prev[player] + 1,
    }));
  };

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    onSendChat(chatInput.trim());
    setChatInput('');
  };

  const emojis = ['🔥', '👏', '⚡', '😱', '🏆', '💥'];

  const totalVotes = votes.p1 + votes.p2;
  const p1Percent = Math.round((votes.p1 / totalVotes) * 100);
  const p2Percent = 100 - p1Percent;

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 font-mono space-y-4">
      {/* Top Banner: Reactions & Drop-in Challenge */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Quick Reactions Bar */}
        <div className="flex items-center gap-1.5 bg-slate-800/80 px-2.5 py-1.5 rounded-xl border border-slate-700/60">
          <span className="text-xs text-slate-400 mr-1 flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            REAGIR:
          </span>
          {emojis.map((emoji) => (
            <button
              key={emoji}
              onClick={() => onSendReaction(emoji)}
              className="text-base hover:scale-125 transition-transform active:scale-95 px-1 py-0.5"
            >
              {emoji}
            </button>
          ))}
        </div>

        {/* Drop-in Challenge Button */}
        {role === 'spectator' && (
          <button
            onClick={onRequestChallenge}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-bold text-xs shadow-md shadow-amber-500/20 transition active:scale-95"
          >
            <Swords className="w-4 h-4" />
            DESAFIAR VENCEDOR (DROP-IN)
          </button>
        )}
      </div>

      {/* Challenger Queue Info */}
      {challengerQueue.length > 0 && (
        <div className="text-xs text-slate-400 flex items-center gap-2 bg-slate-800/40 p-2 rounded-lg border border-slate-700/40">
          <Trophy className="w-3.5 h-3.5 text-amber-400" />
          <span>Fila de desafiantes:</span>
          <span className="text-slate-200 font-bold">{challengerQueue.join(', ')}</span>
        </div>
      )}

      {/* Spectator Prediction Bar */}
      <div className="bg-slate-800/50 p-3 rounded-xl border border-slate-700/60">
        <div className="flex items-center justify-between text-xs mb-1.5">
          <span className="text-slate-400">VOTAÇÃO DE VITÓRIA (PALPITES):</span>
          <span className="text-slate-500 text-[11px]">{totalVotes} votos</span>
        </div>
        <div className="flex h-3 rounded-full overflow-hidden bg-slate-950 mb-2 border border-slate-700">
          <div
            style={{ width: `${p1Percent}%` }}
            className="bg-cyan-500 transition-all duration-500"
          />
          <div
            style={{ width: `${p2Percent}%` }}
            className="bg-pink-500 transition-all duration-500"
          />
        </div>
        <div className="flex items-center justify-between gap-2">
          <button
            onClick={() => handleVote('p1')}
            disabled={userVoted !== null}
            className={`flex-1 py-1 px-2 rounded text-xs font-bold transition flex items-center justify-between ${
              userVoted === 'p1'
                ? 'bg-cyan-500 text-slate-950'
                : 'bg-slate-800 hover:bg-slate-700 text-cyan-400'
            }`}
          >
            <span>{p1Name}</span>
            <span>{p1Percent}%</span>
          </button>
          <button
            onClick={() => handleVote('p2')}
            disabled={userVoted !== null}
            className={`flex-1 py-1 px-2 rounded text-xs font-bold transition flex items-center justify-between ${
              userVoted === 'p2'
                ? 'bg-pink-500 text-slate-950'
                : 'bg-slate-800 hover:bg-slate-700 text-pink-400'
            }`}
          >
            <span>{p2Name}</span>
            <span>{p2Percent}%</span>
          </button>
        </div>
      </div>

      {/* Chat Messages Log */}
      <div>
        <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-2">
          <MessageSquare className="w-3.5 h-3.5 text-cyan-400" />
          <span>CHAT DA SALA AO VIVO</span>
        </div>
        <div className="h-28 overflow-y-auto space-y-1.5 p-2 bg-slate-950/80 rounded-xl border border-slate-800 text-xs">
          {chatMessages.length === 0 ? (
            <div className="text-slate-600 italic text-center py-4">
              Nenhuma mensagem no chat ainda. Diga olá!
            </div>
          ) : (
            chatMessages.map((msg) => (
              <div key={msg.id} className="flex items-start gap-1.5">
                <span
                  className={`font-bold px-1 rounded text-[10px] uppercase ${
                    msg.role === 'p1'
                      ? 'bg-cyan-500/20 text-cyan-400'
                      : msg.role === 'p2'
                      ? 'bg-pink-500/20 text-pink-400'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {msg.role}
                </span>
                <span className="font-semibold text-slate-300">{msg.from}:</span>
                <span className="text-slate-200">{msg.text}</span>
              </div>
            ))
          )}
        </div>

        {/* Chat Input */}
        <form onSubmit={handleSend} className="mt-2 flex gap-2">
          <input
            type="text"
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            placeholder="Digite sua mensagem ou torcida..."
            maxLength={100}
            className="flex-1 px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-cyan-400"
          />
          <button
            type="submit"
            className="p-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 transition active:scale-95"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </form>
      </div>
    </div>
  );
};
