/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Copy, Check, Globe, Share2, Smartphone, Monitor, X, ExternalLink } from 'lucide-react';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  roomId: string | null;
  roomName: string;
}

export const ShareModal: React.FC<ShareModalProps> = ({
  isOpen,
  onClose,
  roomId,
  roomName,
}) => {
  const [copiedDev, setCopiedDev] = useState(false);
  const [copiedPre, setCopiedPre] = useState(false);

  if (!isOpen) return null;

  const currentOrigin = window.location.origin;
  const shareUrlDev = roomId ? `${currentOrigin}/?room=${encodeURIComponent(roomId)}` : currentOrigin;

  // Pre-release URL if available
  const shareUrlPre = shareUrlDev.replace('-dev-', '-pre-');

  const copyToClipboard = (text: string, isPre: boolean = false) => {
    navigator.clipboard.writeText(text);
    if (isPre) {
      setCopiedPre(true);
      setTimeout(() => setCopiedPre(false), 2000);
    } else {
      setCopiedDev(true);
      setTimeout(() => setCopiedDev(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
      <div className="relative w-full max-w-lg bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 border border-cyan-500/30 rounded-2xl p-6 shadow-2xl shadow-cyan-950/60 font-mono space-y-5">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
            <Share2 className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white tracking-wider">
              CONECTAR DE OUTRO NAVEGADOR
            </h2>
            <p className="text-xs text-slate-400">
              Jogue online em tempo real com dois ou mais navegadores
            </p>
          </div>
        </div>

        {/* Step-by-Step Instructions */}
        <div className="space-y-3 text-xs">
          {/* Step 1 */}
          <div className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-700/80 space-y-2">
            <div className="flex items-center justify-between text-slate-200 font-bold">
              <span className="flex items-center gap-2">
                <Monitor className="w-4 h-4 text-cyan-400" />
                1. Link Direto da Partida (Copiar e colar no outro navegador)
              </span>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={shareUrlDev}
                className="flex-1 px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-[11px] text-cyan-300 font-mono select-all focus:outline-none"
              />
              <button
                onClick={() => copyToClipboard(shareUrlDev, false)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs shadow-md transition active:scale-95"
              >
                {copiedDev ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                <span>{copiedDev ? 'Copiado!' : 'Copiar'}</span>
              </button>
            </div>
            <div className="text-[11px] text-slate-400">
              Sala ativa: <span className="text-white font-semibold">{roomName}</span> (ID: <span className="text-cyan-400">{roomId}</span>)
            </div>
          </div>

          {/* Option: Opening in another browser */}
          <div className="p-3.5 rounded-xl bg-slate-800/40 border border-slate-700/60 space-y-2">
            <div className="text-slate-200 font-bold flex items-center gap-2">
              <Globe className="w-4 h-4 text-emerald-400" />
              Como testar em 3 passos simples:
            </div>
            <ol className="list-decimal list-inside space-y-1 text-slate-300 text-[11px] leading-relaxed">
              <li>
                Abra o <strong>outro navegador</strong> (ex: Chrome, Edge, Firefox, Brave) ou uma <strong>Janela Anônima (Incógnito)</strong>.
              </li>
              <li>
                Cole o link acima na barra de endereços e pressione <strong>Enter</strong>.
              </li>
              <li>
                O segundo navegador conectará via WebSocket automaticamente no slot do <strong>Player 2</strong> ou como <strong>Espectador</strong>, recebendo a física a 60 Hz!
              </li>
            </ol>
          </div>

          {/* Option: Instant split screen inside the app */}
          <div className="p-3 rounded-xl bg-purple-950/30 border border-purple-500/30 flex items-center justify-between gap-3">
            <div>
              <div className="font-bold text-purple-300 text-xs">Dica: Teste Instantâneo sem abrir outra janela</div>
              <div className="text-[11px] text-purple-200/70">
                Você também pode clicar na aba <strong>"SIMULADOR DUAL"</strong> no topo para jogar P1 vs P2 lado a lado na mesma tela!
              </div>
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-between pt-2">
          <a
            href={shareUrlDev}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs text-cyan-400 hover:text-cyan-300 transition"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Abrir nova aba agora
          </a>

          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
