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

O modo Rust conecta clientes à sala global: os dois primeiros recebem os papéis P1 e P2; os demais entram como espectadores. O lobby e o pareamento rápido continuam disponíveis apenas usando o backend Node, que é o modo padrão.

---

## 🏗️ Como Integrar com o Tauri (Desktop HUD)

No seu projeto Tauri (`src-tauri`):
1. **Frontend (Tauri Webview):**
   * Conecte o WebSocket a `ws://127.0.0.1:8080` (local) ou ao IP do seu servidor dedicado na nuvem.
   * O cliente envia pacotes `{ "type": "Input", "dir": -1.0 | 0.0 | 1.0 }`.
   * O canvas renderiza o estado recebido a 30 Hz sem simular física no cliente.

2. **Modo Offline no Tauri:**
   * Quando sem conexão, o cliente pode alternar para o motor de física local simulando o bot de inteligência artificial ou 2 jogadores no mesmo teclado.

3. **Espectadores:**
   * As conexões após P1 e P2 recebem o estado da partida em tempo real. A fila de desafios ainda não está disponível no servidor Rust.
