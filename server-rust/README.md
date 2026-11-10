# Servidor Dedicado em Rust & Guia de Integração com Tauri

Este diretório contém a implementação completa do **Servidor Multiplayer Dedicado em Rust com Tokio e WebSockets**, correspondente à arquitetura State-Sync / Server-Authoritative.

## 🚀 Como Executar o Servidor em Rust

1. **Pré-requisitos:**
   * Rust & Cargo instalados (`curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh`)

2. **Compilar e Iniciar:**
   ```bash
   cd server-rust
   cargo run --release
   ```
   O servidor iniciará escutando em `ws://0.0.0.0:8080` com simulação determinística a 30 Hz.

## Integração com o Frontend Web

Em desenvolvimento local, inicie o servidor Rust em um terminal e o frontend em outro:

```bash
cd server-rust
cargo run --release
```

```bash
VITE_GAME_SERVER=rust VITE_WS_URL=ws://localhost:8080 npm run dev
```

`VITE_WS_URL` deve apontar para um endereço alcançável pelo navegador. Em produção com HTTPS, use um endpoint `wss://` configurado no proxy/reverse proxy.

O modo Rust mantém a arena global e também oferece pareamento rápido, criação/listagem de salas, espectadores, chat, reações e fila de desafiantes. O matchmaker move os dois clientes pareados para uma sala dedicada; salas dedicadas são removidas quando ficam vazias. O estado começa em `waiting` e a contagem regressiva só começa quando há dois jogadores.

As constantes de física compartilhadas entre os backends Node e Rust ficam em [`../game-config.json`](../game-config.json). O cliente renderiza com `requestAnimationFrame` e interpola entre snapshots do servidor; a taxa de simulação autoritativa permanece em 30 Hz.

---

## 🏗️ Como Integrar com o Tauri (Desktop HUD)

No seu projeto Tauri (`src-tauri`):
1. **Frontend (Tauri Webview):**
   * Conecte o WebSocket a `ws://127.0.0.1:8080` (local) ou ao IP do seu servidor dedicado na nuvem.
   * O cliente envia pacotes `{ "type": "Input", "dir": -1.0 | 0.0 | 1.0 }`.
   * O canvas interpola os estados recebidos a 30 Hz e não simula física online no cliente.

2. **Modo Offline no Tauri:**
   * Quando sem conexão, o cliente pode alternar para o motor de física local simulando o bot de inteligência artificial ou 2 jogadores no mesmo teclado.

3. **Espectadores e desafiantes:**
   * Clientes adicionais podem assistir, enviar mensagens/reação e entrar na fila de desafios da sala. Um desafiante é promovido quando um dos jogadores sai.
