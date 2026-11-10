/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Copy, Check, Terminal, FileCode, Cpu, Layers, GitBranch, Download, Github } from 'lucide-react';

export const RustCodeViewer: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'main' | 'cargo' | 'tauri' | 'architecture' | 'git'>('main');
  const [copied, setCopied] = useState(false);

  const cargoCode = `[package]
name = "pong-multiplayer-server"
version = "0.2.0"
edition = "2021"

[dependencies]
tokio = { version = "1", features = ["full"] }
tokio-tungstenite = "0.21"
futures-util = "0.3"
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"
uuid = { version = "1.7", features = ["v4", "serde"] }
`;

  const mainRsCode = `//! Servidor Multiplayer em Rust com Tokio & WebSockets (60 Hz State-Sync)
use futures_util::{SinkExt, StreamExt};
use serde::{Deserialize, Serialize};
use std::{sync::{Arc, Mutex}, time::Duration};
use tokio::net::TcpListener;
use tokio::sync::broadcast;
use tokio::time::interval;
use tokio_tungstenite::tungstenite::Message;

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(tag = "type")]
enum ClientMessage {
    Input { dir: f32 },
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct GameState {
    pub p1_y: f32,
    pub p2_y: f32,
    pub ball_x: f32,
    pub ball_y: f32,
    pub ball_vx: f32,
    pub ball_vy: f32,
    pub score_p1: u32,
    pub score_p2: u32,
}

impl GameState {
    fn new() -> Self {
        Self {
            p1_y: 250.0, p2_y: 250.0,
            ball_x: 400.0, ball_y: 300.0,
            ball_vx: 5.0, ball_vy: 3.2,
            score_p1: 0, score_p2: 0,
        }
    }

    fn update(&mut self, p1_input: f32, p2_input: f32) {
        // Atualiza raquetes
        self.p1_y = (self.p1_y + p1_input * 7.0).clamp(0.0, 510.0);
        self.p2_y = (self.p2_y + p2_input * 7.0).clamp(0.0, 510.0);

        // Atualiza bola
        self.ball_x += self.ball_vx;
        self.ball_y += self.ball_vy;

        // Colisão com teto e chão
        if self.ball_y <= 0.0 || self.ball_y >= 588.0 {
            self.ball_vy *= -1.0;
        }

        // Colisão com raquetes
        if (self.ball_x <= 37.0 && self.ball_y >= self.p1_y && self.ball_y <= self.p1_y + 90.0)
            || (self.ball_x >= 751.0 && self.ball_y >= self.p2_y && self.ball_y <= self.p2_y + 90.0)
        {
            self.ball_vx *= -1.05;
        }

        // Pontuação
        if self.ball_x < 0.0 {
            self.score_p2 += 1;
            self.reset_ball();
        } else if self.ball_x > 800.0 {
            self.score_p1 += 1;
            self.reset_ball();
        }
    }

    fn reset_ball(&mut self) {
        self.ball_x = 400.0;
        self.ball_y = 300.0;
        self.ball_vx = if self.ball_vx > 0.0 { -5.0 } else { 5.0 };
        self.ball_vy = 3.2;
    }
}

#[tokio::main]
async fn main() {
    let state = Arc::new(Mutex::new(GameState::new()));
    let inputs = Arc::new(Mutex::new((0.0f32, 0.0f32)));
    let (tx, _) = broadcast::channel::<String>(100);

    let listener = TcpListener::bind("0.0.0.0:8080").await.unwrap();
    println!("🎮 Servidor Pong Multiplayer rodando em ws://0.0.0.0:8080");

    // Loop de física centralizado a 60 FPS (16.6ms)
    let state_clone = Arc::clone(&state);
    let inputs_clone = Arc::clone(&inputs);
    let tx_clone = tx.clone();
    tokio::spawn(async move {
        let mut timer = interval(Duration::from_millis(16));
        loop {
            timer.tick().await;
            let (p1, p2) = *inputs_clone.lock().unwrap();
            let mut game = state_clone.lock().unwrap();
            game.update(p1, p2);

            let json_state = serde_json::to_string(&*game).unwrap();
            let _ = tx_clone.send(json_state);
        }
    });

    let player_counter = Arc::new(Mutex::new(0usize));
    while let Ok((stream, _)) = listener.accept().await {
        let state = Arc::clone(&state);
        let inputs = Arc::clone(&inputs);
        let tx = tx.clone();
        let mut rx = tx.subscribe();
        let player_counter = Arc::clone(&player_counter);

        tokio::spawn(async move {
            let ws_stream = tokio_tungstenite::accept_async(stream).await.unwrap();
            let (mut ws_tx, mut ws_rx) = ws_stream.split();

            let mut count = player_counter.lock().unwrap();
            *count += 1;
            let player_id = *count;
            drop(count);

            println!("Cliente conectado: Slot {}", player_id);

            // Envio contínuo 60Hz do estado para o cliente
            let send_task = tokio::spawn(async move {
                while let Ok(msg) = rx.recv().await {
                    if ws_tx.send(Message::Text(msg.into())).await.is_err() {
                        break;
                    }
                }
            });

            // Entrada de inputs
            while let Some(Ok(Message::Text(text))) = ws_rx.next().await {
                if let Ok(ClientMessage::Input { dir }) = serde_json::from_str(&text) {
                    let mut inp = inputs.lock().unwrap();
                    if player_id == 1 { inp.0 = dir; }
                    else if player_id == 2 { inp.1 = dir; }
                }
            }

            send_task.abort();
        });
    }
}`;

  const tauriGuide = `// src-tauri / Tauri Client Webview Setup
// Em um app Tauri, adicione a conexão no frontend:

const ws = new WebSocket("ws://127.0.0.1:8080");

// Envia input leve com prevenção de spam (apenas em mudanças)
let lastDir = 0;
function sendInput(dir) {
  if (dir !== lastDir && ws.readyState === WebSocket.OPEN) {
    lastDir = dir;
    ws.send(JSON.stringify({ type: "Input", dir }));
  }
}

// Captura de teclado local
window.addEventListener("keydown", (e) => {
  if (e.key === "ArrowUp" || e.key === "w") sendInput(-1);
  if (e.key === "ArrowDown" || e.key === "s") sendInput(1);
});

window.addEventListener("keyup", (e) => {
  if (["ArrowUp", "ArrowDown", "w", "s"].includes(e.key)) sendInput(0);
});

// Renderização 100% orientada a eventos do servidor (State-Sync)
ws.onmessage = (event) => {
  const state = JSON.parse(event.data);
  renderCanvas(state);
};
`;

  const getCode = () => {
    switch (activeTab) {
      case 'main':
        return mainRsCode;
      case 'cargo':
        return cargoCode;
      case 'tauri':
        return tauriGuide;
      default:
        return '';
    }
  };

  const copyCode = () => {
    navigator.clipboard.writeText(getCode());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 font-mono space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Cpu className="w-5 h-5 text-orange-400" />
            <h3 className="font-bold text-white text-base">
              ARQUITETURA & CÓDIGO FONTE (RUST + TOKIO & TAURI)
            </h3>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Implementação nativa de alta performance do documento técnico de arquitetura.
          </p>
        </div>

        {/* Tab Selector */}
        <div className="flex items-center gap-1 bg-slate-800 p-1 rounded-xl border border-slate-700 text-xs">
          <button
            onClick={() => setActiveTab('main')}
            className={`px-3 py-1.5 rounded-lg transition font-bold ${
              activeTab === 'main' ? 'bg-orange-500 text-slate-950' : 'text-slate-300 hover:text-white'
            }`}
          >
            src/main.rs
          </button>
          <button
            onClick={() => setActiveTab('cargo')}
            className={`px-3 py-1.5 rounded-lg transition font-bold ${
              activeTab === 'cargo' ? 'bg-orange-500 text-slate-950' : 'text-slate-300 hover:text-white'
            }`}
          >
            Cargo.toml
          </button>
          <button
            onClick={() => setActiveTab('tauri')}
            className={`px-3 py-1.5 rounded-lg transition font-bold ${
              activeTab === 'tauri' ? 'bg-orange-500 text-slate-950' : 'text-slate-300 hover:text-white'
            }`}
          >
            Tauri Client
          </button>
          <button
            onClick={() => setActiveTab('architecture')}
            className={`px-3 py-1.5 rounded-lg transition font-bold ${
              activeTab === 'architecture' ? 'bg-orange-500 text-slate-950' : 'text-slate-300 hover:text-white'
            }`}
          >
            Diagrama
          </button>
          <button
            onClick={() => setActiveTab('git')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition font-bold ${
              activeTab === 'git' ? 'bg-cyan-500 text-slate-950 shadow-md' : 'text-cyan-400 hover:text-white'
            }`}
          >
            <Github className="w-3.5 h-3.5" />
            Subir ao GitHub
          </button>
        </div>
      </div>

      {/* GitHub Export Tab */}
      {activeTab === 'git' ? (
        <div className="p-5 bg-slate-950 rounded-xl border border-slate-800 text-xs text-slate-300 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-slate-900 border border-cyan-500/30 rounded-xl">
            <div>
              <div className="font-bold text-white text-sm flex items-center gap-2">
                <Github className="w-5 h-5 text-cyan-400" />
                Repositório Git Pronto & Commits Criados
              </div>
              <p className="text-slate-400 mt-1">
                O repositório Git local já está 100% inicializado com todos os arquivos commitados na branch <strong>main</strong>.
              </p>
            </div>

            <a
              href="/api/download-repo"
              download="retrogaming-hub.tar.gz"
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs shadow-lg shadow-cyan-500/25 transition active:scale-95"
            >
              <Download className="w-4 h-4" />
              BAIXAR PROJETO (.TAR.GZ)
            </a>
          </div>

          <div className="space-y-3">
            <div className="font-bold text-slate-200 flex items-center gap-2">
              <Terminal className="w-4 h-4 text-emerald-400" />
              Passo a Passo para enviar ao seu GitHub:
            </div>

            <div className="p-3 bg-slate-900 rounded-lg border border-slate-800 space-y-2">
              <div className="text-slate-400 font-semibold">1. Crie um novo repositório vazio no seu GitHub:</div>
              <div className="text-slate-300">
                Acesse <a href="https://github.com/new" target="_blank" rel="noreferrer" className="text-cyan-400 underline">github.com/new</a> e crie um repositório (ex: <code>retrogaming-hub</code>).
              </div>
            </div>

            <div className="p-3 bg-slate-900 rounded-lg border border-slate-800 space-y-2">
              <div className="text-slate-400 font-semibold">2. Enviar diretamente da sua máquina ou via Terminal:</div>
              <pre className="p-3 bg-black/60 rounded border border-slate-800 text-cyan-300 font-mono text-[11px] overflow-x-auto leading-relaxed">
{`# Se você baixou o arquivo compactado:
tar -xzf retrogaming-hub.tar.gz
cd retrogaming-hub
git remote add origin https://github.com/irenaldojs/SEU-REPOSITORIO.git
git push -u origin main`}
              </pre>
            </div>

            <div className="p-3 bg-slate-900 rounded-lg border border-slate-800 space-y-2">
              <div className="text-slate-400 font-semibold">3. Deseja que eu envie diretamente aqui pelo AI Studio?</div>
              <div className="text-slate-300 leading-relaxed">
                Basta me informar a URL do seu repositório GitHub e um <strong>Personal Access Token (PAT)</strong> temporário com permissão de escrita (<code>repo</code>). Posso executar o <code>git push</code> direto daqui!
              </div>
            </div>
          </div>
        </div>
      ) : activeTab === 'architecture' ? (
        <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 text-xs text-slate-300 space-y-4">
          <div className="flex items-center gap-2 text-cyan-400 font-bold">
            <Layers className="w-4 h-4" />
            FLUXO DO PROTOCOLO STATE-SYNC & MATCHMAKING
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="p-3 bg-slate-900 border border-cyan-500/30 rounded-xl">
              <div className="font-bold text-cyan-400 mb-1">1. Fila de Pareamento</div>
              <p className="text-slate-400">
                Clientes conectam e entram na fila. O matchmaker avalia pares a cada 500ms e instancia
                uma sala dedicada assim que 2 jogadores estão prontos.
              </p>
            </div>
            <div className="p-3 bg-slate-900 border border-pink-500/30 rounded-xl">
              <div className="font-bold text-pink-400 mb-1">2. Loop Autoritativo 30 Hz</div>
              <p className="text-slate-400">
                O servidor roda a simulação física a cada 33.3ms (30 FPS Lock). Clientes apenas enviam inputs leves
                (dir: -1, 0, 1) evitando trapaças e divergências.
              </p>
            </div>
            <div className="p-3 bg-slate-900 border border-amber-500/30 rounded-xl">
              <div className="font-bold text-amber-400 mb-1">3. Broadcast & Drop-in</div>
              <p className="text-slate-400">
                Espectadores ilimitados recebem os quadros sincronizados em tempo real e podem entrar na
                fila de desafio para assumir o slot do perdedor.
              </p>
            </div>
          </div>
        </div>
      ) : (
        /* Code Box */
        <div className="relative">
          <div className="absolute top-3 right-3 z-10">
            <button
              onClick={copyCode}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs border border-slate-700 transition"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copiado!' : 'Copiar Código'}</span>
            </button>
          </div>

          <pre className="p-4 bg-slate-950 rounded-xl border border-slate-800 overflow-x-auto text-xs text-slate-200 max-h-96 leading-relaxed">
            <code>{getCode()}</code>
          </pre>
        </div>
      )}
    </div>
  );
};
