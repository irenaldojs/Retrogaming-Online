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
   O servidor iniciará escutando em `ws://0.0.0.0:8080` com simulação determinística a 60 FPS (16.6 ms).

---

## 🏗️ Como Integrar com o Tauri (Desktop HUD)

No seu projeto Tauri (`src-tauri`):
1. **Frontend (Tauri Webview):**
   * Conecte o WebSocket a `ws://127.0.0.1:8080` (local) ou ao IP do seu servidor dedicado na nuvem.
   * O cliente envia pacotes `{ "type": "Input", "dir": -1.0 | 0.0 | 1.0 }`.
   * O canvas renderiza o estado recebido a 60 Hz sem simular física no cliente.

2. **Modo Offline no Tauri:**
   * Quando sem conexão, o cliente pode alternar para o motor de física local simulando o bot de inteligência artificial ou 2 jogadores no mesmo teclado.

3. **Drop-in Challenge & Espectador:**
   * Múltiplos clientes conectados na mesma sala tornam-se espectadores automáticos e podem solicitar desafio ao vencedor da partida.
