# Arquitetura Retrogaming Hub: Servidor-Cliente Multiplayer com Rust & Tauri

Este documento serve como guia e código de teste para a validação da arquitetura **State-Sync / Server-Authoritative** para jogos multiplayer com suporte a modo offline, online, espectador em tempo real e *drop-in challenge*.

---

## 1. Visão Geral da Arquitetura

O ecossistema divide-se em três partes essenciais:

1. **Cliente / HUD (Tauri + WebAssembly/HTML5):**
   * Interface do aplicativo desktop feita em Tauri.
   * Executa a renderização gráfica via `<canvas />` ou WebGL localmente (usando WebAssembly compilado a partir de C/C++ ou JS/WebAssembly nativo).
   * No modo **Offline**, a lógica física e os *inputs* rodam 100% locais.
   * No modo **Online**, o cliente apenas lê as entradas do teclado/gamepad, envia mensagens curtas de *input* via WebSocket/QUIC para o servidor, e renderiza os quadros baseados no estado retornado pelo servidor.

2. **Servidor Multiplayer Centralizado (Rust + Tokio):**
   * Processo em Rust leve e concorrente.
   * Não processa renderização de tela ou gráficos (economizando memória e GPU).
   * Mantém o loop de simulação física e estado determinístico a **30 ticks por segundo (30 Hz)**.
   * Gerencia slots de jogadores (Player 1, Player 2) e retransmite (*broadcast*) o estado atual do jogo para todos os **espectadores** conectados na sala.

3. **Protocolo de Rede (JSON ou Byte Vectors):**
   * Troca de mensagens minimalista de latência ultra-baixa.

---

## 2. Estrutura do Protocolo de Mensagens

### Cliente $\rightarrow$ Servidor (Input Event)
```json
{
  "type": "Input",
  "dir": -1.0
}
```
* `dir`: `-1.0` (Para cima / Left), `1.0` (Para baixo / Right), `0.0` (Parado).

### Servidor $\rightarrow$ Cliente (30 Hz Broadcast)
```json
{
  "p1_y": 250.0,
  "p2_y": 250.0,
  "ball_x": 400.0,
  "ball_y": 300.0,
  "ball_vx": 4.0,
  "ball_vy": 3.0,
  "score_p1": 0,
  "score_p2": 0
}
```

---

## 3. Servidor Multiplayer em Rust (`src/main.rs`)

### `Cargo.toml`
```toml
[package]
name = "pong-server"
version = "0.1.0"
edition = "2021"

[dependencies]
tokio = { version = "1", features = ["full"] }
tokio-tungstenite = "0.20"
futures-util = "0.3"
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"
```

### Código do Servidor (`src/main.rs`)
```rust
use futures_util::{SinkExt, StreamExt};
use serde::{Deserialize, Serialize};
use std::{
    sync::{Arc, Mutex},
    time::Duration,
};
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
            p1_y: 250.0,
            p2_y: 250.0,
            ball_x: 400.0,
            ball_y: 300.0,
            ball_vx: 4.0,
            ball_vy: 3.0,
            score_p1: 0,
            score_p2: 0,
        }
    }

    fn update(&mut self, p1_input: f32, p2_input: f32) {
        // Atualiza posições de P1 e P2 (limites: 0 a 500 px)
        self.p1_y = (self.p1_y + p1_input * 6.0).clamp(0.0, 500.0);
        self.p2_y = (self.p2_y + p2_input * 6.0).clamp(0.0, 500.0);

        // Atualiza posição da bola
        self.ball_x += self.ball_vx;
        self.ball_y += self.ball_vy;

        // Colisão com teto e chão (altura: 600)
        if self.ball_y <= 0.0 || self.ball_y >= 580.0 {
            self.ball_vy *= -1.0;
        }

        // Colisão com raquetes (P1 em X=30, P2 em X=750)
        if (self.ball_x <= 30.0 && self.ball_y >= self.p1_y && self.ball_y <= self.p1_y + 100.0)
            || (self.ball_x >= 750.0 && self.ball_y >= self.p2_y && self.ball_y <= self.p2_y + 100.0)
        {
            self.ball_vx *= -1.05; // Aceleração gradual
        }

        // Pontuação e Reset
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
        self.ball_vx = if self.ball_vx > 0.0 { -4.0 } else { 4.0 };
        self.ball_vy = 3.0;
    }
}

#[tokio::main]
async fn main() {
    let state = Arc::new(Mutex::new(GameState::new()));
    let inputs = Arc::new(Mutex::new((0.0f32, 0.0f32))); // (P1_dir, P2_dir)
    let (tx, _) = broadcast::channel::<String>(100);

    let listener = TcpListener::bind("127.0.0.1:8080").await.unwrap();
    println!("🎮 Servidor Pong Multiplayer rodando em ws://127.0.0.1:8080");

    // Loop de física centralizado a 30 Hz
    let state_clone = Arc::clone(&state);
    let inputs_clone = Arc::clone(&inputs);
    let tx_clone = tx.clone();
    tokio::spawn(async move {
        let mut timer = interval(Duration::from_millis(33)); // ~30 Hz
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
            let player_id = *count; // 1 = P1, 2 = P2, >2 = Espectador
            drop(count);

            println!("Cliente conectado! Slot atribuído: {}", player_id);

            // Envio contínuo do estado do jogo para o cliente
            let send_task = tokio::spawn(async move {
                while let Ok(msg) = rx.recv().await {
                    if ws_tx.send(Message::Text(msg.into())).await.is_err() {
                        break;
                    }
                }
            });

            // Recepção de inputs do cliente
            while let Some(Ok(Message::Text(text))) = ws_rx.next().await {
                if let Ok(ClientMessage::Input { dir }) = serde_json::from_str(&text) {
                    let mut inp = inputs.lock().unwrap();
                    if player_id == 1 {
                        inp.0 = dir;
                    } else if player_id == 2 {
                        inp.1 = dir;
                    }
                }
            }

            send_task.abort();
            println!("Cliente do Slot {} desconectou.", player_id);
        });
    }
}
```

---

## 4. Cliente Web / Canvas HTML5 (`index.html`)

Este arquivo pode ser carregado diretamente no navegador ou incorporado na pasta `src/` do seu projeto **Tauri**.

```html
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Pong Tauri Multiplayer Test</title>
  <style>
    body { background: #111; color: #fff; text-align: center; font-family: monospace; }
    canvas { background: #000; border: 4px solid #fff; margin-top: 10px; }
  </style>
</head>
<body>
  <h1>Tauri Netcode Sandbox: Pong Multiplayer</h1>
  <p>Use [Seta Cima / W] e [Seta Baixo / S] para jogar. Espectadores assistem automaticamente.</p>
  <canvas id="stage" width="800" height="600"></canvas>

  <script>
    const canvas = document.getElementById("stage");
    const ctx = canvas.getContext("2d");
    const ws = new WebSocket("ws://127.0.0.1:8080");

    let lastDir = 0;

    function sendInput(dir) {
      if (dir !== lastDir && ws.readyState === WebSocket.OPEN) {
        lastDir = dir;
        ws.send(JSON.stringify({ type: "Input", dir: dir }));
      }
    }

    window.addEventListener("keydown", (e) => {
      if (e.key === "ArrowUp" || e.key === "w") sendInput(-1);
      if (e.key === "ArrowDown" || e.key === "s") sendInput(1);
    });

    window.addEventListener("keyup", (e) => {
      if (["ArrowUp", "ArrowDown", "w", "s"].includes(e.key)) sendInput(0);
    });

    ws.onmessage = (event) => {
      const state = JSON.parse(event.data);
      render(state);
    };

    function render(s) {
      // Limpa fundo
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, 800, 600);

      // Linha central pontilhada
      ctx.setLineDash([10, 10]);
      ctx.strokeStyle = "#555";
      ctx.beginPath();
      ctx.moveTo(400, 0); ctx.lineTo(400, 600);
      ctx.stroke();

      // Placar
      ctx.fillStyle = "#fff";
      ctx.font = "32px monospace";
      ctx.fillText(s.score_p1, 350, 50);
      ctx.fillText(s.score_p2, 430, 50);

      // Raquetes (10x100 px)
      ctx.fillRect(20, s.p1_y, 10, 100);
      ctx.fillRect(770, s.p2_y, 10, 100);

      // Bola (12x12 px)
      ctx.fillRect(s.ball_x, s.ball_y, 12, 12);
    }
  </script>
</body>
</html>
```

---

## 5. Instruções de Execução e Teste

1. **Rodar o Servidor em Rust:**
   ```bash
   cargo run
   ```
2. **Abrir o Player 1:** Abra o arquivo `index.html` na primeira aba ou janela Tauri. Ele assumirá o **Slot 1** (Player 1).
3. **Abrir o Player 2:** Abra o `index.html` em uma segunda aba ou janela. Ela assumirá o **Slot 2** (Player 2). Pressione as teclas para jogar simultaneamente.
4. **Abrir Espectadores:** Qualquer aba subsequente aberta (3ª, 4ª, etc.) receberá o *stream* dos dados em tempo real, agindo como um espectador ao vivo.